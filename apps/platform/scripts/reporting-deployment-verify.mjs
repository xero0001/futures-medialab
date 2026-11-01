import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Retained QA credentials only. Business endpoints are GET-only in this script;
// POST is restricted to genuine sign-in, without creating or changing bypasses.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { values } = parseArgs({ options: {
  "fixture-file": { type: "string", default: "tmp/reporting-qa.json" },
  "retry-failed": { type: "boolean", default: false },
} });
const fixtureFile = resolve(root, values["fixture-file"]);
assert.equal((await stat(fixtureFile)).mode & 0o077, 0, "FIXTURE_FILE_MUST_BE_PRIVATE");
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));
assert.match(fixture.prefix, /^reporting-live-qa-\d+-[a-f0-9]{12}$/);
assert.ok(typeof fixture.password === "string" && fixture.password.length >= 24, "QA_PASSWORD_REQUIRED");
for (const label of ["owner", "member", "outsider", "agency", "agency-member", "other-agency", "admin"]) {
  const account = fixture.accounts[label];
  assert.equal(account.email, `${fixture.prefix}-${label}@example.invalid`, "QA_ACCOUNT_REQUIRED");
  assert.equal(account.userId, `${fixture.prefix}-${label}`, "QA_USER_REQUIRED");
  assert.ok(account.orgId.startsWith(`${fixture.prefix}-`), "QA_ORGANIZATION_REQUIRED");
}
for (const key of ["campaignId", "guardCampaignId", "browserCampaignId", "readyCampaignId"])
  assert.ok(fixture[key]?.startsWith(`${fixture.prefix}-campaign-`), "QA_CAMPAIGN_REQUIRED");
for (const key of ["browserReportingItemId", "readyReportingItemId", "pendingUpdateReportingItemId"])
  assert.match(fixture[key], /^[a-zA-Z0-9_-]+$/);

