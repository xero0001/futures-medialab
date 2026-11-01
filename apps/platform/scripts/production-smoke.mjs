import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// This integration check creates its own isolated tenants and signs in through
// the real auth endpoints. It never reads or modifies named product accounts.
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://127.0.0.1:3100" },
    "admin-url": { type: "string", default: "http://127.0.0.1:3101" },
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    "admin-env-file": { type: "string" },
    "browser-fixture-file": { type: "string" },
    "cleanup-fixture-file": { type: "string" },
  },
});
const base = new URL(values["base-url"]),
  adminBase = new URL(values["admin-url"]);
for (const url of [base, adminBase])
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      ["http:", "https:"].includes(url.protocol) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password,
    "QA only supports trusted local server origins",
  );
const dotenv = require("dotenv");
const loaded = dotenv.config({
  path: resolve(repositoryRoot, values["env-file"]),
  quiet: true,
  override: false,
});
assert.ok(
  !loaded.error && process.env.DATABASE_URL && process.env.BETTER_AUTH_URL,
  "Server environment is required",
);
assert.equal(
  new URL(process.env.BETTER_AUTH_URL).origin,
  base.origin,
  "Platform environment origin mismatch",
);
// Dev servers may receive their origins and DB URL through their launch process.
// An optional file can verify that configuration; real sign-in also proves both
// HTTP servers see the isolated accounts created in this run's database.
if (values["admin-env-file"]) {
  const adminEnvironment = dotenv.parse(
    await readFile(resolve(repositoryRoot, values["admin-env-file"]), "utf8"),
  );
  assert.equal(
    new URL(adminEnvironment.BETTER_AUTH_URL).origin,
    adminBase.origin,
    "Admin environment origin mismatch",
  );
  assert.ok(
    adminEnvironment.DATABASE_URL === process.env.DATABASE_URL,
    "Both servers must use the same QA database",
  );
}
const db = createDatabaseClient();

async function cleanup({ prefix, userIds, orgIds }) {
  assert.match(prefix, /^production-live-qa-\d+-[a-f0-9]{12}$/);
  assert.ok(
    Array.isArray(userIds) && userIds.length > 0 && userIds.length < 10,
  );
  assert.ok(Array.isArray(orgIds) && orgIds.length > 0 && orgIds.length < 10);
  assert.ok(
    [...userIds, ...orgIds].every(
      (id) =>
        typeof id === "string" &&
        id.startsWith(`${prefix}-`) &&
        /^[a-zA-Z0-9-]+$/.test(id),
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
        OR: userIds.flatMap((id) => [
          { key: { startsWith: "workspace:", endsWith: `:${id}` } },
          { key: { startsWith: "admin:", endsWith: `:${id}` } },
        ]),
      },
    }),
  ]);
}

