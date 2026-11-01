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
      default: "tmp/reporting-qa.json",
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

const prefix = `reporting-live-qa-${Date.now()}-${randomBytes(6).toString("hex")}`;
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
  browserReportingItemId,
  browserSubmissionId,
  readyCampaignId,
  readyReportingItemId,
  pendingUpdateReportingItemId;
let mainItem, proposalId;
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
          name: `게시 성과 QA · ${label}`,
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
        name: "게시 성과 QA",
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
        browserReportingItemId,
        browserSubmissionId,
        readyCampaignId,
        readyReportingItemId,
        pendingUpdateReportingItemId,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await chmod(file, 0o600);

  console.log(
    "READY restricted reporting QA credential file saved; credentials are not logged",
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
        title: `게시 성과 QA · ${label}`,
        summary: "격리된 게시·성과 기능 검증. 실제 제작·계약·지급 없음.",
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
            goal: "게시·성과 실제 API 통합 검증",
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
        summary: "게시 성과 API의 사전 승인 fixture",
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
            message: "게시 성과 통합 테스트 사전 fixture 승인",
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
const snapshot = (version, source = true, changes = {}) => ({
  title: source
    ? `${sourceMarker} · 원문 v${version}`
    : `브랜드 공개용 성과 v${version}`,
  postUrl: `https://www.youtube.com/watch?v=${prefix}-${source ? "source" : "public"}-${version}`,
  publishedAt: after(-2).toISOString(),
  metricsAsOf: null,
  metrics: emptyMetrics(),
  evidenceUrl: source
    ? `https://www.youtube.com/watch?v=${prefix}-private-evidence-${version}`
    : null,
  note: source
    ? `${sourceMarker} · 비공개 제출 메모`
    : "운영팀이 확인한 공개 성과입니다.",
  ...changes,
});
const agencyBody = (item, version, changes = {}) => ({
  action: "submit",
  reportingItemId: item.id,
  expectedRevision: item.revision,
  clientRequestId: randomUUID(),
  data: snapshot(version),
  ...changes,
});
const reviewBody = (item, changes = {}) => ({
  action: "releaseToBrand",
  campaignId: item.campaignId,
  reportingItemId: item.id,
  submissionId: item.latestSubmission.id,
  expectedRevision: item.revision,
  clientRequestId: randomUUID(),
  data: snapshot(item.latestSubmission.version, false),
  internalNote: privateMarker,
  ...changes,
});
const adminMutation = (body, options = {}) =>
  call("/api/admin/reporting", {
    admin: true,
    cookie: admin.cookie,
    body,
    ...options,
  });
const agencyMutation = (body, options = {}) =>
  call("/api/agency/reporting", { cookie: agency.cookie, body, ...options });
async function adminList(id = campaignId) {
  const result = await call(`/api/admin/reporting?campaignId=${id}`, {
    admin: true,
    cookie: admin.cookie,
  });
  expect(result, 200);
  privateHeaders(result);
  return result;
}
async function brandList(id = campaignId, cookie = owner.cookie) {
  const result = await call(`/api/brand/reporting?campaignId=${id}`, {
    cookie,
  });
  expect(result, 200);
  brandSafe(result);
  return result;
}
async function agencyList(cookie = agency.cookie, id = campaignId) {
  const result = await call(
    id ? `/api/agency/reporting?campaignId=${id}` : "/api/agency/reporting",
    {
      cookie,
    },
  );
  expect(result, 200);
  agencySafe(result);
  return result;
}
function updated(result, id = mainItem.id) {
  expect(result, 200);
  const item = result.json.items.find((entry) => entry.id === id);
  assert.ok(item);
  return item;
}
function released(result, id = mainItem.id) {
  const item = result.json.items.find((entry) => entry.id === id);
  return item?.latestSubmission ?? null;
}

try {
  await check("anonymous reporting endpoints deny reads", async () => {
    expect(
      await call("/api/admin/reporting?campaignId=missing", { admin: true }),
      401,
    );
    expect(await call("/api/agency/reporting"), 401);
    expect(await call("/api/brand/reporting?campaignId=missing"), 401);
  });
  await check("isolated tenants authenticate through actual HTTP", async () => {
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
  });
  await check(
    "GET is read-only and approved content prepares idempotently",
    async () => {
      ({ campaignId, proposalId } = await approvedContentFixture("flow", 2));
      assert.equal((await adminList()).json.unpreparedApprovedItemCount, 2);
      await agencyList(agency.cookie, null);
      await brandList();
      assert.equal(await db.reportingItem.count({ where: { campaignId } }), 0);
      const body = {
        action: "prepare",
        campaignId,
        clientRequestId: randomUUID(),
      };
      const first = await adminMutation(body);
      expect(first, 200);
      assert.equal(first.json.items.length, 2);
      expect(await adminMutation(body), 200);
      assert.equal(await db.reportingItem.count({ where: { campaignId } }), 2);
      mainItem = first.json.items[0];
      readyCampaignId = campaignId;
      readyReportingItemId = first.json.items[1].id;
      assert.ok(
        mainItem.canReview === false &&
          mainItem.status === "AWAITING_SUBMISSION",
      );
      assert.equal(released(await brandList()), null);
      await saveFixture();
    },
  );
  await check(
    "tenant, member, admin and origin boundaries are enforced",
    async () => {
      await brandList(campaignId, member.cookie);
      denied(
        await call(`/api/brand/reporting?campaignId=${campaignId}`, {
          cookie: outsider.cookie,
        }),
        [403, 404],
      );
      const foreign = await agencyList(otherAgency.cookie, null);
      assert.equal(foreign.json.items.length, 0);
      denied(
        await agencyMutation(agencyBody(mainItem, 1), {
          cookie: otherAgency.cookie,
        }),
        [403, 404],
      );
      expect(
        await agencyMutation(agencyBody(mainItem, 1), {
          cookie: agencyMember.cookie,
        }),
        403,
      );
      expect(
        await call(`/api/admin/reporting?campaignId=${campaignId}`, {
          admin: true,
          cookie: agency.adminCookie,
        }),
        403,
      );
      expect(
        await agencyMutation(agencyBody(mainItem, 1), {
          origin: "https://untrusted.example",
        }),
        403,
      );
      expect(
        await adminMutation(
          { action: "prepare", campaignId, clientRequestId: randomUUID() },
          { origin: "https://untrusted.example" },
        ),
        403,
      );
      denied(
        await call(`/api/brand/reporting?campaignId=${campaignId}`, {
          cookie: agency.cookie,
        }),
        [403],
      );
    },
  );
  await check(
    "invalid URLs, counters and measurement dates never write",
    async () => {
      const invalid = [
        snapshot(1, true, { postUrl: "http://127.0.0.1/private" }),
        snapshot(1, true, { evidenceUrl: "javascript:alert(1)" }),
        snapshot(1, true, {
          metrics: { ...emptyMetrics(), views: -1 },
          metricsAsOf: after(-1).toISOString(),
        }),
        snapshot(1, true, { metrics: { ...emptyMetrics(), views: 0 } }),
        snapshot(1, true, {
          metrics: { ...emptyMetrics(), clicks: 1.5 },
          metricsAsOf: after(-1).toISOString(),
        }),
        snapshot(1, true, {
          metrics: { ...emptyMetrics(), reach: Number.MAX_SAFE_INTEGER + 1 },
          metricsAsOf: after(-1).toISOString(),
        }),
        snapshot(1, true, { publishedAt: after(1).toISOString() }),
        snapshot(1, true, { metricsAsOf: after(-3).toISOString() }),
      ];
      for (const data of invalid)
        expect(await agencyMutation(agencyBody(mainItem, 1, { data })), 400);
      assert.equal(
        await db.reportingSubmission.count({
          where: { reportingItemId: mainItem.id },
        }),
        0,
      );
    },
  );
  await check(
    "agency source is private and submit replay creates one version",
    async () => {
      const body = agencyBody(mainItem, 1);
      const first = await agencyMutation(body);
      expect(first, 200);
      agencySafe(first);
      mainItem = updated(await adminList());
      assert.equal(mainItem.status, "ADMIN_REVIEW");
      assert.equal(mainItem.latestSubmission.version, 1);
      expect(await agencyMutation(body), 200);
      expect(
        await agencyMutation({
          ...body,
          data: { ...body.data, note: "different payload" },
        }),
        409,
      );
      expect(
        await agencyMutation({ ...body, clientRequestId: randomUUID() }),
        409,
      );
      assert.equal(
        await db.reportingSubmission.count({
          where: { reportingItemId: mainItem.id },
        }),
        1,
      );
      assert.equal(released(await brandList()), null);
      assert.equal(mainItem.latestSubmission.note, body.data.note);
    },
  );
  await check(
    "admin feedback is agency-visible while internal notes stay private",
    async () => {
      const body = {
        ...reviewBody(mainItem),
        action: "requestChanges",
        agencyFeedback: "측정 기준과 증빙을 보완해 주세요.",
      };
      delete body.data;
      mainItem = updated(await adminMutation(body));
      assert.equal(mainItem.status, "AGENCY_REVISION");
      expect(await adminMutation(body), 200);
      const agencyView = await agencyList();
      agencySafe(agencyView);
      assert.equal(
        agencyView.json.items.find((item) => item.id === mainItem.id)
          .latestSubmission.agencyFeedback,
        body.agencyFeedback,
      );
      assert.equal(released(await brandList()), null);
    },
  );
  await check(
    "resubmission and explicit curated publication preserve nullable metrics",
    async () => {
      const submitted = await agencyMutation(
        agencyBody(mainItem, 2, {
          data: snapshot(2, true, {
            metrics: { ...emptyMetrics(), views: 9123 },
            metricsAsOf: after(-1).toISOString(),
          }),
        }),
      );
      expect(submitted, 200);
      mainItem = updated(await adminList());
      assert.equal(mainItem.latestSubmission.version, 2);
      const body = reviewBody(mainItem);
      const oldRevision = mainItem.revision;
      mainItem = updated(await adminMutation(body));
      assert.equal(mainItem.status, "PUBLISHED");
      expect(await adminMutation(body), 200);
      expect(
        await adminMutation({
          ...body,
          clientRequestId: randomUUID(),
          expectedRevision: oldRevision,
        }),
        409,
      );
      const brand = await brandList();
      const value = released(brand);
      assert.ok(value);
      assert.deepEqual(value.metrics, emptyMetrics());
      assert.equal(value.metricsAsOf, null);
      assert.equal(value.postUrl, body.data.postUrl);
      assert.equal(value.note, body.data.note);
      assert.equal(mainItem.latestSubmission.metrics.views, 9123);
      assert.deepEqual(
        mainItem.latestSubmission.releasedSnapshot.metrics,
        emptyMetrics(),
      );
      expect(
        await call("/api/brand/reporting", {
          cookie: owner.cookie,
          body: { action: "approve", reportingItemId: mainItem.id },
        }),
        405,
      );
    },
  );
  await check(
    "a private update preserves the previous immutable public version",
    async () => {
      const prior = released(await brandList());
      const oldRows = await db.reportingSubmission.findMany({
        where: { reportingItemId: mainItem.id },
        orderBy: { version: "asc" },
      });
      const submitted = await agencyMutation(
        agencyBody(mainItem, 3, {
          data: snapshot(3, true, {
            metrics: { ...emptyMetrics(), views: 10001 },
            metricsAsOf: after(-1).toISOString(),
          }),
        }),
      );
      expect(submitted, 200);
      mainItem = updated(await adminList());
      assert.equal(mainItem.status, "ADMIN_REVIEW");
      const pendingPublic = released(await brandList());
      assert.deepEqual(pendingPublic, prior);
      const immutableRows = await db.reportingSubmission.findMany({
        where: { reportingItemId: mainItem.id, version: { lte: 2 } },
        orderBy: { version: "asc" },
      });
      assert.deepEqual(immutableRows, oldRows);
      expect(await agencyMutation(agencyBody(mainItem, 4)), 409);
      const oldSubmission = mainItem.submissions.find(
        (value) => value.version === 2,
      );
      expect(
        await adminMutation({
          ...reviewBody(mainItem),
          submissionId: oldSubmission.id,
        }),
        409,
      );
    },
  );
  await check(
    "zero remains zero, latest public version changes only on release",
    async () => {
      const data = snapshot(3, false, {
        metrics: { ...emptyMetrics(), views: 0, likes: 18, comments: 0 },
        metricsAsOf: after(-1).toISOString(),
      });
      const release = reviewBody(mainItem, { data });
      mainItem = updated(await adminMutation(release));
      const response = await brandList();
      const value = released(response);
      assert.equal(value.version, 3);
      assert.equal(value.metrics.views, 0);
      assert.equal(value.metrics.comments, 0);
      assert.equal(value.metrics.impressions, null);
      const history = response.json.items.find(
        (item) => item.id === mainItem.id,
      ).submissions;
      assert.deepEqual(
        history.map((entry) => entry.version),
        [3, 2],
      );
      assert.equal(history[0].isLatest, true);
      assert.equal(history[1].isLatest, false);
      assert.deepEqual(history[1].metrics, emptyMetrics());
    },
  );
  await check(
    "approved proposal expiry does not interrupt updates or imply payment",
    async () => {
      await db.campaignProposal.update({
        where: { id: proposalId, campaignId },
        data: { expiresAt: after(-1) },
      });
      const next = await agencyMutation(agencyBody(mainItem, 4));
      expect(next, 200);
      mainItem = updated(await adminList());
      mainItem = updated(await adminMutation(reviewBody(mainItem)));
      assert.equal(mainItem.latestSubmission.version, 4);
      assert.equal(
        await db.settlement.count({ where: { application: { campaignId } } }),
        0,
      );
      assert.equal(
        (await db.campaign.findUniqueOrThrow({ where: { id: campaignId } }))
          .status,
        "IN_PROGRESS",
      );
      const item = await db.productionItem.findUniqueOrThrow({
        where: { id: mainItem.productionItemId },
      });
      assert.equal(item.status, "APPROVED");
    },
  );
  await check(
    "legacy direct posted-link and admin verification bypasses remain closed",
    async () => {
      const application = await db.campaignApplication.create({
        data: {
          campaignId,
          agencyOrganizationId: agency.orgId,
          submittedById: agency.userId,
          status: "ACCEPTED",
          proposal: "격리 QA",
          currency: "KRW",
        },
      });
      const legacy = await db.contentSubmission.create({
        data: {
          applicationId: application.id,
          version: 1,
          status: "APPROVED",
          draftUrl: "https://www.youtube.com/watch?v=legacy-qa-approved",
          submittedAt: new Date(),
        },
      });
      const agencyWrite = await call("/api/agency/content-submissions", {
        cookie: agency.cookie,
        body: {
          action: "publishContent",
          applicationId: application.id,
          expectedSubmissionId: legacy.id,
          expectedUpdatedAt: legacy.updatedAt.toISOString(),
          url: "https://www.youtube.com/watch?v=legacy-qa-posted",
        },
      });
      expect(agencyWrite, 409);
      assert.equal(agencyWrite.json.code, "OFFICIAL_PRODUCTION_REQUIRED");
      const adminWrite = await call("/api/admin/campaign-operations", {
        admin: true,
        cookie: admin.cookie,
        body: {
          action: "reviewContent",
          campaignId,
          applicationId: application.id,
          submissionId: legacy.id,
          expectedUpdatedAt: legacy.updatedAt.toISOString(),
          status: "VERIFIED",
          reason: "격리 QA 우회 검사",
        },
      });
      expect(adminWrite, 409);
      assert.equal(adminWrite.json.code, "OFFICIAL_PRODUCTION_REQUIRED");
      assert.equal(
        (
          await db.contentSubmission.findUniqueOrThrow({
            where: { id: legacy.id },
          })
        ).status,
        "APPROVED",
      );
    },
  );
  await check(
    "unapproved content, closed campaigns and superseded proposals block writes",
    async () => {
      const fixture = await approvedContentFixture("guards");
      guardCampaignId = fixture.campaignId;
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "BRAND_REVIEW" },
      });
      const prepare = await adminMutation({
        action: "prepare",
        campaignId: guardCampaignId,
        clientRequestId: randomUUID(),
      });
      expect(prepare, 200);
      assert.equal(prepare.json.items.length, 0);
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "APPROVED" },
      });
      const ready = await adminMutation({
        action: "prepare",
        campaignId: guardCampaignId,
        clientRequestId: randomUUID(),
      });
      expect(ready, 200);
      let item = ready.json.items[0];
      expect(await agencyMutation(agencyBody(item, 1)), 200);
      item = updated(await adminList(guardCampaignId), item.id);
      await db.campaign.update({
        where: { id: guardCampaignId, brandOrganizationId: owner.orgId },
        data: { status: "CANCELED" },
      });
      expect(await adminMutation(reviewBody(item)), 409);
      await db.campaign.update({
        where: { id: guardCampaignId },
        data: { status: "IN_PROGRESS" },
      });
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "BRAND_REVIEW" },
      });
      expect(await adminMutation(reviewBody(item)), 409);
      await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "APPROVED" },
      });
      await db.campaignProposal.update({
        where: { id: fixture.proposalId, campaignId: guardCampaignId },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      expect(await adminMutation(reviewBody(item)), 409);
      assert.equal(
        (await db.reportingItem.findUniqueOrThrow({ where: { id: item.id } }))
          .status,
        "ADMIN_REVIEW",
      );
      assert.equal(released(await brandList(guardCampaignId), item.id), null);
    },
  );
  await check(
    "live role and organization changes immediately remove write access",
    async () => {
      const ready = (await agencyList()).json.items.find(
        (item) => item.id === readyReportingItemId,
      );
      assert.ok(ready);
      await db.organizationMember.updateMany({
        where: { userId: agency.userId, organizationId: agency.orgId },
        data: { role: "MEMBER" },
      });
      try {
        expect(await agencyMutation(agencyBody(ready, 1)), 403);
      } finally {
        await db.organizationMember.updateMany({
          where: { userId: agency.userId, organizationId: agency.orgId },
          data: { role: "OWNER" },
        });
      }
      await db.organization.update({
        where: { id: agency.orgId },
        data: { status: "SUSPENDED" },
      });
      try {
        expect(await agencyMutation(agencyBody(ready, 1)), 403);
      } finally {
        await db.organization.update({
          where: { id: agency.orgId },
          data: { status: "ACTIVE" },
        });
      }
    },
  );
  await check(
    "expired live sessions cannot read cached reporting permissions",
    async () => {
      // Retain all QA records: expire this actor's isolated session instead of deleting it.
      await db.session.updateMany({
        where: { userId: agencyMember.userId },
        data: { expiresAt: after(-1) },
      });
      expect(
        await call("/api/agency/reporting", { cookie: agencyMember.cookie }),
        401,
      );
    },
  );
  await check(
    "brand content approval creates reporting tasks in its transaction",
    async () => {
      const fixture = await approvedContentFixture("approval-trigger");
      const production = await db.productionItem.update({
        where: { id: fixture.productionIds[0] },
        data: { status: "BRAND_REVIEW" },
        include: { submissions: true },
      });
      await db.productionSubmission.update({
        where: { id: production.submissions[0].id },
        data: {
          status: "BRAND_REVIEW",
          brandDecision: null,
          brandDecidedById: null,
          brandDecidedAt: null,
        },
      });
      assert.equal(
        await db.reportingItem.count({
          where: { campaignId: fixture.campaignId },
        }),
        0,
      );
      const approved = await call("/api/brand/production", {
        cookie: owner.cookie,
        body: {
          action: "approve",
          productionItemId: production.id,
          submissionId: production.submissions[0].id,
          expectedRevision: production.revision,
          clientRequestId: randomUUID(),
          message: "격리 QA 콘텐츠 승인",
        },
      });
      expect(approved, 200);
      const reporting = await adminList(fixture.campaignId);
      assert.equal(reporting.json.items.length, 1);
      assert.equal(reporting.json.items[0].status, "AWAITING_SUBMISSION");
      assert.equal(reporting.json.unpreparedApprovedItemCount, 0);
    },
  );
  await check(
    "browser-ready private source and unsubmitted task are retained",
    async () => {
      const fixture = await approvedContentFixture("browser-review");
      browserCampaignId = fixture.campaignId;
      const prepared = await adminMutation({
        action: "prepare",
        campaignId: browserCampaignId,
        clientRequestId: randomUUID(),
      });
      expect(prepared, 200);
      const submitted = await agencyMutation(
        agencyBody(prepared.json.items[0], 1),
      );
      expect(submitted, 200);
      browserReportingItemId = submitted.json.item.id;
      browserSubmissionId = submitted.json.item.latestSubmission.id;
      await saveFixture();
    },
  );
  await check(
    "latest public v4 and private pending v5 remain isolated for deployment verification",
    async () => {
      const before = released(await brandList());
      assert.equal(before.version, 4);
      const submitted = await agencyMutation(
        agencyBody(mainItem, 5, {
          data: snapshot(5, true, {
            metrics: { ...emptyMetrics(), views: 777777 },
            metricsAsOf: after(-1).toISOString(),
          }),
        }),
      );
      expect(submitted, 200);
      mainItem = updated(await adminList());
      assert.equal(mainItem.status, "ADMIN_REVIEW");
      assert.equal(mainItem.latestSubmission.version, 5);
      assert.deepEqual(released(await brandList()), before);
      pendingUpdateReportingItemId = mainItem.id;
      await saveFixture();
    },
  );
  console.log(
    `PASS ${checks} real HTTP/database reporting checks; isolated QA data retained by user request`,
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