const platform = "https://futures-medialab.vercel.app";
const admin = "https://futures-medialab-admin.vercel.app";
const outputFile = resolve(root, "output/reporting-review/production-verification.json");
const report = {
  checkedAt: new Date().toISOString(), platformOrigin: platform, adminOrigin: admin,
  qaPrefix: fixture.prefix, campaignId: fixture.campaignId,
  reviewedCampaignId: fixture.readyCampaignId, privateCampaignId: fixture.browserCampaignId,
  crossOrganizationCampaignId: "fm-demo-nte-production-v1-campaign-approved",
  mode: "read-only business verification; authentication sign-in only",
  checks: [], overall: "pending",
};
if (values["retry-failed"]) {
  const prior = JSON.parse(await readFile(outputFile, "utf8"));
  assert.equal(prior.qaPrefix, fixture.prefix, "RETRY_NAMESPACE_MISMATCH");
  assert.equal(prior.platformOrigin, platform, "RETRY_ORIGIN_MISMATCH");
  assert.equal(prior.adminOrigin, admin, "RETRY_ORIGIN_MISMATCH");
  report.checks = prior.checks.filter(check => check.status === "passed");
  report.previousAttempts = [...(prior.previousAttempts ?? []), { checkedAt: prior.checkedAt, completedAt: prior.completedAt, failedChecks: prior.checks.filter(check => check.status !== "passed") }];
}
const qp = value => encodeURIComponent(value);
const safeError = error => /^[A-Z0-9_]+$/.test(error?.message ?? "") ? error.message : error?.name ?? "ERROR";
async function call(origin, path, { cookie, credentials } = {}) {
  assert.ok([platform, admin].includes(origin), "UNEXPECTED_ORIGIN");
  assert.ok(/^\/api\//.test(path), "UNEXPECTED_PATH");
  assert.ok(!credentials || path === "/api/auth/sign-in/email", "BUSINESS_WRITES_FORBIDDEN");
  const response = await globalThis.fetch(`${origin}${path}`, {
    method: credentials ? "POST" : "GET", redirect: "manual", signal: globalThis.AbortSignal.timeout(45000),
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(credentials ? { Origin: origin, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" } : {}) },
    ...(credentials ? { body: JSON.stringify(credentials) } : {}),
  });
  const body = await response.text(), contentType = response.headers.get("content-type") ?? "";
  let json = null;
  if (contentType.includes("application/json")) {
    try { json = JSON.parse(body); } catch { /* No response bodies are logged. */ }
  }
  if (!json && [401, 403, 302, 307, 308].includes(response.status) && (/text\/html/.test(contentType) || /vercel|sso/i.test(response.headers.get("location") ?? ""))) throw new Error("EXISTING_DEPLOYMENT_PROTECTION_BLOCKED");
  return { response, body, json };
}
function status(result, expected) {
  if (result.response.status !== expected) throw new Error(`HTTP_${result.response.status}_EXPECTED_${expected}`);
  assert.ok(result.json, "JSON_RESPONSE_REQUIRED");
}
function privateHeaders(result) {
  const cache = result.response.headers.get("cache-control") ?? "";
  assert.ok(cache.includes("private") && cache.includes("no-store"), "PRIVATE_CACHE_REQUIRED");
}
function noKeys(value, forbidden, rejectSource = false) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbidden.has(key) && (!rejectSource || !/^source|^supplier/.test(key)), "PRIVATE_FIELD_EXPOSED");
    noKeys(child, forbidden, rejectSource);
  }
}
function publicData(result) {
  privateHeaders(result);
  noKeys(result.json, new Set(["creatorId", "internalNote", "internalNotes", "agencyFeedback", "submittedById", "adminReviewedById", "releasedById", "payloadHash"]), true);
  for (const value of [`${fixture.prefix}-PRIVATE-ADMIN-NOTE`, `${fixture.prefix}-PRIVATE-AGENCY-SOURCE`, `${fixture.prefix}-private-evidence`, `${fixture.prefix}-source-`, fixture.accounts.agency.orgId, fixture.accounts["other-agency"].orgId])
    assert.ok(!result.body.includes(value), "PRIVATE_MARKER_EXPOSED");
}
const metricKeys = ["views", "impressions", "reach", "likes", "comments", "shares", "saves", "clicks"];
function safeSnapshot(snapshot) {
  for (const value of [snapshot.postUrl, snapshot.evidenceUrl].filter(Boolean)) {
    const url = new URL(value);
    assert.ok(url.protocol === "https:" && !url.username && !url.password && !["localhost", "example.invalid"].includes(url.hostname), "SAFE_PUBLIC_LINK_REQUIRED");
  }
  assert.ok(Number.isFinite(Date.parse(snapshot.publishedAt)) && Date.parse(snapshot.publishedAt) <= Date.now(), "PUBLISHED_TIME_REQUIRED");
  assert.ok(metricKeys.every(key => snapshot.metrics[key] === null || (Number.isSafeInteger(snapshot.metrics[key]) && snapshot.metrics[key] >= 0)), "NULLABLE_METRICS_REQUIRED");
  if (metricKeys.some(key => snapshot.metrics[key] !== null)) assert.ok(snapshot.metricsAsOf && Date.parse(snapshot.metricsAsOf) >= Date.parse(snapshot.publishedAt) && Date.parse(snapshot.metricsAsOf) <= Date.now(), "MEASUREMENT_TIME_REQUIRED");
}
async function check(name, run) {
  if (report.checks.some(value => value.name === name && value.status === "passed")) return;
  try {
    const metadata = await run();
    report.checks.push({ name, status: "passed", ...metadata });
    console.log(`PASS ${name}`);
  } catch (error) {
    const code = safeError(error), state = code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED" ? "blocked" : "failed";
    report.checks.push({ name, status: state, code });
    console.log(`${state.toUpperCase()} ${name}: ${code}`);
  }
}
const sessions = new Map();
function authenticate(origin, label) {
  const key = `${origin}:${label}`;
  if (!sessions.has(key)) {
    const promise = (async () => {
      const credentials = { email: fixture.accounts[label].email, password: fixture.password };
      let result = await call(origin, "/api/auth/sign-in/email", { credentials });
      if (result.response.status === 429) {
        console.log("WAIT normal sign-in cooldown; no rate-limit bypass");
        await delay(30500); await delay(30500);
        result = await call(origin, "/api/auth/sign-in/email", { credentials });
      }
      status(result, 200);
      const cookies = result.response.headers.getSetCookie();
      assert.ok(cookies.some(value => value.split("=", 1)[0].endsWith("session_token")), "SESSION_COOKIE_REQUIRED");
      const name = `${label} sign-in at ${origin === admin ? "admin" : "platform"}`;
      if (!report.checks.some(value => value.name === name && value.status === "passed")) report.checks.push({ name, status: "passed", httpStatus: 200 });
      console.log(`PASS ${name}`);
      return cookies.map(value => value.split(";", 1)[0]).join("; ");
    })().catch(error => { sessions.delete(key); throw error; });
    sessions.set(key, promise);
  }
  return sessions.get(key);
}
async function brandRead(campaignId, label = "owner") {
  const result = await call(platform, `/api/brand/reporting?campaignId=${qp(campaignId)}`, { cookie: await authenticate(platform, label) });
  status(result, 200); publicData(result);
  return result;
}

