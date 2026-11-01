import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { Buffer } from "node:buffer";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Production business data is read-only. The only POST allowed here is genuine
// sign-in with credentials from the isolated, retained production QA namespace.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { values } = parseArgs({ options: {
  "fixture-file": { type: "string", default: "tmp/production-qa.json" },
  "retry-failed": { type: "boolean", default: false },
  "expected-browser-status": { type: "string", default: "APPROVED" },
} });
const fixtureFile = resolve(root, values["fixture-file"]);
assert.equal((await stat(fixtureFile)).mode & 0o077, 0, "FIXTURE_FILE_MUST_BE_PRIVATE");
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));
assert.match(fixture.prefix, /^production-live-qa-\d+-[a-f0-9]{12}$/);
assert.ok(typeof fixture.password === "string" && fixture.password.length >= 24, "QA_PASSWORD_REQUIRED");
for (const label of ["owner", "member", "outsider", "agency", "other-agency", "admin"]) {
  const account = fixture.accounts[label];
  assert.equal(account.email, `${fixture.prefix}-${label}@example.invalid`, "QA_ACCOUNT_REQUIRED");
  assert.equal(account.userId, `${fixture.prefix}-${label}`, "QA_USER_REQUIRED");
  assert.ok(account.orgId.startsWith(`${fixture.prefix}-`), "QA_ORGANIZATION_REQUIRED");
}
for (const key of ["campaignId", "guardCampaignId", "browserCampaignId", "readyCampaignId"])
  assert.ok(fixture[key].startsWith(`${fixture.prefix}-campaign-`), "QA_CAMPAIGN_REQUIRED");
assert.match(fixture.browserProductionItemId, /^[a-zA-Z0-9_-]+$/);
assert.match(fixture.readyProductionItemId, /^[a-zA-Z0-9_-]+$/);
assert.ok(["ADMIN_REVIEW", "BRAND_REVIEW", "BRAND_REVISION", "APPROVED"].includes(values["expected-browser-status"]), "EXPECTED_STATUS_INVALID");

