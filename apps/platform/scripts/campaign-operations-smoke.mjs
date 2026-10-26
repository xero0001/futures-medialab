import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// Explicit opt-in, localhost servers only, exact disposable IDs only.
assert.equal(process.env.RUN_DB_SMOKE, "1", "Set RUN_DB_SMOKE=1 for disposable DB fixtures.");
assert.ok(process.env.DATABASE_URL, "Supply the same database environment as the local servers.");
function localOrigin(value) {
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash);
  return url.origin;
}
const base = localOrigin(process.env.BASE_URL || "http://localhost:3000");
const adminBase = localOrigin(process.env.ADMIN_BASE_URL || "http://localhost:3001");
const db = createDatabaseClient();
const prefix = `fm-ops-e2e-${Date.now()}-${randomBytes(6).toString("hex")}`;
const ids = { agencyUser: `${prefix}-u-agency`, adminUser: `${prefix}-u-admin`, agencyOrg: `${prefix}-o-agency`, adminOrg: `${prefix}-o-admin`, brandOrg: `${prefix}-o-brand`, foreignOrg: `${prefix}-o-foreign`, campaign: `${prefix}-campaign`, application: `${prefix}-application`, foreignApp: `${prefix}-foreign-app` };
const password = `Ops-${randomBytes(24).toString("base64url")}!`;
const users = [ids.agencyUser, ids.adminUser], organizations = [ids.agencyOrg, ids.adminOrg, ids.brandOrg, ids.foreignOrg], applications = [ids.application, ids.foreignApp];
let agencyCookie, adminCookie, phase = "preflight", failed = false;
async function call(path, { target = base, cookie, body, origin = target } = {}) {
  const response = await globalThis.fetch(`${target}${path}`, { method: body === undefined ? "GET" : "POST", redirect: "manual", signal: globalThis.AbortSignal.timeout(60_000),
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: origin, "Sec-Fetch-Site": origin === target ? "same-origin" : "cross-site" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let json; try { json = await response.json(); } catch { /* no secrets or HTML are logged */ }
  return { response, json };
}
const expect = (result, status) => assert.equal(result.response.status, status, `${phase}: unexpected HTTP status (${result.json?.code ?? "page"})`);
async function login(userId, target) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await call("/api/auth/sign-in/email", { target, body: { email: `${userId}@example.invalid`, password } });
    if (result.response.status === 429 && attempt === 0) { console.log("WAIT authentication rate-limit cooldown; no shared counters reset"); await delay(30_500); await delay(30_500); continue; }
    expect(result, 200); assert.equal(result.json?.user?.id, userId);
    const cookie = result.response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; "); assert.ok(cookie); return cookie;
  }
  throw new Error("Authentication cooldown exhausted");
}
async function operations() {
  const result = await call(`/api/admin/campaign-operations?campaignId=${ids.campaign}`, { target: adminBase, cookie: adminCookie }); expect(result, 200);
  return result.json.applications.find((row) => row.id === ids.application);
}
const mutate = (body) => call("/api/admin/campaign-operations", { target: adminBase, cookie: adminCookie, body: { campaignId: ids.campaign, applicationId: ids.application, reason: "Synthetic QA only — no commercial action", ...body } });
const content = (action, latest, overrides = {}) => call("/api/agency/content-submissions", { cookie: agencyCookie, body: { action, applicationId: ids.application,
  expectedSubmissionId: latest?.id ?? null, expectedUpdatedAt: latest?.updatedAt ?? null, url: "https://example.invalid/synthetic-content", ...overrides } });