try {
  for (const [name, origin, path] of [
    ["anonymous brand reporting read is denied", platform, `/api/brand/reporting?campaignId=${qp(fixture.campaignId)}`],
    ["anonymous agency reporting read is denied", platform, "/api/agency/reporting"],
    ["anonymous admin reporting read is denied", admin, `/api/admin/reporting?campaignId=${qp(fixture.campaignId)}`],
  ]) await check(name, async () => { const result = await call(origin, path); status(result, 401); privateHeaders(result); return { httpStatus: 401 }; });

  await check("brand workspace exposes real reporting summaries without source data", async () => {
    const result = await call(platform, "/api/brand/workspace", { cookie: await authenticate(platform, "owner") }); status(result, 200); publicData(result);
    assert.equal(result.json.capabilities.campaignPerformance, true, "REPORTING_CAPABILITY_REQUIRED");
    const campaign = result.json.campaigns.find(value => value.id === fixture.campaignId);
    assert.ok(campaign?.reportingSummary.total >= 2 && campaign.reportingSummary.published >= 2, "REAL_REPORT_SUMMARY_REQUIRED");
    return { httpStatus: 200, reportingSummary: campaign.reportingSummary };
  });
  await check("CUA-submitted and curated report remains published", async () => {
    const result = await brandRead(fixture.readyCampaignId);
    const item = result.json.items.find(value => value.id === fixture.readyReportingItemId);
    assert.equal(item?.status, "PUBLISHED", "CUA_REPORT_NOT_PUBLISHED");
    assert.ok(item.isCurrent && item.latestSubmission?.releasedAt, "CURRENT_PUBLIC_SNAPSHOT_REQUIRED");
    assert.equal(item.latestSubmission.id, item.submissions.find(value => value.isLatest)?.id, "LATEST_PUBLIC_VERSION_MISMATCH");
    safeSnapshot(item.latestSubmission);
    return { httpStatus: 200, reportingStatus: item.status, latestPublicVersion: item.latestSubmission.version };
  });
  await check("private update preserves public v4 and exact null-versus-zero history", async () => {
    const result = await brandRead(fixture.campaignId);
    const item = result.json.items.find(value => value.id === fixture.pendingUpdateReportingItemId);
    assert.ok(item, "MEASURED_ZERO_HISTORY_REQUIRED");
    assert.equal(item.status, "ADMIN_REVIEW", "PRIVATE_UPDATE_REVIEW_REQUIRED");
    assert.equal(item.latestSubmission?.version, 4, "PUBLIC_V4_REQUIRED");
    assert.ok(metricKeys.every(key => item.latestSubmission.metrics[key] === null), "ALL_NULL_LATEST_METRICS_REQUIRED");
    assert.equal(item.latestSubmission.metricsAsOf, null, "ALL_NULL_MEASUREMENT_UNSET_REQUIRED");
    const zero = item.submissions.find(value => value.version === 3);
    assert.equal(zero.metrics.views, 0, "MEASURED_ZERO_NOT_PRESERVED");
    assert.equal(zero.metrics.comments, 0, "MEASURED_ZERO_NOT_PRESERVED");
    assert.equal(zero.metrics.impressions, null, "UNMEASURED_NULL_NOT_PRESERVED");
    assert.ok(item.submissions.every(value => value.version <= 4), "PRIVATE_UPDATE_VERSION_EXPOSED");
    assert.equal(item.submissions.filter(value => value.isLatest).length, 1, "SINGLE_LATEST_PUBLIC_VERSION_REQUIRED");
    item.submissions.forEach(safeSnapshot);
    return { httpStatus: 200, reportingStatus: item.status, latestPublicVersion: 4, publicVersions: item.submissions.map(value => value.version), zeroPreserved: true, nullPreserved: true };
  });
  await check("unreleased source is absent from brand endpoint and campaign detail", async () => {
    const cookie = await authenticate(platform, "owner");
    const [result, detail] = await Promise.all([
      call(platform, `/api/brand/reporting?campaignId=${qp(fixture.browserCampaignId)}`, { cookie }),
      call(platform, `/api/brand/campaigns/${qp(fixture.browserCampaignId)}`, { cookie }),
    ]);
    status(result, 200); status(detail, 200); publicData(result); publicData(detail);
    for (const items of [result.json.items, detail.json.performance.items]) {
      const item = items.find(value => value.id === fixture.browserReportingItemId);
      assert.equal(item?.status, "ADMIN_REVIEW", "PRIVATE_REVIEW_STATE_REQUIRED");
      assert.deepEqual(item.submissions, [], "UNRELEASED_SOURCE_EXPOSED");
      assert.equal(item.latestSubmission, null, "UNRELEASED_SOURCE_EXPOSED");
    }
    assert.equal(detail.json.campaign.reportingSummary.published, 0, "PRIVATE_REPORT_COUNTED_AS_PUBLIC");
    return { httpStatus: 200, reportingStatus: "ADMIN_REVIEW", exposedSubmissionCount: 0 };
  });
  await check("brand MEMBER receives the same released reports and summary", async () => {
    const owner = await brandRead(fixture.campaignId), member = await brandRead(fixture.campaignId, "member");
    assert.deepEqual(member.json, owner.json, "MEMBER_PUBLIC_REPORT_MISMATCH");
    const workspace = await call(platform, "/api/brand/workspace", { cookie: await authenticate(platform, "member") }); status(workspace, 200); publicData(workspace);
    const current = workspace.json.campaigns.find(value => value.id === fixture.campaignId)?.reportingSummary;
    const expected = report.checks.find(value => value.name === "brand workspace exposes real reporting summaries without source data" && value.status === "passed")?.reportingSummary;
    assert.ok(current && expected, "REPORTING_SUMMARY_REQUIRED");
    assert.deepEqual(current, expected, "MEMBER_REPORT_SUMMARY_MISMATCH");
    assert.equal(workspace.json.permissions.canManageCampaigns, false, "MEMBER_READ_ONLY_REQUIRED");
    return { httpStatus: 200, reportingSummary: current, canManageCampaigns: false };
  });
  for (const [name, campaignId, label] of [
    ["named brand campaign is isolated from QA organization", report.crossOrganizationCampaignId, "owner"],
    ["another brand cannot read QA reporting", fixture.campaignId, "outsider"],
  ]) await check(name, async () => { const result = await call(platform, `/api/brand/reporting?campaignId=${qp(campaignId)}`, { cookie: await authenticate(platform, label) }); status(result, 404); privateHeaders(result); return { httpStatus: 404 }; });

  await check("assigned agency reads its source and publication history without internal notes", async () => {
    const result = await call(platform, `/api/agency/reporting?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(platform, "agency") }); status(result, 200); privateHeaders(result);
    noKeys(result.json, new Set(["internalNote", "internalNotes", "payloadHash"]));
    assert.ok(!result.body.includes(`${fixture.prefix}-PRIVATE-ADMIN-NOTE`), "PRIVATE_ADMIN_MARKER_EXPOSED");
    const current = result.json.items.find(value => value.id === fixture.readyReportingItemId);
    assert.equal(current?.status, "PUBLISHED", "ASSIGNED_REPORT_MISSING");
    assert.ok(current.latestSubmission?.releasedSnapshot, "CURATED_RELEASE_HISTORY_REQUIRED");
    const updating = result.json.items.find(value => value.id === fixture.pendingUpdateReportingItemId);
    assert.ok(updating?.status === "ADMIN_REVIEW" && updating.latestSubmission?.version === 5 && !updating.latestSubmission.releasedSnapshot && !updating.latestSubmission.releasedAt, "PRIVATE_SOURCE_UPDATE_REQUIRED");
    return { httpStatus: 200, reportingStatus: current.status, privateUpdateVersion: updating.latestSubmission.version };
  });
  await check("agency MEMBER can read assignments but cannot submit", async () => {
    const result = await call(platform, `/api/agency/reporting?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(platform, "agency-member") }); status(result, 200); privateHeaders(result);
    noKeys(result.json, new Set(["internalNote", "internalNotes", "payloadHash"]));
    assert.equal(result.json.canSubmit, false, "MEMBER_SUBMISSION_FORBIDDEN");
    assert.ok(result.json.items.length > 0 && result.json.items.every(value => !value.canSubmit), "MEMBER_ITEM_SUBMISSION_FORBIDDEN");
    return { httpStatus: 200, canSubmit: false };
  });
  await check("unassigned agency cannot read another agency's reporting", async () => {
    const result = await call(platform, `/api/agency/reporting?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(platform, "other-agency") }); status(result, 404); privateHeaders(result); return { httpStatus: 404 };
  });
  await check("agency role cannot read admin reporting", async () => {
    const result = await call(admin, `/api/admin/reporting?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(admin, "agency") }); status(result, 403); privateHeaders(result); return { httpStatus: 403 };
  });
  await check("authorized admin sees the private update and separate released snapshots", async () => {
    const result = await call(admin, `/api/admin/reporting?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(admin, "admin") }); status(result, 200); privateHeaders(result);
    const updating = result.json.items.find(value => value.id === fixture.pendingUpdateReportingItemId);
    assert.ok(updating?.canReview && updating.status === "ADMIN_REVIEW" && updating.latestSubmission?.version === 5 && !updating.latestSubmission.releasedSnapshot, "ADMIN_PRIVATE_UPDATE_REQUIRED");
    assert.ok(updating.submissions.some(value => value.version === 4 && value.releasedSnapshot), "ADMIN_PUBLIC_SNAPSHOT_REQUIRED");
    return { httpStatus: 200, reportingStatus: updating.status, privateUpdateVersion: updating.latestSubmission.version, lastReleasedVersion: 4 };
  });
} catch (error) {
  const code = safeError(error), state = code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED" ? "blocked" : "failed";
  report.checks.push({ name: "reporting verification setup", status: state, code });
  console.log(`${state.toUpperCase()} reporting verification setup: ${code}`);
} finally {
  report.overall = report.checks.some(value => value.status === "failed") ? "failed" : report.checks.some(value => value.status === "blocked") ? "partial" : "passed";
  report.completedAt = new Date().toISOString();
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(report, null, 2));
  console.log(`RESULT ${report.overall}; non-secret verification report saved`);
  if (report.overall !== "passed") process.exitCode = 1;
}
