import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// This integration check creates its own isolated tenants and signs in through
// the real auth endpoints. It never reads or modifies named product accounts.
// The user requested that QA data remain available. This script never deletes it.
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
    "browser-fixture-file": {
      type: "string",
      default: "tmp/settlement-qa.json",
    },
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
const fixtureFile = resolve(repositoryRoot, values["browser-fixture-file"]);
try {
  await readFile(fixtureFile);
  throw new Error(
    "Refusing to overwrite a retained QA credential file; choose a new path.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const db = createDatabaseClient();

const prefix = `settlement-live-qa-${Date.now()}-${randomBytes(6).toString("hex")}`;
const password = `Qa-${randomBytes(24).toString("base64url")}!`;
const userIds = [],
  orgIds = [],
  accounts = {};
const privateMarker = `${prefix}-PRIVATE-ADMIN-NOTE`;
const sourceMarker = `${prefix}-PRIVATE-AGENCY-SOURCE`;
let step = "preflight",
  checks = 0;
let owner, member, outsider, agency, agencyMember, otherAgency, admin;
let campaignId,
  guardCampaignId,
  browserCampaignId,
  readyCampaignId,
  brandInvoiceId;
const agencyPayoutIds = [];
const after = (days) => new Date(Date.now() + days * 86400000);
async function call(
  path,
  {
    body,
    cookie,
    admin: adminRequest = false,
    origin,
    allowCooldown = true,
  } = {},
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
  if (
    response.status === 429 &&
    path === "/api/admin/settlement" &&
    allowCooldown
  ) {
    console.log(
      "WAIT normal settlement write cooldown; retry uses the same request ID",
    );
    await delay(30500);
    await delay(30500);
    return call(path, {
      body,
      cookie,
      admin: adminRequest,
      origin,
      allowCooldown: false,
    });
  }
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
  completedChecks.push(name);
  console.log(`PASS ${name}`);
}
function privateHeaders(result) {
  assert.match(result.response.headers.get("cache-control") ?? "", /private/);
  assert.match(result.response.headers.get("cache-control") ?? "", /no-store/);
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
    "sourceMetrics",
    "sourcePostUrl",
    "sourceEvidenceUrl",
    "sourceMetricsAsOf",
    "sourcePublishedAt",
    "releasedSnapshot",
    "submittedById",
    "adminReviewedById",
    "payloadHash",
    "externalPaymentReference",
    "supplierCost",
    "supplierCostBasis",
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
          name: `완료 정산 QA · ${label}`,
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
        name: "완료 정산 QA",
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
  accounts[label] = { email, userId: id, orgId };
  await saveFixture();
  account.cookie = await login(account, adminRequest);
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
        readyCampaignId,
        brandInvoiceId,
        agencyPayoutIds,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await chmod(file, 0o600);

  console.log(
    "READY restricted settlement QA credential file saved; credentials are not logged",
  );
}
// Trusted fixture setup only: completed proposal approval is the input to this
// integration suite. All reporting actions below use the real HTTP endpoints.
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
        title: `완료 정산 QA · ${label}`,
        summary: "격리된 완료·정산 기능 검증. 실제 제작·계약·지급 없음.",
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
            goal: "완료·정산 실제 API 통합 검증",
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
        summary: "완료 정산 API의 사전 승인 fixture",
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
            supplierOrganizationId: agency.orgId,
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
            message: "완료 정산 통합 테스트 사전 fixture 승인",
          },
        },
      },
    });
  });
  return { campaignId: id, proposalId: proposal };
}

