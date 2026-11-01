import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, chmod, unlink, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// Mutations are strictly confined to new, uniquely named QA organizations.
// Existing users/tenants and shared auth rate limits are never modified.
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://127.0.0.1:3100" },
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    "browser-fixture-file": { type: "string" },
    "cleanup-fixture-file": { type: "string" },
  },
});
const base = new URL(values["base-url"]);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
    ["http:", "https:"].includes(base.protocol) &&
    base.pathname === "/" &&
    !base.search &&
    !base.hash &&
    !base.username &&
    !base.password,
  "QA is restricted to a local HTTP(S) origin",
);
const loaded = require("dotenv").config({
  path: resolve(repositoryRoot, values["env-file"]),
  quiet: true,
  override: false,
});
assert.ok(
  !loaded.error && process.env.DATABASE_URL && process.env.BETTER_AUTH_URL,
  "Load the ignored server environment first",
);
assert.ok(
  new URL(process.env.BETTER_AUTH_URL).origin === base.origin,
  "BETTER_AUTH_URL must match the local server origin",
);
const db = createDatabaseClient();
async function cleanup({ prefix, userIds, orgIds }) {
  assert.match(prefix, /^brand-live-qa-\d+-[a-f0-9]{12}$/);
  assert.ok(
    userIds.length > 0 &&
      userIds.length < 10 &&
      orgIds.length > 0 &&
      orgIds.length < 10,
  );
  assert.ok(
    [...userIds, ...orgIds].every(
      (id) => id.startsWith(`${prefix}-`) && /^[a-zA-Z0-9-]+$/.test(id),
    ),
  );
  await db.$transaction([
    db.workspaceToolRequest.deleteMany({
      where: { organizationId: { in: orgIds }, userId: { in: userIds } },
    }),
    db.campaign.deleteMany({
      where: {
        brandOrganizationId: { in: orgIds },
        createdById: { in: userIds },
      },
    }),
    db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }),
    db.organization.deleteMany({ where: { id: { in: orgIds } } }),
    db.user.deleteMany({ where: { id: { in: userIds } } }),
    db.rateLimit.deleteMany({
      where: {
        key: {
          in: userIds.flatMap((id) =>
            [
              "brand-read",
              "brand-write",
              "read",
              "write",
              "requests-read",
              "requests-write",
              "requests-upload",
              "agency-read",
              "agency-apply",
            ].map((bucket) => `workspace:${bucket}:${id}`),
          ),
        },
      },
    }),
  ]);
}
if (values["cleanup-fixture-file"]) {
  try {
    const path = resolve(repositoryRoot, values["cleanup-fixture-file"]);
    await cleanup(JSON.parse(await readFile(path, "utf8")));
    await unlink(path);
    console.log(
      "CLEANUP removed only the retained synthetic brand QA records and credentials file",
    );
  } finally {
    await db.$disconnect();
  }
} else {
  const prefix = `brand-live-qa-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const password = `Qa-${randomBytes(24).toString("base64url")}!`;
  const userIds = [],
    orgIds = [];
  let step = "preflight",
    retain = false,
    checks = 0;
  async function call(path, { body, cookie, origin = base.origin } = {}) {
    const response = await globalThis.fetch(new URL(path, base), {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      signal: globalThis.AbortSignal.timeout(45000),
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(origin
          ? {
              Origin: origin,
              "Sec-Fetch-Site":
                origin === base.origin ? "same-origin" : "cross-site",
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      response,
      text,
      json: response.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : null,
    };
  }
  const expect = (result, expected) =>
    assert.equal(
      result.response.status,
      expected,
      `${step}: expected HTTP ${expected}, received ${result.response.status}, code ${result.json?.code ?? "page"}`,
    );
  async function check(name, work) {
    step = name;
    await work();
    checks++;
    console.log(`PASS ${name}`);
  }
  async function fixture(
    label,
    { organizationId, type = "BRAND", role = "OWNER" } = {},
  ) {
    const id = `${prefix}-${label}`,
      email = `${id}@example.invalid`,
      orgId = organizationId ?? `${id}-org`;
    userIds.push(id);
    if (!organizationId) orgIds.push(orgId);
    const hashed = await hashPassword(password);
    await db.$transaction(async (tx) => {
      if (!organizationId)
        await tx.organization.create({
          data: {
            id: orgId,
            name: `브랜드 화면 QA · ${label}`,
            slug: orgId,
            type,
            status: "ACTIVE",
            countryCode: "KR",
            metadata: {
              industry: "gaming",
              companySize: "15–49",
              contactName: "QA 담당자",
              profileCompletedAt: new Date().toISOString(),
            },
          },
        });
      await tx.user.create({
        data: {
          id,
          email,
          name: "브랜드 화면 QA",
          locale: "KO",
          emailVerified: false,
          accounts: {
            create: {
              providerId: "credential",
              accountId: id,
              password: hashed,
            },
          },
          memberships: { create: { organizationId: orgId, role } },
        },
      });
    });
    let login = await call("/api/auth/sign-in/email", {
      body: { email, password },
    });
    if (login.response.status === 429) {
      console.log("WAIT normal sign-in cooldown (no limiter bypass)");
      await delay(30500);
      await delay(30500);
      login = await call("/api/auth/sign-in/email", {
        body: { email, password },
      });
    }
    expect(login, 200);
    const cookies = login.response.headers.getSetCookie();
    assert.ok(
      cookies.some((value) => value.split("=", 1)[0].endsWith("session_token")),
    );
    return {
      userId: id,
      orgId,
      email,
      cookie: cookies.map((value) => value.split(";", 1)[0]).join("; "),
    };
  }
  const desiredDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const fields = (changes = {}) => ({
    title: "브랜드 실제 데이터 연결 검수",
    genre: "RPG",
    goal: "실제 저장 및 권한 범위 확인",
    contentFormat: "라이브 + VOD",
    creatorCount: 3,
    desiredDate,
    note: "QA 전용 의뢰 · 실제 집행하지 마세요.",
    compositionPreference: "balanced",
    budgetAmount: "12345.67",
    currency: "USD",
    platforms: ["youtube", "chzzk"],
    regions: ["KR"],
    route: "managed",
    clientRequestId: randomUUID(),
    ...changes,
  });
  let owner, outsider, member, agency, managedId, openId, draftId, inquiryId;
  async function saveBrowserFixture() {
    if (!values["browser-fixture-file"]) return;
    const file = resolve(repositoryRoot, values["browser-fixture-file"]);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify(
        {
          prefix,
          userIds,
          orgIds,
          baseUrl: base.origin,
          email: owner.email,
          password,
          campaignId: managedId,
          openCampaignId: openId,
          inquiryId,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await chmod(file, 0o600);
    retain = true;
    console.log(
      "READY synthetic browser fixture saved to the restricted file; credentials not logged",
    );
  }
  try {
    await check("anonymous brand API is denied", async () => {
      expect(await call("/api/brand/workspace"), 401);
      expect(await call("/api/brand/campaigns", { body: fields() }), 401);
    });
    await check("isolated synthetic accounts authenticate", async () => {
      owner = await fixture("owner");
      outsider = await fixture("outsider");
      member = await fixture("member", {
        organizationId: owner.orgId,
        role: "MEMBER",
      });
      agency = await fixture("agency", { type: "AGENCY" });
    });
    await saveBrowserFixture();
    await check(
      "approved brand default route and read-only member permissions",
      async () => {
        const redirect = await call("/auth/continue?lang=ko", {
          cookie: owner.cookie,
        });
        assert.ok([303, 307, 308].includes(redirect.response.status));
        assert.equal(
          new URL(redirect.response.headers.get("location"), base).pathname,
          "/advertiser",
        );
        const workspace = await call("/api/brand/workspace", {
          cookie: member.cookie,
        });
        expect(workspace, 200);
        assert.equal(workspace.json.permissions.canManageCampaigns, false);
        expect(
          await call("/api/brand/campaigns", {
            cookie: member.cookie,
            body: fields(),
          }),
          403,
        );
        expect(
          await call("/api/brand/workspace", { cookie: agency.cookie }),
          403,
        );
      },
    );
    await check(
      "partial draft preserves inputs and does not start SLA",
      async () => {
        const draft = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: {
            action: "saveDraft",
            title: "작성 중인 새 캠페인",
            clientRequestId: randomUUID(),
          },
        });
        expect(draft, 200);
        draftId = draft.json.id;
        const row = await db.campaign.findUniqueOrThrow({
          where: { id: draftId },
        });
        assert.equal(row.status, "DRAFT");
        assert.equal(row.budgetAmount, null);
        assert.equal(row.contentDeadline, null);
        assert.equal(
          await db.workspaceToolRequest.count({
            where: { campaignId: draftId },
          }),
          0,
        );
        const detail = await call(`/api/brand/campaigns/${draftId}`, {
          cookie: owner.cookie,
        });
        expect(detail, 200);
        assert.equal(detail.json.campaign.submittedAt, null);
        assert.equal(detail.json.campaign.brief.goal, "");
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: {
              action: "submitDraft",
              id: draftId,
              expectedUpdatedAt: draft.json.updatedAt,
              clientRequestId: randomUUID(),
            },
          }),
          400,
        );
        const edit = fields({
          action: "saveDraft",
          id: draftId,
          expectedUpdatedAt: draft.json.updatedAt,
        });
        const updated = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: edit,
        });
        expect(updated, 200);
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: edit,
          }),
          409,
        );
        const submit = {
          action: "submitDraft",
          id: draftId,
          expectedUpdatedAt: updated.json.updatedAt,
          clientRequestId: randomUUID(),
        };
        const submitted = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: submit,
        });
        expect(submitted, 200);
        assert.equal(
          Date.parse(submitted.json.proposalDueAt) -
            Date.parse(submitted.json.submittedAt),
          48 * 3600000,
        );
        const retry = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: submit,
        });
        expect(retry, 200);
        assert.deepEqual(retry.json, submitted.json);
        assert.equal(
          await db.workspaceToolRequest.count({
            where: { campaignId: draftId },
          }),
          1,
        );
      },
    );
    await check(
      "managed request persists exact budget, real intake and 48-hour deadline once",
      async () => {
        const form = fields();
        const created = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: form,
        });
        expect(created, 200);
        managedId = created.json.id;
        const stored = await db.campaign.findUniqueOrThrow({
          where: { id: managedId },
          include: { requests: true },
        });
        assert.equal(stored.status, "REVIEW");
        assert.equal(stored.type, "MANAGED");
        assert.equal(stored.budgetAmount.toFixed(2), "12345.67");
        assert.equal(stored.requests.length, 1);
        assert.equal(stored.requirements.brandBrief.goal, form.goal);
        assert.equal(
          Date.parse(created.json.proposalDueAt) -
            Date.parse(created.json.submittedAt),
          48 * 3600000,
        );
        const repeat = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: form,
        });
        expect(repeat, 200);
        assert.deepEqual(repeat.json, created.json);
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: { ...form, budgetAmount: "9999" },
          }),
          409,
        );
        const secret = "QA-PRIVATE-SUPPLY-MARGIN-DO-NOT-PUBLISH";
        await db.campaign.update({
          where: { id: managedId },
          data: {
            requirements: {
              ...stored.requirements,
              internalCost: secret,
              brandBrief: {
                ...stored.requirements.brandBrief,
                contact: secret,
              },
              adminReview: {
                reason: "QA 운영 검토 안내",
                internalNotes: secret,
              },
            },
          },
        });
        const workspace = await call("/api/brand/workspace", {
          cookie: owner.cookie,
        });
        expect(workspace, 200);
        assert.match(
          workspace.response.headers.get("cache-control"),
          /no-store/,
        );
        assert.ok(!workspace.text.includes(secret));
        assert.ok(!workspace.text.includes("payloadHash"));
        const detail = await call(`/api/brand/campaigns/${managedId}`, {
          cookie: owner.cookie,
        });
        expect(detail, 200);
        assert.ok(!detail.text.includes(secret));
        assert.deepEqual(detail.json.proposals, []);
        assert.deepEqual(detail.json.deliverables, []);
        assert.deepEqual(detail.json.performance.metrics, []);
        assert.deepEqual(detail.json.documents, []);
      },
    );
    await check(
      "open campaign stores supplied deadline without managed SLA",
      async () => {
        const applicationDeadline = new Date(
          Date.now() + 10 * 86400000,
        ).toISOString();
        const created = await call("/api/brand/campaigns", {
          cookie: owner.cookie,
          body: fields({
            title: "오픈 캠페인 연결 검수",
            route: "open",
            applicationDeadline,
          }),
        });
        expect(created, 200);
        openId = created.json.id;
        assert.equal(created.json.proposalDueAt, null);
        const stored = await db.campaign.findUniqueOrThrow({
          where: { id: openId },
          include: { requests: true },
        });
        assert.equal(stored.type, "OPEN_BIDDING");
        assert.equal(
          stored.applicationDeadline.toISOString(),
          applicationDeadline,
        );
        assert.equal(stored.requests[0].dueAt, null);
      },
    );
    await check(
      "organization isolation, hidden directory and raw supplier endpoint closure",
      async () => {
        expect(
          await call(`/api/brand/campaigns/${managedId}`, {
            cookie: outsider.cookie,
          }),
          404,
        );
        const foreign = await call("/api/brand/workspace", {
          cookie: outsider.cookie,
        });
        expect(foreign, 200);
        assert.equal(foreign.json.campaigns.length, 0);
        assert.equal(foreign.json.requests.length, 0);
        expect(
          await call("/api/directory/preview", { cookie: owner.cookie }),
          404,
        );
        expect(
          await call("/api/workspace/search", {
            cookie: owner.cookie,
            body: { mode: "similar" },
          }),
          404,
        );
        expect(
          await call(
            `/api/workspace/campaign-applications?campaignId=${managedId}`,
            { cookie: owner.cookie },
          ),
          404,
        );
        expect(
          await call("/api/workspace/campaign-applications", {
            cookie: owner.cookie,
            body: { action: "accept", applicationId: "not-accessible" },
          }),
          404,
        );
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            origin: "https://foreign.example.invalid",
            body: fields(),
          }),
          403,
        );
      },
    );
    await check(
      "campaign inquiries persist and internal messages stay private",
      async () => {
        const created = await call("/api/workspace/requests", {
          cookie: owner.cookie,
          body: {
            title: "게시 일정 확인",
            tool: "campaign",
            campaignId: managedId,
            body: "QA용 캠페인 문의입니다.",
          },
        });
        expect(created, 201);
        inquiryId = created.json.id;
        await db.requestMessage.create({
          data: {
            requestId: inquiryId,
            authorId: owner.userId,
            body: "QA-INTERNAL-NOTE",
            internal: true,
            authorRole: "ADMIN",
          },
        });
        const reply = await call(`/api/workspace/requests/${inquiryId}`, {
          cookie: owner.cookie,
          body: {
            action: "message",
            body: "브랜드 추가 문의",
            attachmentIds: [],
          },
        });
        expect(reply, 200);
        const detail = await call(`/api/workspace/requests/${inquiryId}`, {
          cookie: owner.cookie,
        });
        expect(detail, 200);
        assert.ok(!detail.text.includes("QA-INTERNAL-NOTE"));
        assert.ok(detail.text.includes("브랜드 추가 문의"));
        expect(
          await call(`/api/workspace/requests/${inquiryId}`, {
            cookie: outsider.cookie,
          }),
          404,
        );
      },
    );
    await check(
      "pending approval and revoked sessions immediately deny access",
      async () => {
        await db.organization.update({
          where: { id: owner.orgId },
          data: { status: "PENDING" },
        });
        expect(
          await call("/api/brand/workspace", { cookie: owner.cookie }),
          403,
        );
        expect(
          await call(`/api/brand/campaigns/${managedId}`, {
            cookie: owner.cookie,
          }),
          403,
        );
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: fields(),
          }),
          403,
        );
        expect(
          await call(`/api/workspace/requests/${inquiryId}`, {
            cookie: owner.cookie,
          }),
          403,
        );
        await db.organization.update({
          where: { id: owner.orgId },
          data: { status: "ACTIVE" },
        });
        expect(
          await call("/api/auth/sign-out", {
            cookie: outsider.cookie,
            body: {},
          }),
          200,
        );
        expect(
          await call("/api/brand/workspace", { cookie: outsider.cookie }),
          401,
        );
      },
    );
    await check(
      "cancel persists and blocks repeated state transitions",
      async () => {
        const before = await db.campaign.findUniqueOrThrow({
          where: { id: draftId },
        });
        const cancel = {
          action: "cancel",
          id: draftId,
          expectedUpdatedAt: before.updatedAt.toISOString(),
        };
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: cancel,
          }),
          200,
        );
        const intake = await db.workspaceToolRequest.findFirstOrThrow({
          where: { campaignId: draftId },
        });
        assert.equal(intake.status, "CLOSED");
        assert.equal(intake.dueAt, null);
        assert.equal(intake.version, 1);
        assert.equal(
          (await db.campaign.findUniqueOrThrow({ where: { id: draftId } }))
            .status,
          "CANCELED",
        );
        expect(
          await call("/api/brand/campaigns", {
            cookie: owner.cookie,
            body: cancel,
          }),
          409,
        );
      },
    );
    await saveBrowserFixture();
    console.log(`PASS ${checks} real API/database brand checks`);
  } catch (error) {
    process.exitCode = 1;
    console.error(
      `FAIL ${step}: ${error instanceof assert.AssertionError ? error.message : (error?.name ?? "Error")}`,
    );
  } finally {
    try {
      if (!retain && userIds.length) {
        await cleanup({ prefix, userIds, orgIds });
        console.log("CLEANUP removed this run's isolated synthetic fixtures");
      }
    } catch {
      process.exitCode = 1;
      console.error(`CLEANUP FAILED for isolated prefix ${prefix}`);
    }
    await db.$disconnect();
  }
}