const review = (latest, status) => mutate({ action: "reviewContent", submissionId: latest.id, expectedUpdatedAt: latest.updatedAt, status });
try {
  expect(await call("/api/admin/campaign-operations?campaignId=missing", { target: adminBase }), 401);
  expect(await call("/api/agency/content-submissions", { body: {} }), 401);
  phase = "fixture creation";
  const encoded = await hashPassword(password);
  await db.$transaction(async (tx) => {
    for (const userId of users) {
      await tx.user.create({ data: { id: userId, email: `${userId}@example.invalid`, name: userId, emailVerified: false } });
      await tx.account.create({ data: { id: `${userId}-credential`, userId, accountId: userId, providerId: "credential", password: encoded } });
    }
    for (const [id, type] of [[ids.agencyOrg, "AGENCY"], [ids.adminOrg, "PLATFORM"], [ids.brandOrg, "BRAND"], [ids.foreignOrg, "AGENCY"]]) await tx.organization.create({ data: { id, name: id, slug: id, type, status: "ACTIVE", metadata: type === "PLATFORM" ? {} : { testWorkspaceAccess: true } } });
    await tx.organizationMember.create({ data: { userId: ids.agencyUser, organizationId: ids.agencyOrg, role: "OWNER" } });
    await tx.organizationMember.create({ data: { userId: ids.adminUser, organizationId: ids.adminOrg, role: "ADMIN" } });
    await tx.campaign.create({ data: { id: ids.campaign, brandOrganizationId: ids.brandOrg, createdById: ids.adminUser, title: `${prefix} synthetic only`, summary: "Disposable operation verification, not a real campaign", status: "IN_PROGRESS", currency: "USD", budgetAmount: "1000.00", platforms: ["youtube"], regions: ["KR"], categories: ["gaming"], followerMin: 1000, followerMax: 500000, briefUrl: "https://example.invalid/brief", contentDeadline: new Date("2099-01-01") } });
    for (const [id, agencyOrganizationId] of [[ids.application, ids.agencyOrg], [ids.foreignApp, ids.foreignOrg]]) await tx.campaignApplication.create({ data: { id, campaignId: ids.campaign, agencyOrganizationId, submittedById: ids.agencyUser, status: "ACCEPTED", proposedAmount: "100.00", currency: "USD", proposal: "Synthetic verification proposal" } });
  }, { timeout: 20000 });
  phase = "authentication";
  agencyCookie = await login(ids.agencyUser, base); adminCookie = await login(ids.adminUser, adminBase);
  phase = "read and authorization";
  const detail = await call(`/api/admin/campaigns/${ids.campaign}`, { target: adminBase, cookie: adminCookie }); expect(detail, 200);
  assert.deepEqual(detail.json.regions, ["KR"]); assert.equal(detail.json.campaign.id, ids.campaign); assert.equal(detail.json.followerMin, 1000);
  expect(await content("submitDraft", null, { applicationId: ids.foreignApp }), 404);
  expect(await call("/api/agency/content-submissions", { cookie: agencyCookie, origin: "https://untrusted.invalid", body: {} }), 403);
  expect(await call("/api/admin/campaign-operations", { target: adminBase, cookie: agencyCookie, body: { action: "reviewContent" } }), 401);
  console.log("PASS live admin targeting/context, tenant isolation, CSRF and separate admin authentication");
  phase = "draft and revision";
  expect(await content("submitDraft", null), 200);
  expect(await content("submitDraft", null), 409);
  let application = await operations(), latest = application.submissions[0];
  assert.equal(latest.status, "SUBMITTED"); assert.equal(latest.version, 1);
  expect(await review(latest, "VERIFIED"), 409);
  expect(await review(latest, "REVISION_REQUESTED"), 200);
  expect(await review(latest, "APPROVED"), 409);
  application = await operations(); latest = application.submissions[0];
  expect(await content("submitDraft", latest, { url: "https://example.invalid/revised-content" }), 200);
  application = await operations(); latest = application.submissions[0];
  assert.equal(latest.version, 2); assert.equal(application.submissions[1].status, "REVISION_REQUESTED");
  expect(await review(latest, "APPROVED"), 200);
  application = await operations(); latest = application.submissions[0];
  expect(await content("publishContent", latest, { url: "https://example.invalid/published-content" }), 200);
  application = await operations(); latest = application.submissions[0];
  assert.equal(latest.status, "PUBLISHED");
  console.log("PASS real DB draft → revision → new version → approval → published link; stale writes denied");
  phase = "verification and financial review";
  const amounts = { action: "prepareSettlement", expectedVersion: null, grossAmount: "100.00", platformFeeAmount: "20.00", withholdingAmount: "3.25" };
  expect(await mutate({ ...amounts, grossAmount: "101.00" }), 409);
  expect(await mutate({ ...amounts, platformFeeAmount: "100.01" }), 400);
  expect(await mutate(amounts), 200);
  expect(await mutate({ action: "reviewSettlement", expectedVersion: 0, status: "APPROVED" }), 409);
  expect(await review(latest, "VERIFIED"), 200);
  expect(await mutate({ action: "saveContract", expectedVersion: null, status: "CONFIRMED", referenceUrl: "https://example.invalid/external-contract", notes: "Synthetic manual reference only, not an electronic signature" }), 200);
  expect(await mutate({ ...amounts, expectedVersion: 0 }), 200);
  expect(await mutate({ action: "reviewSettlement", expectedVersion: 0, status: "APPROVED" }), 409);
  expect(await mutate({ action: "reviewSettlement", expectedVersion: 1, status: "APPROVED" }), 200);
  const settled = await db.settlement.findUniqueOrThrow({ where: { applicationId: ids.application } });
  assert.equal(settled.status, "APPROVED"); assert.equal(settled.netAmount.toFixed(2), "76.75"); assert.equal(settled.paidAt, null); assert.equal(settled.transferReference, null);
  application = await operations(); latest = application.submissions[0];
  assert.equal(latest.status, "VERIFIED"); assert.ok(latest.verifiedAt); assert.equal(application.contract.status, "CONFIRMED");
  expect(await content("submitDraft", latest), 409);
  expect(await mutate({ action: "reviewSettlement", expectedVersion: 2, status: "PAID" }), 400);
  const agency = await call("/api/agency/operations", { cookie: agencyCookie }); expect(agency, 200);
  assert.equal(agency.json.capabilities.contentSubmission, true); assert.equal(agency.json.capabilities.payouts, false);
  assert.equal(agency.json.projects.find((row) => row.id === ids.application).submissions[0].status, "VERIFIED");
  assert.equal(agency.json.settlements.find((row) => row.applicationId === ids.application).netAmount, "76.75");
  const audits = await db.auditLog.findMany({ where: { actorId: { in: users } }, select: { action: true } });
  for (const action of ["content.submitDraft", "content.publishContent", "admin.reviewContent", "admin.saveContract", "admin.prepareSettlement", "admin.reviewSettlement"]) assert.ok(audits.some((row) => row.action === action));
  console.log("PASS actual persisted verification, manual contract reference, exact-net settlement approval, agency visibility and audit history; no payment or signature occurred");
} catch (error) {
  failed = true; console.error(`FAIL ${phase}: ${error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.name : "unknown failure"}`);
} finally {
  try {
    assert.ok(Object.values(ids).every((id) => id.startsWith(`${prefix}-`)), "Cleanup must stay within this exact run.");
    await db.$transaction(async (tx) => {
      await tx.settlement.deleteMany({ where: { applicationId: { in: applications } } });
      await tx.campaignContract.deleteMany({ where: { applicationId: { in: applications } } });
      await tx.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await tx.campaign.deleteMany({ where: { id: ids.campaign, brandOrganizationId: ids.brandOrg } });
      const counters = await tx.rateLimit.findMany({ where: { OR: users.map((id) => ({ key: { endsWith: `:${id}` } })) }, select: { id: true } });
      await tx.rateLimit.deleteMany({ where: { id: { in: counters.map((row) => row.id) } } });
      await tx.organization.deleteMany({ where: { id: { in: organizations } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    }, { timeout: 20000 });
    assert.equal(await db.campaign.count({ where: { id: ids.campaign } }), 0);
    assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
    assert.equal(await db.organization.count({ where: { id: { in: organizations } } }), 0);
    console.log("PASS cleanup: exact disposable campaign/contract/settlement/users/orgs/sessions/audits removed; original records and shared auth counters untouched");
  } catch { failed = true; console.error(`FAIL owned cleanup for ${prefix}; no broad deletion attempted`); }
  await db.$disconnect();
}
if (failed) process.exitCode = 1;