// Trusted input fixtures model content approval that precedes this workflow.
async function approvedContentFixture(label, count = 1) {
  const fixture = await approvedFixture(label, count);
  const ids = [];
  for (let index = 0; index < count; index++) {
    const id = `${prefix}-production-${label}-${index}`;
    ids.push(id);
    await db.productionItem.create({
      data: {
        id,
        campaignId: fixture.campaignId,
        proposalItemId: `${prefix}-proposal-item-${label}-${index}`,
        supplierOrganizationId: agency.orgId,
        assignedById: admin.userId,
        status: "APPROVED",
        revision: 4,
        submissions: {
          create: {
            version: 1,
            status: "APPROVED",
            sourceTitle: `${sourceMarker}-content`,
            sourceUrl: "https://www.youtube.com/watch?v=qa-content-source",
            sourceNote: sourceMarker,
            submittedById: agency.userId,
            adminReviewedById: admin.userId,
            adminReviewedAt: after(-3),
            internalNote: privateMarker,
            releasedTitle: "QA 승인된 콘텐츠",
            releasedUrl: "https://www.youtube.com/watch?v=qa-content-approved",
            releasedNote: "QA 입력 fixture",
            releasedAt: after(-3),
            brandDecision: "APPROVE",
            brandDecidedById: owner.userId,
            brandDecidedAt: after(-2),
          },
        },
      },
    });
  }
  return { ...fixture, productionIds: ids };
}
const emptyMetrics = () => ({
  views: null,
  impressions: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  clicks: null,
});
async function readyFixture(label) {
  const fixture = await approvedContentFixture(label, 2);
  await db.campaign.update({
    where: { id: fixture.campaignId },
    data: { budgetAmount: "9999999999999999.99" },
  });
  await db.proposalItem.update({
    where: { id: `${prefix}-proposal-item-${label}-0` },
    data: {
      quantity: 3,
      unitAmount: "9007199254740.91",
      supplierCost: "600000.01",
    },
  });
  await db.proposalItem.update({
    where: { id: `${prefix}-proposal-item-${label}-1` },
    data: { quantity: 2, unitAmount: "0.10", supplierCost: "700000.02" },
  });
  await db.productionItem.update({
    where: { id: fixture.productionIds[1] },
    data: { supplierOrganizationId: otherAgency.orgId },
  });
  for (const [index, productionItemId] of fixture.productionIds.entries()) {
    await db.reportingItem.create({
      data: {
        id: `${prefix}-reporting-${label}-${index}`,
        campaignId: fixture.campaignId,
        productionItemId,
        status: "PUBLISHED",
        revision: 2,
        submissions: {
          create: {
            version: 1,
            status: "PUBLISHED",
            sourceTitle: sourceMarker,
            sourcePostUrl: `https://www.youtube.com/watch?v=${prefix}-private-${index}`,
            sourcePublishedAt: after(-2),
            sourceMetrics: emptyMetrics(),
            sourceNote: sourceMarker,
            submittedById: agency.userId,
            adminReviewedById: admin.userId,
            adminReviewedAt: after(-1),
            internalNote: privateMarker,
            releasedTitle: "QA 공개된 성과",
            releasedPostUrl: `https://www.youtube.com/watch?v=${prefix}-public-${index}`,
            releasedPublishedAt: after(-2),
            releasedMetrics: emptyMetrics(),
            releasedNote: "QA 공개 안내",
            releasedAt: after(-1),
          },
        },
      },
    });
  }
  return fixture;
}
const adminMutation = (body, options = {}) =>
  call("/api/admin/settlement", {
    admin: true,
    cookie: admin.cookie,
    body,
    ...options,
  });