const platform = "https://futures-medialab.vercel.app";
const admin = "https://futures-medialab-admin.vercel.app";
const outputFile = resolve(root, "output/production-review/production-verification.json");
const report = {
  checkedAt: new Date().toISOString(), platformOrigin: platform, adminOrigin: admin,
  qaPrefix: fixture.prefix, campaignId: fixture.campaignId,
  reviewedCampaignId: fixture.readyCampaignId, privateCampaignId: fixture.browserCampaignId,
  crossOrganizationCampaignId: "fm-demo-nte-production-v1-campaign-brand-review",
  expectedBrowserStatus: values["expected-browser-status"],
  mode: "read-only business verification; authentication sign-in only",
  checks: [], overall: "pending",
};
if (values["retry-failed"]) {
  const previous = JSON.parse(await readFile(outputFile, "utf8"));
  assert.equal(previous.qaPrefix, fixture.prefix, "RETRY_NAMESPACE_MISMATCH");
  assert.equal(previous.platformOrigin, platform, "RETRY_ORIGIN_MISMATCH");
  assert.equal(previous.adminOrigin, admin, "RETRY_ORIGIN_MISMATCH");
  report.checks = previous.checks.filter(value => value.status === "passed");
  report.previousAttempts = [...(previous.previousAttempts ?? []), {
    checkedAt: previous.checkedAt, completedAt: previous.completedAt,
    failedChecks: previous.checks.filter(value => value.status !== "passed"),
  }];
}
const qp = (id) => encodeURIComponent(id);
async function request(origin, path, { cookie, credentials } = {}) {
  assert.ok([platform, admin].includes(origin), "UNEXPECTED_ORIGIN");
  assert.ok(path.startsWith("/api/") || path.startsWith("/demo/nte/"), "UNEXPECTED_PATH");
  assert.ok(!credentials || path === "/api/auth/sign-in/email", "BUSINESS_WRITES_FORBIDDEN");
  const response = await globalThis.fetch(`${origin}${path}`, {
    method: credentials ? "POST" : "GET", redirect: "manual", signal: globalThis.AbortSignal.timeout(45000),
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(credentials ? { Origin: origin, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" } : {}) },
    ...(credentials ? { body: JSON.stringify(credentials) } : {}),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "";
  let body = "", json = null;
  if (!contentType.startsWith("image/")) {
    body = new globalThis.TextDecoder().decode(bytes);
    if (contentType.includes("application/json")) {
      try { json = JSON.parse(body); } catch { /* Report only a safe failure code. */ }
    }
  }
  const protection = !json && [401, 403, 302, 307, 308].includes(response.status) && (/text\/html/.test(contentType) || /vercel|sso/i.test(response.headers.get("location") ?? ""));
  if (protection) throw new Error("EXISTING_DEPLOYMENT_PROTECTION_BLOCKED");
  return { response, bytes, body, json };
}
function status(result, expected, json = true) {
  if (result.response.status !== expected) throw new Error(`HTTP_${result.response.status}_EXPECTED_${expected}`);
  assert.ok(!json || result.json, "JSON_RESPONSE_REQUIRED");
}
function privateHeaders(result) {
  const value = result.response.headers.get("cache-control") ?? "";
  assert.ok(value.includes("private") && value.includes("no-store"), "PRIVATE_CACHE_REQUIRED");
}
function noKeys(value, forbidden) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbidden.has(key), "PRIVATE_FIELD_EXPOSED");
    noKeys(child, forbidden);
  }
}
function publicData(result) {
  privateHeaders(result);
  noKeys(result.json, new Set(["creatorId", "supplierOrganizationId", "supplierName", "supplierCost", "internalNote", "internalNotes", "agencyFeedback", "sourceTitle", "sourceUrl", "sourceNote", "submittedById", "adminReviewedById", "payloadHash"]));
  for (const value of [`${fixture.prefix}-PRIVATE-ADMIN-NOTE`, `${fixture.prefix}-PRIVATE-AGENCY-SOURCE`, fixture.accounts.agency.orgId, fixture.accounts["other-agency"].orgId])
    assert.ok(!result.body.includes(value), "PRIVATE_MARKER_EXPOSED");
}
async function check(name, run) {
  if (report.checks.some(value => value.name === name && value.status === "passed")) return;
  try {
    const metadata = await run();
    report.checks.push({ name, status: "passed", ...metadata });
    console.log(`PASS ${name}`);
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error?.message ?? "") ? error.message : error?.name ?? "ERROR";
    const state = code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED" ? "blocked" : "failed";
    report.checks.push({ name, status: state, code });
    console.log(`${state.toUpperCase()} ${name}: ${code}`);
  }
}
const sessions = new Map();
async function authenticate(origin, label) {
  const sessionKey = `${origin}:${label}`;
  if (sessions.has(sessionKey)) return sessions.get(sessionKey);
  let result = await request(origin, "/api/auth/sign-in/email", { credentials: { email: fixture.accounts[label].email, password: fixture.password } });
  if (result.response.status === 429) {
    console.log("WAIT normal sign-in cooldown; no rate-limit bypass");
    await delay(30500);
    await delay(30500);
    result = await request(origin, "/api/auth/sign-in/email", { credentials: { email: fixture.accounts[label].email, password: fixture.password } });
  }
  status(result, 200);
  const cookies = result.response.headers.getSetCookie();
  assert.ok(cookies.some(value => value.split("=", 1)[0].endsWith("session_token")), "SESSION_COOKIE_REQUIRED");
  if (!report.checks.some(value => value.name === `${label} production sign-in` && value.status === "passed")) report.checks.push({ name: `${label} production sign-in`, status: "passed", httpStatus: 200 });
  console.log(`PASS ${label} production sign-in`);
  const cookie = cookies.map(value => value.split(";", 1)[0]).join("; ");
  sessions.set(sessionKey, cookie);
  return cookie;
}

