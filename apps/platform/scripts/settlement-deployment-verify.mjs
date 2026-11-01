import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Retained temporary QA accounts only. The only POST allowed by call() is genuine
// sign-in. No business mutation, fixture cleanup, or deployment bypass is performed.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const { values } = parseArgs({ options: {
  "fixture-file": { type: "string", default: "tmp/settlement-qa.json" },
  "retry-failed": { type: "boolean", default: false },
} });
const fixtureFile = resolve(root, values["fixture-file"]);
assert.equal((await stat(fixtureFile)).mode & 0o077, 0, "FIXTURE_FILE_MUST_BE_PRIVATE");
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));
assert.match(fixture.prefix, /^settlement-live-qa-\d+-[a-f0-9]{12}$/);
assert.ok(typeof fixture.password === "string" && fixture.password.length >= 24, "QA_PASSWORD_REQUIRED");
for (const label of ["owner", "member", "outsider", "agency", "agency-member", "other-agency", "admin"]) {
  const account = fixture.accounts[label];
  assert.equal(account.email, `${fixture.prefix}-${label}@example.invalid`, "QA_ACCOUNT_REQUIRED");
  assert.equal(account.userId, `${fixture.prefix}-${label}`, "QA_USER_REQUIRED");
  assert.ok(account.orgId.startsWith(`${fixture.prefix}-`), "QA_ORGANIZATION_REQUIRED");
}
for (const key of ["campaignId", "guardCampaignId", "browserCampaignId", "readyCampaignId"])
  assert.ok(fixture[key]?.startsWith(`${fixture.prefix}-campaign-`), "QA_CAMPAIGN_REQUIRED");