async function adminList(id = campaignId) {
  const result = await call(`/api/admin/settlement?campaignId=${id}`, {
    admin: true,
    cookie: admin.cookie,
  });
  expect(result, 200);
  privateHeaders(result);
  return result.json;
}
async function brandList(id = campaignId, cookie = owner.cookie) {
  const result = await call(`/api/brand/settlement?campaignId=${id}`, {
    cookie,
  });
  expect(result, 200);
  brandSafe(result);
  assert.ok(!result.text.includes('"payouts"'));
  assert.ok(!result.text.includes('"itemTotalAmount"'));
  return result.json;
}
async function agencyList(cookie = agency.cookie, id = campaignId) {
  const result = await call(`/api/agency/settlement?campaignId=${id}`, {
    cookie,
  });
  expect(result, 200);
  agencySafe(result);
  for (const key of [
    '"invoices"',
    '"unitAmount"',
    '"lineAmount"',
    '"brandTotalAmount"',
    '"externalPaymentReference"',
    '"supplierOrganizationId"',
  ])
    assert.ok(
      !result.text.includes(key),
      "Agency settlement must omit private/brand fields",
    );
  return result.json;
}
const completeBody = (value) => ({
  action: "completeCampaign",
  campaignId: value.campaignId,
  clientRequestId: randomUUID(),
  expectedReadinessToken: value.readinessToken,
  note: "전체 콘텐츠와 최신 성과 공개 완료 · 격리 QA",
});
const prepareBody = (value) => ({
  action: "prepare",
  campaignId: value.campaignId,
  clientRequestId: randomUUID(),
  completionId: value.completion.id,
  supplierCostBasis: "ITEM_TOTAL",
});
const documentBody = (document, action, data) => ({
  action,
  campaignId: document.campaignId,
  ...(action.includes("Brand")
    ? { invoiceId: document.id }
    : { payoutId: document.id }),
  expectedRevision: document.revision,
  clientRequestId: randomUUID(),
  ...(data ? { data } : {}),
});
const documentInput = (label) => ({
  title: `QA ${label} 문서`,
  note: `수신 조직에 공개할 ${label} 안내`,
  dueAt: after(10).toISOString(),
  documentUrl: `https://example.com/${prefix}/public-document`,
  internalNote: `${privateMarker} ${label}`,
});
const paymentInput = (document, changes = {}) => ({
  amount: document.amount,
  currency: document.currency,
  paidAt: new Date().toISOString(),
  reference: `${prefix}-PRIVATE-PAYMENT-REFERENCE`,
  internalNote: `${privateMarker} PAYMENT`,
  ...changes,
});
let current, mainFixture;
const completedChecks = [];
try {
  await check("anonymous settlement endpoints deny reads", async () => {
    expect(
      await call("/api/admin/settlement?campaignId=missing", { admin: true }),
      401,
    );
    expect(await call("/api/brand/settlement"), 401);
    expect(await call("/api/agency/settlement"), 401);
  });
  await check(
    "isolated brand, supplier and platform roles authenticate",
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
      owner.adminCookie = await login(owner, true);
    },
  );
  await check(
    "read-only readiness uses approved content and latest public reports",
    async () => {
      mainFixture = await readyFixture("flow");
      campaignId = mainFixture.campaignId;
      current = await adminList();
      assert.equal(current.canComplete, true);
      assert.equal(current.completion, null);
      assert.equal(current.invoice, null);
      assert.equal(current.payouts.length, 0);
      assert.equal(
        await db.campaignCompletion.count({ where: { campaignId } }),
        0,
      );
      assert.equal((await brandList()).invoices.length, 0);
      assert.equal((await agencyList()).payouts.length, 0);
      await saveFixture();
    },
  );
  await check(
    "role, tenant and origin boundaries block unauthorized transitions",
    async () => {
      const body = completeBody(current);
      expect(await adminMutation(body, { cookie: agency.adminCookie }), 403);
      expect(await adminMutation(body, { cookie: owner.adminCookie }), 403);
      expect(
        await adminMutation(body, { origin: "https://untrusted.example" }),
        403,
      );
      const foreign = await call(
        `/api/brand/settlement?campaignId=${campaignId}`,
        { cookie: outsider.cookie },
      );
      denied(foreign, [403, 404]);
      await brandList(campaignId, member.cookie);
      await agencyList(agencyMember.cookie);
      expect(
        await call("/api/brand/settlement", { cookie: owner.cookie, body }),
        405,
      );
      expect(
        await call("/api/agency/settlement", { cookie: agency.cookie, body }),
        405,
      );
    },
  );
  await check(
    "new private reporting blocks completion and invalidates readiness tokens",
    async () => {
      const previous = completeBody(current);
      const reportingId = `${prefix}-reporting-flow-0`;
      await db.reportingItem.update({
        where: { id: reportingId },
        data: {
          status: "ADMIN_REVIEW",
          revision: { increment: 1 },
          submissions: {
            create: {
              version: 2,
              status: "ADMIN_REVIEW",
              sourceTitle: sourceMarker,
              sourcePostUrl:
                "https://www.youtube.com/watch?v=qa-latest-private",
              sourcePublishedAt: after(-1),
              sourceMetrics: emptyMetrics(),
              sourceNote: sourceMarker,
              submittedById: agency.userId,
            },
          },
        },
      });
      current = await adminList();
      assert.equal(current.canComplete, false);
      expect(await adminMutation(previous), 409);
      expect(await adminMutation(completeBody(current)), 409);
      const reporting = await call(
        `/api/admin/reporting?campaignId=${campaignId}`,
        { admin: true, cookie: admin.cookie },
      );
      expect(reporting, 200);
      const item = reporting.json.items.find(
        (value) => value.id === reportingId,
      );
      expect(
        await call("/api/admin/reporting", {
          admin: true,
          cookie: admin.cookie,
          body: {
            action: "releaseToBrand",
            campaignId,
            reportingItemId: item.id,
            submissionId: item.latestSubmission.id,
            expectedRevision: item.revision,
            clientRequestId: randomUUID(),
            data: {
              title: "QA 최신 성과 공개",
              postUrl: "https://www.youtube.com/watch?v=qa-latest-public",
              publishedAt: after(-1).toISOString(),
              metricsAsOf: null,
              metrics: emptyMetrics(),
              evidenceUrl: null,
              note: "집계 중인 지표도 최종 검토 완료",
            },
            internalNote: privateMarker,
          },
        }),
        200,
      );
      expect(await adminMutation(previous), 409);
      current = await adminList();
      assert.equal(current.canComplete, true);
    },
  );
  await check(
    "unapproved content and incomplete proposals block completion",
    async () => {
      const fixture = await readyFixture("guards");
      guardCampaignId = fixture.campaignId;
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "BRAND_REVIEW" },
      });
      let guard = await adminList(guardCampaignId);
      assert.equal(guard.canComplete, false);
      expect(await adminMutation(completeBody(guard)), 409);
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "APPROVED" },
      });
      await db.campaignProposal.update({
        where: { id: fixture.proposalId },
        data: { status: "PUBLISHED" },
      });
      guard = await adminList(guardCampaignId);
      assert.equal(guard.canComplete, false);
      expect(await adminMutation(completeBody(guard)), 409);
      await db.campaignProposal.update({
        where: { id: fixture.proposalId },
        data: { status: "APPROVED" },
      });
      await db.campaign.update({
        where: { id: guardCampaignId },
        data: { status: "CANCELED" },
      });
      guard = await adminList(guardCampaignId);
      assert.equal(guard.canComplete, false);
      expect(await adminMutation(completeBody(guard)), 409);
    },
  );
  await check(
    "legacy settlement preparation cannot bypass official completion",
    async () => {
      const application = await db.campaignApplication.create({
        data: {
          campaignId,
          agencyOrganizationId: agency.orgId,
          submittedById: agency.userId,
          status: "ACCEPTED",
          proposal: "QA legacy guard",
          currency: "KRW",
        },
      });
      const result = await call("/api/admin/campaign-operations", {
        admin: true,
        cookie: admin.cookie,
        body: {
          action: "prepareSettlement",
          campaignId,
          applicationId: application.id,
          expectedVersion: null,
          grossAmount: "100.00",
          platformFeeAmount: "0.00",
          withholdingAmount: "0.00",
          reason: "격리 QA 기존 우회 검사",
        },
      });
      expect(result, 409);
      assert.equal(result.json.code, "OFFICIAL_SETTLEMENT_REQUIRED");
      assert.equal(
        await db.settlement.count({ where: { applicationId: application.id } }),
        0,
      );
    },
  );
  await check(
    "missing, zero or negative costs and invalid financial scope block completion",
    async () => {
      const itemId = `${prefix}-proposal-item-flow-0`;
      for (const supplierCost of [null, "0.00", "-1.00"]) {
        await db.proposalItem.update({
          where: { id: itemId },
          data: { supplierCost },
        });
        current = await adminList();
        assert.equal(current.canComplete, false);
        const result = await adminMutation(completeBody(current));
        expect(result, 409);
        assert.equal(result.json.code, "COMPLETION_NOT_READY");
      }
      await db.proposalItem.update({
        where: { id: itemId },
        data: { supplierCost: "600000.01" },
      });
      await db.productionItem.update({
        where: { id: mainFixture.productionIds[0] },
        data: { supplierOrganizationId: null },
      });
      current = await adminList();
      assert.equal(current.canComplete, false);
      expect(await adminMutation(completeBody(current)), 409);
      await db.productionItem.update({
        where: { id: mainFixture.productionIds[0] },
        data: { supplierOrganizationId: agency.orgId },
      });
      await db.campaignProposal.update({
        where: { id: mainFixture.proposalId },
        data: { currency: "USD" },
      });
      current = await adminList();
      assert.equal(current.canComplete, false);
      expect(await adminMutation(completeBody(current)), 409);
      await db.campaignProposal.update({
        where: { id: mainFixture.proposalId },
        data: { currency: "KRW" },
      });
      assert.equal(
        await db.campaignCompletion.count({ where: { campaignId } }),
        0,
      );
      current = await adminList();
      assert.equal(current.canComplete, true);
    },
  );
  await check(
    "explicit completion is idempotent and locks further delivery changes",
    async () => {
      current = await adminList();
      const body = completeBody(current);
      const result = await adminMutation(body);
      expect(result, 200);
      current = result.json;
      assert.equal(current.campaignStatus, "COMPLETED");
      assert.ok(current.completion);
      assert.equal(current.canComplete, false);
      expect(await adminMutation(body), 200);
      expect(
        await adminMutation({ ...body, note: "different completion note" }),
        409,
      );
      assert.equal(
        await db.campaignCompletion.count({ where: { campaignId } }),
        1,
      );
      const reporting = await call(
        `/api/agency/reporting?campaignId=${campaignId}`,
        { cookie: agency.cookie },
      );
      expect(reporting, 200);
      assert.equal(reporting.json.items[0].canSubmit, false);
    },
  );
  await check(
    "financial preparation requires the recorded completion and explicit item-total basis",
    async () => {
      current = await adminList();
      expect(
        await adminMutation({
          ...prepareBody(current),
          completionId: `${prefix}-wrong-completion`,
        }),
        409,
      );
      expect(
        await adminMutation({
          ...prepareBody(current),
          supplierCostBasis: "UNIT_PRICE",
        }),
        400,
      );
      assert.equal(await db.brandInvoice.count({ where: { campaignId } }), 0);
      assert.equal(await db.agencyPayout.count({ where: { campaignId } }), 0);
      assert.equal(current.canPrepare, true);
    },
  );
  await check(
    "exact decimal totals preserve supplier item-total semantics and recipient scope",
    async () => {
      const body = prepareBody(current);
      const first = await adminMutation(body);
      expect(first, 200);
      current = first.json;
      expect(await adminMutation(body), 200);
      assert.equal(current.invoice.amount, "27021597764222.93");
      assert.equal(current.totalSupplierAmount, "1300000.03");
      assert.equal(current.payouts.length, 2);
      assert.equal(
        current.payouts.find(
          (value) => value.supplierOrganizationId === agency.orgId,
        ).amount,
        "600000.01",
      );
      assert.equal(
        current.payouts.find(
          (value) => value.supplierOrganizationId === otherAgency.orgId,
        ).amount,
        "700000.02",
      );
      assert.equal(current.invoice.lines[0].lineAmount, "27021597764222.73");
      brandInvoiceId = current.invoice.id;
      agencyPayoutIds.push(...current.payouts.map((value) => value.id));
      assert.equal((await brandList()).invoices.length, 0);
      assert.equal((await agencyList()).payouts.length, 0);
      assert.equal((await agencyList(otherAgency.cookie)).payouts.length, 0);
      assert.equal(await db.brandInvoice.count({ where: { campaignId } }), 1);
      assert.equal(await db.agencyPayout.count({ where: { campaignId } }), 2);
      await saveFixture();
    },
  );
  await check(
    "draft content saves privately and stale or financial-field tampering fails",
    async () => {
      const invoice = current.invoice,
        input = documentInput("브랜드 청구");
      const body = documentBody(invoice, "saveBrandInvoice", input);
      const saved = await adminMutation(body);
      expect(saved, 200);
      current = saved.json;
      expect(await adminMutation(body), 200);
      expect(
        await adminMutation({ ...body, clientRequestId: randomUUID() }),
        409,
      );
      expect(
        await adminMutation({
          ...documentBody(current.invoice, "saveBrandInvoice", input),
          data: { ...input, amount: "1.00" },
        }),
        400,
      );
      expect(
        await adminMutation(
          documentBody(current.invoice, "saveBrandInvoice", {
            ...input,
            documentUrl: "http://127.0.0.1/private",
          }),
        ),
        400,
      );
      for (const payout of current.payouts) {
        const result = await adminMutation(
          documentBody(
            payout,
            "saveAgencyPayout",
            documentInput(
              `지급 ${payout.supplierOrganizationId === agency.orgId ? "A" : "B"}`,
            ),
          ),
        );
        expect(result, 200);
        current = result.json;
      }
      assert.equal((await brandList()).invoices.length, 0);
      assert.equal((await agencyList()).payouts.length, 0);
    },
  );
  await check(
    "brand invoice publication exposes only its immutable approved snapshot",
    async () => {
      const body = documentBody(current.invoice, "issueBrandInvoice");
      const result = await adminMutation(body);
      expect(result, 200);
      current = result.json;
      expect(await adminMutation(body), 200);
      const brand = await brandList();
      assert.equal(brand.invoices.length, 1);
      assert.equal(brand.invoices[0].amount, "27021597764222.93");
      assert.equal(brand.invoices[0].status, "ISSUED");
      assert.equal(
        brand.invoices[0].note,
        "수신 조직에 공개할 브랜드 청구 안내",
      );
      expect(
        await adminMutation(
          documentBody(
            current.invoice,
            "saveBrandInvoice",
            documentInput("변경 시도"),
          ),
        ),
        409,
      );
      expect(
        await adminMutation(documentBody(current.invoice, "issueBrandInvoice")),
        409,
      );
      assert.equal((await agencyList()).payouts.length, 0);
      assert.equal(JSON.stringify(brand).includes("600000.01"), false);
      assert.equal(JSON.stringify(brand).includes("700000.02"), false);
    },
  );
  await check(
    "each agency sees only its issued payout with no brand totals or other agency",
    async () => {
      for (const payout of current.payouts) {
        const body = documentBody(payout, "issueAgencyPayout");
        const result = await adminMutation(body);
        expect(result, 200);
        current = result.json;
        expect(await adminMutation(body), 200);
      }
      const a = await agencyList(),
        b = await agencyList(otherAgency.cookie);
      assert.equal(a.payouts.length, 1);
      assert.equal(b.payouts.length, 1);
      assert.equal(a.payouts[0].amount, "600000.01");
      assert.equal(b.payouts[0].amount, "700000.02");
      assert.equal(JSON.stringify(a).includes("700000.02"), false);
      assert.equal(JSON.stringify(a).includes("27021597764222.93"), false);
      assert.equal((await agencyList(agencyMember.cookie)).payouts.length, 1);
      const foreign = await call("/api/agency/settlement", {
        cookie: outsider.cookie,
      });
      expect(foreign, 403);
      expect(
        await adminMutation(
          documentBody(
            current.payouts[0],
            "saveAgencyPayout",
            documentInput("변경시도"),
          ),
        ),
        409,
      );
    },
  );
  await check(
    "external payment requires exact amount, currency and valid processing time",
    async () => {
      const doc = current.invoice;
      for (const data of [
        paymentInput(doc, { amount: "0.01" }),
        paymentInput(doc, { currency: "USD" }),
        paymentInput(doc, { paidAt: after(-5).toISOString() }),
        paymentInput(doc, { paidAt: after(1).toISOString() }),
        paymentInput(doc, { amount: "1e5" }),
        paymentInput(doc, { amount: "1.001" }),
      ]) {
        const result = await adminMutation(
          documentBody(doc, "recordBrandPayment", data),
        );
        denied(result, [400, 409]);
      }
      current = await adminList();
      assert.equal(current.invoice.status, "ISSUED");
      assert.equal(current.invoice.paidAt, null);
    },
  );
  await check(
    "recorded external receipts and payouts do not change issued terms or execute transfers",
    async () => {
      const before = await brandList();
      const body = documentBody(
        current.invoice,
        "recordBrandPayment",
        paymentInput(current.invoice),
      );
      const result = await adminMutation(body);
      expect(result, 200);
      current = result.json;
      expect(await adminMutation(body), 200);
      expect(
        await adminMutation({ ...body, clientRequestId: randomUUID() }),
        409,
      );
      const brand = await brandList();
      assert.equal(brand.invoices[0].status, "PAID");
      assert.deepEqual(brand.invoices[0].lines, before.invoices[0].lines);
      assert.equal(brand.invoices[0].title, before.invoices[0].title);
      assert.ok(!JSON.stringify(brand).includes("PRIVATE-PAYMENT-REFERENCE"));
      for (const payout of current.payouts) {
        const payment = documentBody(
          payout,
          "recordAgencyPayment",
          paymentInput(payout),
        );
        const result = await adminMutation(payment);
        expect(result, 200);
        current = result.json;
        expect(await adminMutation(payment), 200);
      }
      assert.equal((await agencyList()).payouts[0].status, "PAID");
      assert.equal(
        (await agencyList(otherAgency.cookie)).payouts[0].status,
        "PAID",
      );
      assert.equal(
        await db.settlement.count({ where: { application: { campaignId } } }),
        0,
      );
      assert.equal(
        (await db.campaign.findUniqueOrThrow({ where: { id: campaignId } }))
          .status,
        "COMPLETED",
      );
    },
  );
  await check(
    "live admin role and session changes invalidate settlement access",
    async () => {
      await db.organizationMember.updateMany({
        where: { userId: admin.userId, organizationId: admin.orgId },
        data: { role: "MEMBER" },
      });
      try {
        expect(
          await call(`/api/admin/settlement?campaignId=${campaignId}`, {
            admin: true,
            cookie: admin.cookie,
          }),
          403,
        );
      } finally {
        await db.organizationMember.updateMany({
          where: { userId: admin.userId, organizationId: admin.orgId },
          data: { role: "ADMIN" },
        });
      }
      await db.session.updateMany({
        where: { userId: agencyMember.userId },
        data: { expiresAt: after(-1) },
      });
      expect(
        await call("/api/agency/settlement", { cookie: agencyMember.cookie }),
        401,
      );
    },
  );
  await check(
    "browser-ready completion and private draft scenarios remain retained",
    async () => {
      const ready = await readyFixture("browser-complete");
      readyCampaignId = ready.campaignId;
      assert.equal((await adminList(readyCampaignId)).canComplete, true);
      const draft = await readyFixture("browser-draft");
      browserCampaignId = draft.campaignId;
      let value = await adminList(browserCampaignId);
      let result = await adminMutation(completeBody(value));
      expect(result, 200);
      value = result.json;
      result = await adminMutation(prepareBody(value));
      expect(result, 200);
      await saveFixture();
    },
  );
  await mkdir(resolve(repositoryRoot, "output"), { recursive: true });
  await writeFile(
    resolve(repositoryRoot, "output/settlement-smoke-verification.json"),
    JSON.stringify(
      {
        status: "passed",
        checks,
        completedChecks,
        qaData: "retained_by_user_request",
        fixturePath: values["browser-fixture-file"],
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${checks} real HTTP/database settlement checks; isolated QA data retained`,
  );
} catch (error) {
  process.exitCode = 1;
  const detail =
    error instanceof assert.AssertionError
      ? "assertion failed (private values omitted)"
      : /^HTTP \d+; expected \d+; code [A-Z_]+$/.test(error?.message ?? "")
        ? error.message
        : (error?.name ?? "Error");
  console.error(`FAIL ${step}: ${detail}`);
} finally {
  try {
    if (userIds.length) await saveFixture();
  } finally {
    await db.$disconnect();
  }
}