try {
  await check("official local game assets are valid image responses", async () => {
    const [cover, icon] = await Promise.all([
      request(platform, "/demo/nte/city-key-art.jpg"), request(platform, "/demo/nte/game-icon.png"),
    ]);
    status(cover, 200, false); status(icon, 200, false);
    assert.ok(cover.response.headers.get("content-type")?.includes("image/jpeg"), "JPEG_CONTENT_TYPE_REQUIRED");
    assert.ok(icon.response.headers.get("content-type")?.includes("image/png"), "PNG_CONTENT_TYPE_REQUIRED");
    assert.equal(Buffer.from(cover.bytes.slice(0, 3)).toString("hex"), "ffd8ff", "JPEG_SIGNATURE_REQUIRED");
    assert.equal(Buffer.from(icon.bytes.slice(0, 8)).toString("hex"), "89504e470d0a1a0a", "PNG_SIGNATURE_REQUIRED");
    return { httpStatus: 200, coverBytes: cover.bytes.length, iconBytes: icon.bytes.length };
  });
  for (const [name, origin, path] of [
    ["anonymous brand production read is denied", platform, `/api/brand/production?campaignId=${qp(fixture.readyCampaignId)}`],
    ["anonymous agency production read is denied", platform, "/api/agency/production"],
    ["anonymous admin production read is denied", admin, `/api/admin/production?campaignId=${qp(fixture.readyCampaignId)}`],
  ]) await check(name, async () => { const result = await request(origin, path); status(result, 401); privateHeaders(result); return { httpStatus: 401 }; });

  const owner = () => authenticate(platform, "owner");
  let ownerCount = report.checks.find(value => value.name === "brand workspace exposes real production counts and safe summaries")?.waitingContentReviews;
  await check("brand workspace exposes real production counts and safe summaries", async () => {
    const result = await request(platform, "/api/brand/workspace", { cookie: await owner() }); status(result, 200); publicData(result);
    assert.equal(result.json.capabilities.productionReview, true, "PRODUCTION_CAPABILITY_REQUIRED");
    ownerCount = result.json.counts.waitingContentReviews;
    assert.ok(Number.isInteger(ownerCount) && ownerCount >= 0, "ACTUAL_REVIEW_COUNT_REQUIRED");
    const campaign = result.json.campaigns.find(value => value.id === fixture.readyCampaignId);
    assert.ok(campaign?.productionSummary.total >= 1, "ACTUAL_PRODUCTION_SUMMARY_REQUIRED");
    return { httpStatus: 200, waitingContentReviews: ownerCount, browserProductionItems: campaign.productionSummary.total };
  });
  await check("browser-reviewed content persists as public snapshots only", async () => {
    const result = await request(platform, `/api/brand/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await owner() }); status(result, 200); publicData(result);
    const item = result.json.items.find(value => value.id === fixture.readyProductionItemId);
    assert.ok(item, "BROWSER_ITEM_REQUIRED");
    assert.equal(item.status, values["expected-browser-status"], "BROWSER_STATUS_NOT_PERSISTED");
    if (item.status === "ADMIN_REVIEW") assert.equal(item.canRespond, false, "UNRELEASED_RESPONSE_FORBIDDEN");
    else assert.ok(item.latestSubmission?.releasedAt, "RELEASED_SNAPSHOT_REQUIRED");
    if (item.status === "APPROVED") {
      assert.equal(item.latestSubmission.brandDecision, "APPROVE", "BRAND_APPROVAL_REQUIRED");
      assert.equal(item.canRespond, false, "APPROVED_RESPONSE_FORBIDDEN");
    }
    return { httpStatus: 200, productionStatus: item.status, releasedVersions: item.submissions.length, canRespond: item.canRespond };
  });
  await check("campaign detail returns the same authorized production item", async () => {
    const result = await request(platform, `/api/brand/campaigns/${qp(fixture.readyCampaignId)}`, { cookie: await owner() }); status(result, 200); publicData(result);
    assert.ok(result.json.deliverables.some(value => value.id === fixture.readyProductionItemId), "DETAIL_PRODUCTION_ITEM_REQUIRED");
    assert.ok(result.json.proposals.some(value => value.status === "APPROVED"), "APPROVED_PROPOSAL_REQUIRED");
    return { httpStatus: 200, campaignStatus: result.json.campaign.status, productionItemCount: result.json.deliverables.length };
  });
  await check("unreleased agency source stays absent from every brand response", async () => {
    const [production, detail] = await Promise.all([
      request(platform, `/api/brand/production?campaignId=${qp(fixture.browserCampaignId)}`, { cookie: await owner() }),
      request(platform, `/api/brand/campaigns/${qp(fixture.browserCampaignId)}`, { cookie: await owner() }),
    ]);
    status(production, 200); status(detail, 200); publicData(production); publicData(detail);
    for (const items of [production.json.items, detail.json.deliverables]) {
      const item = items.find(value => value.id === fixture.browserProductionItemId);
      assert.equal(item?.status, "ADMIN_REVIEW", "PRIVATE_REVIEW_STATE_REQUIRED");
      assert.deepEqual(item.submissions, [], "UNRELEASED_SOURCE_EXPOSED");
      assert.equal(item.latestSubmission, null, "UNRELEASED_SOURCE_EXPOSED");
      assert.equal(item.canRespond, false, "UNRELEASED_RESPONSE_FORBIDDEN");
    }
    return { httpStatus: 200, productionStatus: "ADMIN_REVIEW", exposedSubmissionCount: 0 };
  });
  await check("completed API flow retains approved released version history", async () => {
    const result = await request(platform, `/api/brand/production?campaignId=${qp(fixture.campaignId)}`, { cookie: await owner() }); status(result, 200); publicData(result);
    const approved = result.json.items.find(value => value.status === "APPROVED" && value.submissions.length >= 2);
    assert.ok(approved && approved.submissions.length >= 2, "APPROVED_VERSION_HISTORY_REQUIRED");
    assert.equal(approved.canRespond, false, "APPROVED_RESPONSE_FORBIDDEN");
    return { httpStatus: 200, productionStatus: approved.status, releasedVersions: approved.submissions.length };
  });
  await check("superseded proposal content remains read-only", async () => {
    const result = await request(platform, `/api/brand/production?campaignId=${qp(fixture.guardCampaignId)}`, { cookie: await owner() }); status(result, 200); publicData(result);
    assert.ok(result.json.items.length > 0 && result.json.items.every(value => !value.canRespond && value.submissions.every(version => !version.canRespond)), "SUPERSEDED_CONTENT_RESPONSE_FORBIDDEN");
    return { httpStatus: 200, productionItemCount: result.json.items.length, canRespond: false };
  });
  await check("named brand campaign is isolated from the QA organization", async () => {
    const result = await request(platform, `/api/brand/production?campaignId=${qp(report.crossOrganizationCampaignId)}`, { cookie: await owner() }); status(result, 404); privateHeaders(result); return { httpStatus: 404 };
  });

  const member = () => authenticate(platform, "member");
  await check("brand MEMBER sees actual counts with read-only production", async () => {
    const [workspace, content] = await Promise.all([
      request(platform, "/api/brand/workspace", { cookie: await member() }), request(platform, `/api/brand/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await member() }),
    ]);
    status(workspace, 200); status(content, 200); publicData(workspace); publicData(content);
    assert.equal(workspace.json.counts.waitingContentReviews, ownerCount, "MEMBER_REVIEW_COUNT_MISMATCH");
    assert.ok(content.json.items.every(value => !value.canRespond), "MEMBER_RESPONSE_FORBIDDEN");
    return { httpStatus: 200, waitingContentReviews: ownerCount, canRespond: false };
  });
  const outsider = () => authenticate(platform, "outsider");
  await check("another brand cannot read QA production", async () => {
    const result = await request(platform, `/api/brand/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await outsider() }); status(result, 404); privateHeaders(result); return { httpStatus: 404 };
  });
  const agency = () => authenticate(platform, "agency");
  await check("assigned agency can read its submissions without internal notes", async () => {
    const result = await request(platform, `/api/agency/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await agency() }); status(result, 200); privateHeaders(result);
    noKeys(result.json, new Set(["internalNote", "internalNotes", "payloadHash"]));
    assert.ok(!result.body.includes(`${fixture.prefix}-PRIVATE-ADMIN-NOTE`), "PRIVATE_ADMIN_MARKER_EXPOSED");
    const item = result.json.items.find(value => value.id === fixture.readyProductionItemId);
    assert.ok(item?.submissions.length >= 1, "ASSIGNED_SOURCE_HISTORY_REQUIRED");
    assert.equal(item.status, values["expected-browser-status"], "AGENCY_STATUS_MISMATCH");
    return { httpStatus: 200, productionStatus: item.status, submittedVersions: item.submissions.length };
  });
  const otherAgency = () => authenticate(platform, "other-agency");
  await check("unassigned agency cannot read another agency's production", async () => {
    const result = await request(platform, `/api/agency/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await otherAgency() }); status(result, 404); privateHeaders(result); return { httpStatus: 404 };
  });
  const administrator = () => authenticate(admin, "admin");
  await check("authorized admin production endpoint matches the stored workflow", async () => {
    const result = await request(admin, `/api/admin/production?campaignId=${qp(fixture.readyCampaignId)}`, { cookie: await administrator() }); status(result, 200); privateHeaders(result);
    const item = result.json.items.find(value => value.id === fixture.readyProductionItemId);
    assert.ok(item, "ADMIN_ITEM_REQUIRED");
    assert.equal(item.status, values["expected-browser-status"], "ADMIN_STATUS_MISMATCH");
    assert.ok(item.submissions.length >= 1, "ADMIN_SOURCE_HISTORY_REQUIRED");
    return { httpStatus: 200, productionStatus: item.status, submittedVersions: item.submissions.length };
  });
} catch (error) {
  const code = /^[A-Z0-9_]+$/.test(error?.message ?? "") ? error.message : error?.name ?? "ERROR";
  const state = code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED" ? "blocked" : "failed";
  report.checks.push({ name: "production verification setup", status: state, code });
  console.log(`${state.toUpperCase()} production verification setup: ${code}`);
} finally {
  report.overall = report.checks.some(value => value.status === "failed") ? "failed" : report.checks.some(value => value.status === "blocked") ? "partial" : "passed";
  report.completedAt = new Date().toISOString();
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(report, null, 2));
  console.log(`RESULT ${report.overall}; non-secret verification report saved`);
  if (report.overall !== "passed") process.exitCode = 1;
}