if (values["cleanup-fixture-file"]) {
  try {
    const file = resolve(repositoryRoot, values["cleanup-fixture-file"]);
    await cleanup(JSON.parse(await readFile(file, "utf8")));
    await unlink(file);
    console.log(
      "CLEANUP removed only the retained production QA namespace and credential file",
    );
  } finally {
    await db.$disconnect();
  }
} else {
  const prefix = `production-live-qa-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const password = `Qa-${randomBytes(24).toString("base64url")}!`;
  const userIds = [],
    orgIds = [];
  const accounts = {};
  const privateMarker = `${prefix}-PRIVATE-ADMIN-NOTE`;
  const sourceMarker = `${prefix}-PRIVATE-AGENCY-SOURCE`;
  let step = "preflight",
    checks = 0,
    retain = false;
  let owner, member, outsider, agency, agencyMember, otherAgency, admin;
  let campaignId,
    guardCampaignId,
    browserCampaignId,
    browserProductionItemId,
    browserSubmissionId;
  let mainItem, proposalId, readyCampaignId, readyProductionItemId;
  const after = (days) => new Date(Date.now() + days * 86400000);

  async function call(
    path,
    { body, cookie, admin: adminRequest = false, origin } = {},
  ) {
    const target = adminRequest ? adminBase : base,
      requestOrigin = origin === undefined ? target.origin : origin;
    const response = await globalThis.fetch(new URL(path, target), {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      signal: globalThis.AbortSignal.timeout(60000),
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(requestOrigin
          ? {
              Origin: requestOrigin,
              "Sec-Fetch-Site":
                requestOrigin === target.origin ? "same-origin" : "cross-site",
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
  function expect(result, status) {
    if (result.response.status !== status)
      throw new Error(
        `HTTP ${result.response.status}; expected ${status}; code ${result.json?.code ?? "page"}`,
      );
  }
  function denied(result, statuses = [403, 404, 409]) {
    assert.ok(
      statuses.includes(result.response.status),
      "Operation must be denied",
    );
  }
  async function check(name, work) {
    step = name;
    await work();
    checks++;
    console.log(`PASS ${name}`);
  }
  function privateHeaders(result) {
    assert.match(result.response.headers.get("cache-control") ?? "", /private/);
    assert.match(
      result.response.headers.get("cache-control") ?? "",
      /no-store/,
    );
  }
  function brandSafe(result) {
    privateHeaders(result);
    for (const key of [
      "supplierOrganizationId",
      "supplierName",
      "internalNote",
      "agencyFeedback",
      "sourceTitle",
      "sourceUrl",
      "sourceNote",
      "submittedById",
      "adminReviewedById",
      "payloadHash",
    ])
      assert.ok(
        !result.text.includes(`"${key}"`),
        `Brand payload contains forbidden key ${key}`,
      );
    for (const value of [
      privateMarker,
      sourceMarker,
      agency?.orgId,
      otherAgency?.orgId,
    ].filter(Boolean))
      assert.ok(
        !result.text.includes(value),
        "Brand payload contains private fixture information",
      );
  }
  function agencySafe(result) {
    privateHeaders(result);
    assert.ok(!result.text.includes('"internalNote"'));
    assert.ok(!result.text.includes(privateMarker));
  }
  async function login(account, adminRequest = false) {
    let result = await call("/api/auth/sign-in/email", {
      body: { email: account.email, password },
      admin: adminRequest,
    });
    if (result.response.status === 429) {
      console.log("WAIT normal sign-in cooldown; no rate limit bypass");
      await delay(30500);
      await delay(30500);
      result = await call("/api/auth/sign-in/email", {
        body: { email: account.email, password },
        admin: adminRequest,
      });
    }
    expect(result, 200);
    const cookies = result.response.headers.getSetCookie();
    assert.ok(
      cookies.some((value) => value.split("=", 1)[0].endsWith("session_token")),
    );
    return cookies.map((value) => value.split(";", 1)[0]).join("; ");
  }
  async function fixture(
    label,
    {
      organizationId,
      type = "BRAND",
      role = "OWNER",
      admin: adminRequest = false,
    } = {},
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
            name: `제작 검수 QA · ${label}`,
            slug: orgId,
            type,
            status: "ACTIVE",
            countryCode: "KR",
            metadata: {
              industry: "gaming",
              companySize: "15–49",
              contactName: "QA 담당자",
              profileCompletedAt: new Date().toISOString(),
              ...(type === "AGENCY" ? { testWorkspaceAccess: true } : {}),
            },
          },
        });
      await tx.user.create({
        data: {
          id,
          email,
          name: "제작 검수 QA",
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
    const account = { userId: id, orgId, email };
    account.cookie = await login(account, adminRequest);
    accounts[label] = { email, userId: id, orgId };
    return account;
  }
  async function saveFixture() {
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
          adminUrl: adminBase.origin,
          password,
          accounts,
          campaignId,
          guardCampaignId,
          browserCampaignId,
          browserProductionItemId,
          browserSubmissionId,
          readyCampaignId,
          readyProductionItemId,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await chmod(file, 0o600);
    retain = true;
    console.log(
      "READY restricted production QA credential file saved; credentials are not logged",
    );
  }
  // Trusted fixture setup only: completed proposal approval is the input to this
  // integration suite. All production actions below use the real HTTP endpoints.
  async function approvedFixture(label, count = 1) {
    const id = `${prefix}-campaign-${label}`,
      proposal = `${prefix}-proposal-${label}`,
      now = new Date();
    await db.$transaction(async (tx) => {
      await tx.campaign.create({
        data: {
          id,
          brandOrganizationId: owner.orgId,
          createdById: owner.userId,
          type: "MANAGED",
          status: "IN_PROGRESS",
          title: `제작 검수 QA · ${label}`,
          summary: "격리된 제작·검수 기능 검증. 실제 제작·계약·지급 없음.",
          currency: "KRW",
          budgetAmount: "9000000.00",
          platforms: ["youtube"],
          regions: ["KR"],
          categories: ["gaming"],
          contentDeadline: after(30),
          requirements: {
            qaNamespace: prefix,
            brandBrief: {
              genre: "RPG",
              goal: "제작·검수 실제 API 통합 검증",
              contentFormat: "게임 소개 영상",
              creatorCount: count,
              desiredDate: after(30).toISOString().slice(0, 10),
              note: "격리 QA",
              compositionPreference: "balanced",
            },
          },
        },
      });
      await tx.campaignProposal.create({
        data: {
          id: proposal,
          campaignId: id,
          version: 1,
          revision: 3,
          status: "APPROVED",
          title: "QA 승인된 공식 제안",
          summary: "제작 검수 API의 사전 승인 fixture",
          terms: "내부 QA 전용. 실제 계약·지급·집행 없음.",
          currency: "KRW",
          expiresAt: after(10),
          publishedAt: now,
          publishedById: admin.userId,
          createdById: admin.userId,
          items: {
            create: Array.from({ length: count }, (_, index) => ({
              id: `${prefix}-proposal-item-${label}-${index}`,
              position: index,
              creatorName: `QA 가상 크리에이터 ${index + 1}`,
              platform: "youtube",
              channelLabel: "QA 채널",
              channelUrl: `https://www.youtube.com/@${prefix}-${index}`,
              followers: 10000,
              averageViews: 2000,
              deliverables: "게임 소개 영상 1편",
              quantity: 1,
              unitAmount: "1000000.00",
              scheduledAt: after(25),
              rights: "QA 전용 검토 범위",
              status: "APPROVED",
              supplierOrganizationId: index === 0 ? agency.orgId : null,
              supplierCost: "600000.00",
              internalNotes: privateMarker,
            })),
          },
          decisions: {
            create: {
              actorId: owner.userId,
              decision: "APPROVE",
              itemIds: Array.from(
                { length: count },
                (_, index) => `${prefix}-proposal-item-${label}-${index}`,
              ),
              message: "제작 검수 통합 테스트 사전 fixture 승인",
            },
          },
        },
      });
    });
    return { campaignId: id, proposalId: proposal };
  }
  const agencyBody = (item, version, changes = {}) => ({
    action: "submit",
    productionItemId: item.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    title: `${sourceMarker} · 제출 v${version}`,
    url: `https://www.youtube.com/watch?v=${prefix}-source-${version}`,
    note: `${sourceMarker} · 브랜드에 자동 전달하면 안 되는 원문 메모 ${version}`,
    ...changes,
  });
  const reviewBody = (item, changes = {}) => ({
    action: "releaseToBrand",
    campaignId: item.campaignId,
    productionItemId: item.id,
    submissionId: item.latestSubmission.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    title: `QA 브랜드 검토용 제작물 v${item.latestSubmission.version}`,
    url: `https://www.youtube.com/watch?v=${prefix}-released-${item.latestSubmission.version}`,
    note: "운영팀이 확인한 공개 검토 안내입니다.",
    internalNote: privateMarker,
    ...changes,
  });
  const brandBody = (item, changes = {}) => ({
    action: "approve",
    productionItemId: item.id,
    submissionId: item.latestSubmission.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    message: "QA 검토 승인",
    ...changes,
  });
  const adminMutation = (body, options = {}) =>
    call("/api/admin/production", {
      admin: true,
      cookie: admin.cookie,
      body,
      ...options,
    });
  const agencyMutation = (body, options = {}) =>
    call("/api/agency/production", { cookie: agency.cookie, body, ...options });
  const brandMutation = (body, options = {}) =>
    call("/api/brand/production", { cookie: owner.cookie, body, ...options });
  async function adminList(id = campaignId) {
    const result = await call(`/api/admin/production?campaignId=${id}`, {
      admin: true,
      cookie: admin.cookie,
    });
    expect(result, 200);
    privateHeaders(result);
    return result;
  }
  async function brandList(id = campaignId, cookie = owner.cookie) {
    const result = await call(`/api/brand/production?campaignId=${id}`, {
      cookie,
    });
    expect(result, 200);
    brandSafe(result);
    return result;
  }
  async function agencyList(cookie = agency.cookie) {
    const result = await call("/api/agency/production", { cookie });
    expect(result, 200);
    agencySafe(result);
    return result;
  }
  function updated(result, id = mainItem.id) {
    expect(result, 200);
    const item = result.json.items.find((value) => value.id === id);
    assert.ok(item);
    return item;
  }

  try {
    await check(
      "anonymous production endpoints deny reads and writes",
      async () => {
        expect(
          await call("/api/admin/production?campaignId=missing", {
            admin: true,
          }),
          401,
        );
        expect(await call("/api/agency/production"), 401);
        expect(await call("/api/brand/production?campaignId=missing"), 401);
      },
    );
    await check(
      "isolated brand, agency and admin roles authenticate normally",
      async () => {
        owner = await fixture("owner");
        member = await fixture("member", {
          organizationId: owner.orgId,
          role: "MEMBER",
        });
        outsider = await fixture("outsider");
        agency = await fixture("agency", { type: "AGENCY" });
        agencyMember = await fixture("agency-member", {
          organizationId: agency.orgId,
          type: "AGENCY",
          role: "MEMBER",
        });
        otherAgency = await fixture("other-agency", { type: "AGENCY" });
        admin = await fixture("admin", {
          type: "PLATFORM",
          role: "ADMIN",
          admin: true,
        });
        agency.adminCookie = await login(agency, true);
        await saveFixture();
      },
    );
    await check(
      "approved proposal tasks prepare once and support explicit supplier assignment",
      async () => {
        ({ campaignId, proposalId } = await approvedFixture("flow", 2));
        const prepare = {
          action: "prepare",
          campaignId,
          clientRequestId: randomUUID(),
        };
        const first = await adminMutation(prepare);
        expect(first, 200);
        assert.equal(first.json.items.length, 2);
        const replay = await adminMutation(prepare);
        expect(replay, 200);
        assert.equal(replay.json.items.length, 2);
        assert.equal(
          await db.productionItem.count({ where: { campaignId } }),
          2,
        );
        mainItem = first.json.items.find(
          (item) => item.supplierOrganizationId === agency.orgId,
        );
        assert.ok(mainItem);
        const unassigned = first.json.items.find(
          (item) => !item.supplierOrganizationId,
        );
        assert.ok(unassigned && unassigned.canAssign);
        const assign = {
          action: "assign",
          campaignId,
          productionItemId: unassigned.id,
          expectedRevision: unassigned.revision,
          clientRequestId: randomUUID(),
          supplierOrganizationId: agency.orgId,
        };
        const assigned = updated(await adminMutation(assign), unassigned.id);
        assert.equal(assigned.supplierOrganizationId, agency.orgId);
      readyCampaignId = campaignId;
      readyProductionItemId = assigned.id;
        expect(await adminMutation(assign), 200);
        expect(
          await adminMutation({
            ...assign,
            expectedRevision: unassigned.revision,
            clientRequestId: randomUUID(),
          }),
          409,
        );
        expect(
          await call(`/api/admin/production?campaignId=${campaignId}`, {
            admin: true,
            cookie: agency.adminCookie,
          }),
          403,
        );
        const brand = await brandList();
        assert.equal(brand.json.items.length, 2);
        assert.ok(
          brand.json.items.every((item) => item.submissions.length === 0),
        );
      },
    );
    await check(
      "tenant, member, origin and unsafe-link submission guards hold",
      async () => {
        const ownAgency = await agencyList();
        assert.ok(ownAgency.json.items.some((item) => item.id === mainItem.id));
        const foreignAgency = await agencyList(otherAgency.cookie);
        assert.ok(
          !foreignAgency.json.items.some((item) => item.id === mainItem.id),
        );
        const readOnly = await agencyList(agencyMember.cookie);
        assert.ok(readOnly.json.items.every((item) => !item.canSubmit));
        expect(
          await agencyMutation(agencyBody(mainItem, 1), {
            cookie: agencyMember.cookie,
          }),
          403,
        );
        denied(
          await agencyMutation(agencyBody(mainItem, 1), {
            cookie: otherAgency.cookie,
          }),
          [403, 404],
        );
        denied(
          await agencyMutation(agencyBody(mainItem, 1), {
            cookie: owner.cookie,
          }),
          [403, 404],
        );
        expect(
          await agencyMutation(agencyBody(mainItem, 1), {
            origin: "https://foreign.example.com",
          }),
          403,
        );
        expect(
          await agencyMutation(
            agencyBody(mainItem, 1, { url: "https://127.0.0.1/private" }),
          ),
          400,
        );
        const outside = await call(
          `/api/brand/production?campaignId=${campaignId}`,
          { cookie: outsider.cookie },
        );
        if (outside.response.status === 200) {
          brandSafe(outside);
          assert.deepEqual(outside.json.items, []);
        } else expect(outside, 404);
      },
    );
    await check(
      "agency source submission persists but remains hidden from brand",
      async () => {
        const body = agencyBody(mainItem, 1),
          submitted = await agencyMutation(body);
        expect(submitted, 200);
        agencySafe(submitted);
        mainItem = submitted.json.item;
        assert.equal(mainItem.status, "ADMIN_REVIEW");
        const replay = await agencyMutation(body);
        expect(replay, 200);
        assert.equal(
          replay.json.item.latestSubmission.id,
          mainItem.latestSubmission.id,
        );
        assert.equal(
          await db.productionSubmission.count({
            where: { productionItemId: mainItem.id },
          }),
          1,
        );
        expect(
          await agencyMutation({ ...body, title: "Different retry payload" }),
          409,
        );
        expect(
          await agencyMutation({ ...body, clientRequestId: randomUUID() }),
          409,
        );
        const adminRead = await adminList();
        assert.ok(adminRead.text.includes(sourceMarker));
        mainItem = adminRead.json.items.find((item) => item.id === mainItem.id);
        const brand = await brandList();
        assert.equal(
          brand.json.items.find((item) => item.id === mainItem.id).submissions
            .length,
          0,
        );
        const detail = await call(`/api/brand/campaigns/${campaignId}`, {
          cookie: owner.cookie,
        });
        expect(detail, 200);
        brandSafe(detail);
        denied(await brandMutation(brandBody(mainItem)), [404, 409]);
      },
    );
    await check(
      "admin agency-revision feedback stays separate from internal notes",
      async () => {
        const body = {
          action: "requestChanges",
          campaignId,
          productionItemId: mainItem.id,
          submissionId: mainItem.latestSubmission.id,
          expectedRevision: mainItem.revision,
          clientRequestId: randomUUID(),
          agencyFeedback: "인트로 첫 장면의 자막을 수정해 주세요.",
          internalNote: privateMarker,
        };
        mainItem = updated(await adminMutation(body));
        assert.equal(mainItem.status, "AGENCY_REVISION");
        expect(await adminMutation(body), 200);
        const agencyRead = await agencyList();
        assert.ok(agencyRead.text.includes(body.agencyFeedback));
        const brand = await brandList();
        assert.ok(!brand.text.includes(body.agencyFeedback));
        assert.equal(
          brand.json.items.find((item) => item.id === mainItem.id).submissions
            .length,
          0,
        );
      },
    );
    await check(
      "resubmission is immutable and explicit admin release exposes only curated fields",
      async () => {
        const second = await agencyMutation(agencyBody(mainItem, 2));
        expect(second, 200);
        mainItem = second.json.item;
        mainItem = (await adminList()).json.items.find(
          (item) => item.id === mainItem.id,
        );
        assert.equal(mainItem.latestSubmission.version, 2);
        const release = reviewBody(mainItem),
          released = await adminMutation(release);
        mainItem = updated(released);
        assert.equal(mainItem.status, "BRAND_REVIEW");
        expect(await adminMutation(release), 200);
        expect(
          await adminMutation({ ...release, clientRequestId: randomUUID() }),
          409,
        );
        const brand = await brandList(),
          item = brand.json.items.find((value) => value.id === mainItem.id);
        assert.equal(item.submissions.length, 1);
        assert.equal(item.latestSubmission.title, release.title);
        assert.equal(item.latestSubmission.url, release.url);
        assert.equal(item.latestSubmission.note, release.note);
        assert.equal(item.canRespond, true);
        assert.equal(
          (
            await db.productionSubmission.findUniqueOrThrow({
              where: { id: mainItem.latestSubmission.id },
            })
          ).sourceTitle,
          `${sourceMarker} · 제출 v2`,
        );
        expect(
          await adminMutation({
            action: "assign",
            campaignId,
            productionItemId: mainItem.id,
            expectedRevision: mainItem.revision,
            clientRequestId: randomUUID(),
            supplierOrganizationId: otherAgency.orgId,
          }),
          409,
        );
      },
    );
    await check(
      "brand reviewer permissions and optimistic decisions are enforced",
      async () => {
        const readonly = await brandList(campaignId, member.cookie);
        assert.equal(
          readonly.json.items.find((item) => item.id === mainItem.id)
            .canRespond,
          false,
        );
        expect(
          await brandMutation(brandBody(mainItem), { cookie: member.cookie }),
          403,
        );
        denied(
          await brandMutation(brandBody(mainItem), { cookie: outsider.cookie }),
          [403, 404],
        );
        expect(
          await brandMutation(brandBody(mainItem), {
            origin: "https://foreign.example.com",
          }),
          403,
        );
        expect(
          await brandMutation(
            brandBody(mainItem, { expectedRevision: mainItem.revision - 1 }),
          ),
          409,
        );
        expect(
          await brandMutation(
            brandBody(mainItem, { action: "requestChanges", message: "" }),
          ),
          400,
        );
        const body = brandBody(mainItem, {
            action: "requestChanges",
            message: "브랜드 표기를 3초 이상 유지해 주세요.",
          }),
          changes = await brandMutation(body);
        expect(changes, 200);
        brandSafe(changes);
        assert.equal(changes.json.item.status, "BRAND_REVISION");
        expect(await brandMutation(body), 200);
        mainItem = (await adminList()).json.items.find(
          (item) => item.id === mainItem.id,
        );
        assert.equal(
          mainItem.latestSubmission.brandDecision,
          "REQUEST_CHANGES",
        );
      },
    );
    await check(
      "new unreleased source stays hidden while old released history remains readable",
      async () => {
        const third = await agencyMutation(agencyBody(mainItem, 3));
        expect(third, 200);
        mainItem = third.json.item;
        const brand = await brandList(),
          item = brand.json.items.find((value) => value.id === mainItem.id);
        assert.equal(item.submissions.length, 1);
        assert.equal(item.latestSubmission.version, 2);
        assert.equal(item.canRespond, false);
        assert.ok(!brand.text.includes(`${prefix}-source-3`));
        denied(
          await brandMutation({
            ...brandBody(mainItem),
            submissionId: mainItem.latestSubmission.id,
          }),
          [404, 409],
        );
      },
    );
    await check(
      "approved proposal expiry does not stop production and final brand approval locks the version",
      async () => {
        await db.campaignProposal.update({
          where: { id: proposalId, campaignId },
          data: { expiresAt: new Date(Date.now() - 60000) },
        });
        mainItem = (await adminList()).json.items.find(
          (item) => item.id === mainItem.id,
        );
        const release = reviewBody(mainItem);
        mainItem = updated(await adminMutation(release));
        const oldSubmission = mainItem.submissions.find(
          (item) => item.version === 2,
        );
        expect(
          await brandMutation(
            brandBody(mainItem, { submissionId: oldSubmission.id }),
          ),
          409,
        );
        const body = brandBody(mainItem),
          approved = await brandMutation(body);
        expect(approved, 200);
        brandSafe(approved);
        assert.equal(approved.json.item.status, "APPROVED");
        expect(await brandMutation(body), 200);
        expect(
          await brandMutation({ ...body, clientRequestId: randomUUID() }),
          409,
        );
        mainItem = (await adminList()).json.items.find(
          (item) => item.id === mainItem.id,
        );
        expect(await agencyMutation(agencyBody(mainItem, 4)), 409);
        expect(
          await adminMutation({
            action: "requestChanges",
            campaignId,
            productionItemId: mainItem.id,
            submissionId: mainItem.latestSubmission.id,
            expectedRevision: mainItem.revision,
            clientRequestId: randomUUID(),
            agencyFeedback: "승인 후 우회 수정 시도",
            internalNote: "",
          }),
          409,
        );
        const stored = await db.productionSubmission.findMany({
          where: { productionItemId: mainItem.id },
          orderBy: { version: "asc" },
        });
        assert.equal(stored.length, 3);
        assert.ok(
          stored.every(
            (row, index) =>
              row.sourceTitle === `${sourceMarker} · 제출 v${index + 1}`,
          ),
        );
        assert.equal(stored[1].brandDecision, "REQUEST_CHANGES");
        assert.equal(stored[2].brandDecision, "APPROVE");
        const brand = await brandList();
        assert.equal(
          brand.json.items.find((item) => item.id === mainItem.id).submissions
            .length,
          2,
        );
      },
    );
    await check(
      "legacy direct content approval cannot bypass official production",
      async () => {
        const application = await db.campaignApplication.create({
          data: {
            campaignId,
            agencyOrganizationId: agency.orgId,
            submittedById: agency.userId,
            status: "ACCEPTED",
            proposal: "QA legacy bypass fixture",
            currency: "KRW",
          },
        });
        const legacy = await db.contentSubmission.create({
          data: {
            applicationId: application.id,
            version: 1,
            status: "SUBMITTED",
            draftUrl: "https://www.youtube.com/watch?v=legacy-production-qa",
            submittedAt: new Date(),
          },
        });
        const adminWrite = await call("/api/admin/campaign-operations", {
          admin: true,
          cookie: admin.cookie,
          body: {
            action: "reviewContent",
            campaignId,
            applicationId: application.id,
            submissionId: legacy.id,
            expectedUpdatedAt: legacy.updatedAt.toISOString(),
            status: "APPROVED",
            reason: "QA 우회 차단 검사",
          },
        });
        expect(adminWrite, 409);
        assert.equal(adminWrite.json.code, "OFFICIAL_PRODUCTION_REQUIRED");
        const agencyWrite = await call("/api/agency/content-submissions", {
          cookie: agency.cookie,
          body: {
            action: "submitDraft",
            applicationId: application.id,
            expectedSubmissionId: legacy.id,
            expectedUpdatedAt: legacy.updatedAt.toISOString(),
            url: "https://www.youtube.com/watch?v=legacy-production-next",
          },
        });
        expect(agencyWrite, 409);
        assert.equal(agencyWrite.json.code, "OFFICIAL_PRODUCTION_REQUIRED");
        assert.equal(
          (
            await db.contentSubmission.findUniqueOrThrow({
              where: { id: legacy.id },
            })
          ).status,
          "SUBMITTED",
        );
        assert.equal(
          await db.contentSubmission.count({
            where: { applicationId: application.id },
          }),
          1,
        );
      },
    );
    await check(
      "closed campaigns, unapproved and superseded proposals deny writes",
      async () => {
        const guard = await approvedFixture("guard");
        guardCampaignId = guard.campaignId;
        const prepared = await adminMutation({
          action: "prepare",
          campaignId: guardCampaignId,
          clientRequestId: randomUUID(),
        });
        expect(prepared, 200);
        let item = prepared.json.items[0];
        const submitted = await agencyMutation(agencyBody(item, 1));
        expect(submitted, 200);
        item = (await adminList(guardCampaignId)).json.items[0];
        await db.campaign.update({
          where: { id: guardCampaignId, brandOrganizationId: owner.orgId },
          data: { status: "CANCELED" },
        });
        denied(await adminMutation(reviewBody(item)), [409]);
        await db.campaign.update({
          where: { id: guardCampaignId, brandOrganizationId: owner.orgId },
          data: { status: "IN_PROGRESS" },
        });
        await db.campaignProposal.update({
          where: { id: guard.proposalId, campaignId: guardCampaignId },
          data: { status: "PUBLISHED" },
        });
        denied(await adminMutation(reviewBody(item)), [409]);
        await db.campaignProposal.update({
          where: { id: guard.proposalId, campaignId: guardCampaignId },
          data: { status: "APPROVED" },
        });
        item = updated(await adminMutation(reviewBody(item)), item.id);
        await db.campaign.update({
          where: { id: guardCampaignId, brandOrganizationId: owner.orgId },
          data: { status: "CANCELED" },
        });
        expect(await brandMutation(brandBody(item)), 409);
        await db.campaign.update({
          where: { id: guardCampaignId, brandOrganizationId: owner.orgId },
          data: { status: "IN_PROGRESS" },
        });
        await db.campaignProposal.update({
          where: { id: guard.proposalId, campaignId: guardCampaignId },
          data: { status: "SUPERSEDED", supersededAt: new Date() },
        });
        expect(await brandMutation(brandBody(item)), 409);
        assert.equal(
          (
            await db.productionItem.findUniqueOrThrow({
              where: { id: item.id },
            })
          ).status,
          "BRAND_REVIEW",
        );
      },
    );
    await check("revoked agency sessions cannot read production", async () => {
      await db.session.deleteMany({ where: { userId: agencyMember.userId } });
      expect(
        await call("/api/agency/production", { cookie: agencyMember.cookie }),
        401,
      );
    });
    if (values["browser-fixture-file"])
      await check(
        "one unreleased production submission is retained for browser review",
        async () => {
          const fixture = await approvedFixture("browser-review");
          browserCampaignId = fixture.campaignId;
          const result = await adminMutation({
            action: "prepare",
            campaignId: browserCampaignId,
            clientRequestId: randomUUID(),
          });
          expect(result, 200);
          const submitted = await agencyMutation(
            agencyBody(result.json.items[0], 1),
          );
          expect(submitted, 200);
          browserProductionItemId = submitted.json.item.id;
          browserSubmissionId = submitted.json.item.latestSubmission.id;
          await saveFixture();
        },
      );
    console.log(`PASS ${checks} real HTTP/database production checks`);
  } catch (error) {
    process.exitCode = 1;
    const detail =
      error instanceof assert.AssertionError
        ? "assertion failed (private values omitted)"
        : /^HTTP \d+; expected \d+; code [A-Z_]+$/.test(error?.message ?? "")
          ? error.message
          : (error?.name ?? "Error");
    console.error(`FAIL ${step}: ${detail}`);
    if (values["browser-fixture-file"] && owner && admin) await saveFixture();
  } finally {
    try {
      if (!retain && userIds.length) {
        await cleanup({ prefix, userIds, orgIds });
        console.log(
          "CLEANUP removed this run's isolated production QA namespace",
        );
      }
    } catch {
      process.exitCode = 1;
      console.error(`CLEANUP FAILED for isolated prefix ${prefix}`);
    }
    await db.$disconnect();
  }
}