assert.match(fixture.brandInvoiceId, /^[a-zA-Z0-9_-]+$/);
assert.ok(Array.isArray(fixture.agencyPayoutIds) && fixture.agencyPayoutIds.length === 2 && fixture.agencyPayoutIds.every(id => /^[a-zA-Z0-9_-]+$/.test(id)), "QA_PAYOUT_IDS_REQUIRED");
const platform = "https://futures-medialab.vercel.app";
const admin = "https://futures-medialab-admin.vercel.app";
const outputFile = resolve(root, "output/settlement-review/production-verification.json");
const expected = { currency: "KRW", brand: "27021597764222.93", agency: "600000.01", otherAgency: "700000.02", suppliers: "1300000.03" };
const report = {
  checkedAt: new Date().toISOString(), platformOrigin: platform, adminOrigin: admin,
  qaPrefix: fixture.prefix, campaignId: fixture.campaignId, privateCampaignId: fixture.browserCampaignId,
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
const safeError = error => {
  const first = error?.message?.split("\n", 1)[0] ?? "";
  return /^[A-Z0-9_]+$/.test(first) ? first : error?.name ?? "ERROR";
};
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
  if (contentType.includes("application/json")) { try { json = JSON.parse(body); } catch { /* Bodies and credentials are never logged. */ } }
  if (!json && [401, 403, 302, 307, 308].includes(response.status) && (/text\/html/.test(contentType) || /vercel|sso/i.test(response.headers.get("location") ?? ""))) throw new Error("EXISTING_DEPLOYMENT_PROTECTION_BLOCKED");
  return { response, body, json };
}
function status(result, code) {
  if (result.response.status !== code) throw new Error(`HTTP_${result.response.status}_EXPECTED_${code}`);
  assert.ok(result.json, "JSON_RESPONSE_REQUIRED");
}
function privateHeaders(result) {
  const cache = result.response.headers.get("cache-control") ?? "";
  assert.ok(cache.includes("private") && cache.includes("no-store"), "PRIVATE_CACHE_REQUIRED");
  assert.equal(result.response.headers.get("x-content-type-options"), "nosniff", "NOSNIFF_REQUIRED");
}
function noKeys(value, forbidden) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbidden.has(key) && !/^source|^supplier/.test(key), "PRIVATE_FIELD_EXPOSED");
    noKeys(child, forbidden);
  }
}
function publicData(result, viewer) {
  privateHeaders(result);
  const fields = ["creatorId", "internalNote", "internalNotes", "externalPaymentReference", "payloadHash", "preparedById", "issuedById", "paidById", "submittedById", "adminReviewedById", "agencyFeedback", "source", "brandOrganizationId", "supplierOrganizationId"];
  if (viewer === "brand") fields.push("payouts", "agencyPayouts", "itemTotalAmount", "totalSupplierAmount");
  else fields.push("invoice", "invoices", "brandInvoice", "brandTotalAmount", "unitAmount", "lineAmount");
  noKeys(result.json, new Set(fields));
  for (const marker of [`${fixture.prefix}-PRIVATE-ADMIN-NOTE`, `${fixture.prefix}-PRIVATE-AGENCY-SOURCE`, ...Object.values(fixture.accounts).map(account => account.orgId)])
    assert.ok(!result.body.includes(marker), "PRIVATE_MARKER_EXPOSED");
}
function minor(value) {
  assert.match(value, /^(?:0|[1-9]\d*)\.\d{2}$/, "EXACT_DECIMAL_STRING_REQUIRED");
  const [whole, fraction] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction);
}
function statement(document, viewer) {
  assert.ok(["ISSUED", "PAID"].includes(document.status), "DRAFT_EXPOSED");
  assert.ok(["KRW", "USD", "CNY"].includes(document.currency), "CURRENCY_REQUIRED");
  assert.ok(Number.isFinite(Date.parse(document.completedAt)) && Number.isFinite(Date.parse(document.issuedAt)), "COMPLETION_AND_ISSUE_DATES_REQUIRED");
  assert.ok(Date.parse(document.issuedAt) >= Date.parse(document.completedAt), "ISSUE_BEFORE_COMPLETION");
  if (document.status === "PAID") assert.ok(document.paidAt && Date.parse(document.paidAt) >= Date.parse(document.issuedAt) && Date.parse(document.paidAt) <= Date.now(), "PAID_DATE_REQUIRED");
  else assert.equal(document.paidAt, null, "UNPAID_DATE_MUST_BE_EMPTY");
  if (document.dueAt) assert.ok(Number.isFinite(Date.parse(document.dueAt)), "DUE_DATE_INVALID");
  if (document.documentUrl) {
    const url = new URL(document.documentUrl);
    assert.ok(url.protocol === "https:" && !url.username && !url.password && !["localhost", "example.invalid"].includes(url.hostname), "SAFE_DOCUMENT_LINK_REQUIRED");
  }
  assert.ok(document.lines.length > 0, "STATEMENT_LINES_REQUIRED");
  let sum = 0n;
  for (const line of document.lines) {
    assert.ok(Number.isSafeInteger(line.quantity) && line.quantity > 0, "QUANTITY_REQUIRED");
    if (viewer === "brand") {
      assert.equal(minor(line.unitAmount) * BigInt(line.quantity), minor(line.lineAmount), "BRAND_LINE_TOTAL_MISMATCH");
      sum += minor(line.lineAmount);
    } else sum += minor(line.itemTotalAmount); // Item-total supply cost is applied once, regardless of quantity.
  }
  assert.equal(sum, minor(document.amount), "STATEMENT_TOTAL_MISMATCH");
}
async function persist() { await mkdir(dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); }
async function check(name, run) {
  if (report.checks.some(value => value.name === name && value.status === "passed")) return;
  try { report.checks.push({ name, status: "passed", ...await run() }); console.log(`PASS ${name}`); }
  catch (error) {
    const code = safeError(error), state = code === "EXISTING_DEPLOYMENT_PROTECTION_BLOCKED" ? "blocked" : "failed";
    report.checks.push({ name, status: state, code }); console.log(`${state.toUpperCase()} ${name}: ${code}`);
  }
  await persist();
}
const sessions = new Map();
function authenticate(origin, label) {
  const key = `${origin}:${label}`;
  if (!sessions.has(key)) {
    const promise = (async () => {
      const credentials = { email: fixture.accounts[label].email, password: fixture.password };
      let result = await call(origin, "/api/auth/sign-in/email", { credentials });
      if (result.response.status === 429) {
        const header = result.response.headers.get("retry-after"), seconds = Number(header);
        const requested = header && Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : 61000;
        let remaining = Math.max(61000, Number.isFinite(requested) ? requested + 1000 : 61000);
        assert.ok(remaining <= 300000, "SIGN_IN_COOLDOWN_EXCEEDS_RETRY_WINDOW");
        console.log("WAIT normal sign-in cooldown; no rate-limit bypass");
        while (remaining > 0) { const chunk = Math.min(remaining, 30000); await delay(chunk); remaining -= chunk; }
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
async function publicRead(viewer, campaignId, label = viewer === "brand" ? "owner" : "agency") {
  const result = await call(platform, `/api/${viewer}/settlement${campaignId ? `?campaignId=${qp(campaignId)}` : ""}`, { cookie: await authenticate(platform, label) });
  status(result, 200); publicData(result, viewer);
  for (const document of result.json[viewer === "brand" ? "invoices" : "payouts"]) statement(document, viewer);
  return result;
}
async function adminRead(campaignId) {
  const result = await call(admin, `/api/admin/settlement?campaignId=${qp(campaignId)}`, { cookie: await authenticate(admin, "admin") });
  status(result, 200); privateHeaders(result); return result;
}

await check("anonymous reads deny brand, agency and admin financial records", async () => {
  for (const [origin, path] of [[platform, "/api/brand/settlement"], [platform, "/api/agency/settlement"], [admin, `/api/admin/settlement?campaignId=${qp(fixture.campaignId)}`]]) {
    const result = await call(origin, path); status(result, 401); privateHeaders(result);
  }
  return { httpStatuses: [401, 401, 401] };
});
await check("brand reads only own issued and paid invoices", async () => {
  const result = await publicRead("brand"), invoice = result.json.invoices.find(value => value.id === fixture.brandInvoiceId);
  assert.ok(invoice, "PAID_INVOICE_REQUIRED");
  assert.equal(invoice.status, "PAID", "PAID_INVOICE_REQUIRED");
  assert.equal(invoice.currency, expected.currency, "EXPECTED_CURRENCY_REQUIRED");
  assert.equal(invoice.amount, expected.brand, "BRAND_AMOUNT_MISMATCH");
  assert.ok(result.json.invoices.every(value => value.campaignId.startsWith(`${fixture.prefix}-campaign-`)), "OTHER_TENANT_INVOICE_EXPOSED");
  assert.ok(result.json.invoices.every(value => value.campaignId !== fixture.browserCampaignId), "DRAFT_INVOICE_EXPOSED");
  return { httpStatus: 200, invoiceStatus: invoice.status, amount: invoice.amount, currency: invoice.currency };
});
await check("brand line arithmetic preserves exact high-value cents and excludes supplier amounts", async () => {
  const result = await publicRead("brand", fixture.campaignId);
  assert.equal(result.json.invoices.length, 1, "ONE_OWN_INVOICE_REQUIRED");
  const invoice = result.json.invoices[0];
  assert.deepEqual(invoice.lines.map(line => [line.quantity, line.unitAmount, line.lineAmount]).sort((a, b) => a[0] - b[0]), [[2, "0.10", "0.20"], [3, "9007199254740.91", "27021597764222.73"]], "EXACT_BRAND_LINE_AMOUNTS_REQUIRED");
  assert.ok(!result.body.includes(expected.agency) && !result.body.includes(expected.otherAgency) && !result.body.includes(expected.suppliers), "SUPPLIER_AMOUNT_EXPOSED");
  return { httpStatus: 200, exactDecimalArithmetic: true, lineCount: invoice.lines.length };
});
await check("completed campaign stays readable with paid invoice summary", async () => {
  const cookie = await authenticate(platform, "owner");
  const workspace = await call(platform, "/api/brand/workspace", { cookie }); status(workspace, 200); publicData(workspace, "brand");
  const detail = await call(platform, `/api/brand/campaigns/${qp(fixture.campaignId)}`, { cookie }); status(detail, 200); publicData(detail, "brand");
  const campaign = workspace.json.campaigns.find(value => value.id === fixture.campaignId);
  assert.equal(campaign?.status, "COMPLETED", "COMPLETED_CAMPAIGN_REQUIRED");
  assert.deepEqual(campaign.invoiceSummary, { issued: 0, paid: 1 }, "PAID_SUMMARY_REQUIRED");
  assert.equal(detail.json.campaign.status, "COMPLETED", "COMPLETED_DETAIL_REQUIRED");
  assert.deepEqual(detail.json.campaign.invoiceSummary, campaign.invoiceSummary, "DETAIL_SUMMARY_MISMATCH");
  assert.equal(detail.json.invoices[0]?.id, fixture.brandInvoiceId, "DETAIL_INVOICE_MISSING");
  return { httpStatus: 200, campaignStatus: "COMPLETED", invoiceSummary: campaign.invoiceSummary };
});
await check("completed but unissued brand invoice remains absent everywhere", async () => {
  const result = await publicRead("brand", fixture.browserCampaignId);
  assert.deepEqual(result.json.invoices, [], "DRAFT_INVOICE_EXPOSED");
  const detail = await call(platform, `/api/brand/campaigns/${qp(fixture.browserCampaignId)}`, { cookie: await authenticate(platform, "owner") }); status(detail, 200); publicData(detail, "brand");
  assert.equal(detail.json.campaign.status, "COMPLETED", "PRIVATE_COMPLETED_CAMPAIGN_REQUIRED");
  assert.deepEqual(detail.json.invoices, [], "DRAFT_DETAIL_INVOICE_EXPOSED");
  assert.deepEqual(detail.json.campaign.invoiceSummary, { issued: 0, paid: 0 }, "DRAFT_INVOICE_COUNTED_AS_PUBLIC");
  return { httpStatus: 200, publicInvoiceCount: 0 };
});
await check("assigned agency reads its paid item-total once without brand money", async () => {
  const result = await publicRead("agency", fixture.campaignId);
  assert.equal(result.json.payouts.length, 1, "ONE_OWN_PAYOUT_REQUIRED");
  const payout = result.json.payouts[0];
  assert.equal(payout.status, "PAID", "PAID_PAYOUT_REQUIRED");
  assert.equal(payout.amount, expected.agency, "AGENCY_AMOUNT_MISMATCH");
  assert.equal(payout.currency, expected.currency, "EXPECTED_CURRENCY_REQUIRED");
  assert.ok(fixture.agencyPayoutIds.includes(payout.id), "OWN_PAYOUT_ID_REQUIRED");
  assert.equal(payout.lines[0]?.quantity, 3, "MULTI_QUANTITY_ITEM_REQUIRED");
  assert.equal(payout.lines[0]?.itemTotalAmount, expected.agency, "SUPPLY_COST_MUST_NOT_BE_MULTIPLIED");
  assert.ok(!result.body.includes(expected.brand) && !result.body.includes(expected.otherAgency), "OTHER_PARTY_AMOUNT_EXPOSED");
  return { httpStatus: 200, payoutStatus: payout.status, amount: payout.amount, itemTotalAppliedOnce: true };
});
await check("second assigned agency sees only its own payout and no first-agency money", async () => {
  const result = await publicRead("agency", fixture.campaignId, "other-agency");
  assert.equal(result.json.payouts.length, 1, "ONE_OWN_PAYOUT_REQUIRED");
  const payout = result.json.payouts[0];
  assert.equal(payout.status, "PAID", "PAID_PAYOUT_REQUIRED");
  assert.equal(payout.amount, expected.otherAgency, "SECOND_AGENCY_AMOUNT_MISMATCH");
  assert.ok(fixture.agencyPayoutIds.includes(payout.id), "OWN_PAYOUT_ID_REQUIRED");
  assert.ok(!result.body.includes(expected.brand) && !result.body.includes(expected.agency), "OTHER_PARTY_AMOUNT_EXPOSED");
  return { httpStatus: 200, payoutStatus: payout.status, amount: payout.amount };
});
await check("draft agency payouts remain absent from filtered and unfiltered reads", async () => {
  for (const label of ["agency", "other-agency"]) {
    const result = await publicRead("agency", fixture.browserCampaignId, label);
    assert.deepEqual(result.json.payouts, [], "DRAFT_PAYOUT_EXPOSED");
    const all = await publicRead("agency", undefined, label);
    assert.ok(all.json.payouts.every(value => value.campaignId !== fixture.browserCampaignId && value.campaignId.startsWith(`${fixture.prefix}-campaign-`)), "DRAFT_OR_FOREIGN_PAYOUT_EXPOSED");
  }
  return { httpStatus: 200, publicDraftPayoutCount: 0 };
});
await check("brand MEMBER reads the identical invoice without management permission", async () => {
  const owner = await publicRead("brand", fixture.campaignId), member = await publicRead("brand", fixture.campaignId, "member");
  assert.deepEqual(member.json, owner.json, "MEMBER_INVOICE_MISMATCH");
  const workspace = await call(platform, "/api/brand/workspace", { cookie: await authenticate(platform, "member") }); status(workspace, 200); publicData(workspace, "brand");
  assert.equal(workspace.json.permissions.canManageCampaigns, false, "MEMBER_MANAGEMENT_FORBIDDEN");
  return { httpStatus: 200, canManageCampaigns: false, businessWritesAttempted: 0 };
});
await check("agency MEMBER reads the identical published payout", async () => {
  const owner = await publicRead("agency", fixture.campaignId), member = await publicRead("agency", fixture.campaignId, "agency-member");
  assert.deepEqual(member.json, owner.json, "MEMBER_PAYOUT_MISMATCH");
  assert.deepEqual(Object.keys(member.json), ["payouts"], "READ_ONLY_PAYOUT_RESPONSE_REQUIRED");
  return { httpStatus: 200, businessWritesAttempted: 0 };
});
await check("other brand and QA access to named campaigns are denied", async () => {
  for (const [label, campaignId] of [["outsider", fixture.campaignId], ["owner", report.crossOrganizationCampaignId]]) {
    const result = await call(platform, `/api/brand/settlement?campaignId=${qp(campaignId)}`, { cookie: await authenticate(platform, label) }); status(result, 404); privateHeaders(result);
  }
  return { httpStatuses: [404, 404] };
});
await check("unassigned campaign and cross-role finance access are denied", async () => {
  const cookie = await authenticate(platform, "agency");
  const named = await call(platform, `/api/agency/settlement?campaignId=${qp(report.crossOrganizationCampaignId)}`, { cookie }); status(named, 404); privateHeaders(named);
  const brand = await call(platform, "/api/brand/settlement", { cookie }); status(brand, 403); privateHeaders(brand);
  return { httpStatuses: [404, 403] };
});
await check("agency role cannot read the admin ledger", async () => {
  const result = await call(admin, `/api/admin/settlement?campaignId=${qp(fixture.campaignId)}`, { cookie: await authenticate(admin, "agency") }); status(result, 403); privateHeaders(result);
  return { httpStatus: 403 };
});
await check("admin sees paid brand and supplier ledgers separately after completion", async () => {
  const result = await adminRead(fixture.campaignId), value = result.json;
  assert.equal(value.campaignStatus, "COMPLETED", "COMPLETED_ADMIN_CAMPAIGN_REQUIRED");
  assert.ok(value.completion?.completedAt, "COMPLETION_RECORD_REQUIRED");
  assert.equal(value.invoice?.id, fixture.brandInvoiceId, "ADMIN_INVOICE_REQUIRED");
  assert.equal(value.invoice.status, "PAID", "ADMIN_PAID_INVOICE_REQUIRED");
  assert.equal(value.invoice.amount, expected.brand, "ADMIN_BRAND_AMOUNT_MISMATCH");
  assert.equal(value.brandTotalAmount, expected.brand, "ADMIN_BRAND_TOTAL_MISMATCH");
  assert.equal(value.totalSupplierAmount, expected.suppliers, "ADMIN_SUPPLIER_TOTAL_MISMATCH");
  assert.equal(value.payouts.length, 2, "TWO_SEPARATE_PAYOUTS_REQUIRED");
  assert.deepEqual(value.payouts.map(payout => payout.amount).sort(), [expected.agency, expected.otherAgency].sort(), "ADMIN_SUPPLIER_AMOUNTS_MISMATCH");
  assert.ok(value.payouts.every(payout => payout.status === "PAID" && fixture.agencyPayoutIds.includes(payout.id)), "ADMIN_PAID_PAYOUTS_REQUIRED");
  assert.equal(value.canComplete, false, "COMPLETED_CAMPAIGN_CANNOT_COMPLETE_AGAIN");
  assert.equal(value.canPrepare, false, "EXISTING_LEDGERS_CANNOT_PREPARE_AGAIN");
  return { httpStatus: 200, campaignStatus: value.campaignStatus, invoiceStatus: value.invoice.status, payoutCount: value.payouts.length };
});
await check("admin-only draft records and canceled completion guard remain intact", async () => {
  const result = await adminRead(fixture.browserCampaignId), value = result.json;
  assert.equal(value.campaignStatus, "COMPLETED", "PRIVATE_COMPLETED_CAMPAIGN_REQUIRED");
  assert.equal(value.invoice?.status, "DRAFT", "PRIVATE_DRAFT_INVOICE_REQUIRED");
  assert.equal(value.invoice.issuedAt, null, "PRIVATE_DRAFT_INVOICE_NOT_ISSUED");
  assert.equal(value.payouts.length, 2, "PRIVATE_DRAFT_PAYOUTS_REQUIRED");
  assert.ok(value.payouts.every(payout => payout.status === "DRAFT" && payout.issuedAt === null), "PRIVATE_DRAFT_PAYOUTS_NOT_ISSUED");
  const guard = await adminRead(fixture.guardCampaignId);
  assert.equal(guard.json.campaignStatus, "CANCELED", "CANCELED_GUARD_REQUIRED");
  assert.equal(guard.json.canComplete, false, "CANCELED_COMPLETION_FORBIDDEN");
  assert.equal(guard.json.completion, null, "CANCELED_COMPLETION_RECORD_FORBIDDEN");
  return { httpStatus: 200, privateInvoiceStatus: "DRAFT", privatePayoutCount: 2, canceledCampaignCanComplete: false };
});

report.completedAt = new Date().toISOString();
report.overall = report.checks.some(value => value.status === "failed") ? "failed" : report.checks.some(value => value.status === "blocked") ? "blocked" : "passed";
await persist();
console.log(`RESULT ${report.overall}: ${report.checks.filter(value => value.status === "passed").length}/${report.checks.length} checks`);
console.log("REPORT output/settlement-review/production-verification.json");
if (report.overall !== "passed") process.exitCode = 1;
