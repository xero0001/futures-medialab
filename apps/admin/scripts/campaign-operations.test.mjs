import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { campaignOperationsSchema, canReviewContent, matchesSettlementBudget, settlementAmounts } from "../lib/campaign-operations-validation.ts";

const base = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(relative, overrides, cache = new Map()) {
  const filename = resolve(base, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} }; cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
  const localRequire = (specifier) => Object.hasOwn(overrides, specifier) ? overrides[specifier] : specifier.startsWith(".") ? compile(resolve(dirname(filename), `${specifier}.ts`), overrides, cache) : require(specifier);
  runInThisContext(`(function(exports,require,module){${source}\n})`, { filename })(module.exports, localRequire, module);
  return module.exports;
}
const stamp = "2026-10-26T01:00:00.000Z";
const decimal = (value) => ({ toFixed: () => value, equals: (other) => value === other.value });
const app = () => ({ id: "application-1", campaignId: "campaign-1", agencyOrganizationId: "agency-1", status: "ACCEPTED", currency: "USD", proposedAmount: decimal("100.00"),
  agencyOrganization: { status: "ACTIVE" }, campaign: { status: "IN_PROGRESS", currency: "USD", budgetAmount: decimal("1000.00"), brandOrganization: { status: "ACTIVE" } },
  submissions: [{ id: "submission-1", version: 1, status: "SUBMITTED", reviewNotes: "", updatedAt: new Date(stamp), publishedUrl: null }], contract: null, settlement: null });
function fixture(overrides = {}) {
  const calls = [], current = { ...app(), ...overrides.application };
  const tx = {
    campaignApplication: { findFirst: async (query) => { calls.push(["application", query]); return overrides.missing ? null : current; } },
    contentSubmission: { update: async (query) => { calls.push(["submissionWrite", query]); return query.data; } },
    campaignContract: { create: async (query) => { calls.push(["contractWrite", query]); return { ...query.data, id: "contract-1", version: 0 }; }, update: async (query) => { calls.push(["contractWrite", query]); return { ...query.data, id: "contract-1", version: 1 }; } },
    settlement: { findMany: async () => overrides.otherSettlements ?? [], create: async (query) => { calls.push(["settlementWrite", query]); return { ...query.data, id: "settlement-1", version: 0 }; }, update: async (query) => { calls.push(["settlementWrite", query]); return { ...query.data, id: "settlement-1", version: 1 }; } },
    auditLog: { create: async (query) => { calls.push(["audit", query]); return query.data; } },
  };
  class Failure extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const fail = (status, code) => { throw new Failure(status, code); };
  const handler = compile("lib/campaign-operations.ts", {
    "server-only": {}, "@futures-medialab/database": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, Decimal: class { constructor(value) { this.value = value; } } },
      getDatabase: () => ({ $transaction: async (callback, settings) => { calls.push(["transaction", settings]); return callback(tx); } }) },
    "./access": { fail, json: (value) => globalThis.Response.json(value),
      requireAdmin: async () => { if (overrides.anonymous) fail(401, "UNAUTHORIZED"); if (overrides.nonAdmin) fail(403, "FORBIDDEN"); return { userId: "admin-1" }; },
      recheckAdmin: async () => { if (overrides.revoked) fail(401, "UNAUTHORIZED"); }, rateLimit: async () => {},
      verifyOrigin: (request) => { if (request.headers.get("origin") !== "https://admin.example") fail(403, "INVALID_ORIGIN"); },
      readBody: async (request, schema) => { const result = schema.safeParse(await request.json()); if (!result.success) fail(400, "INVALID_INPUT"); return result.data; },
      boundary: async (work) => { try { return await work(); } catch (error) { if (error instanceof Failure) return globalThis.Response.json({ code: error.code }, { status: error.status }); throw error; } },
    },
  }).mutateCampaignOperations;
  return { calls, run: (input, origin = "https://admin.example") => handler(new globalThis.Request("https://admin.example/api/admin/campaign-operations", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ campaignId: "campaign-1", applicationId: "application-1", reason: "Reviewed with evidence", ...input }) })) };
}
const review = { action: "reviewContent", submissionId: "submission-1", expectedUpdatedAt: stamp, status: "APPROVED" };
const prepare = { action: "prepareSettlement", expectedVersion: null, grossAmount: "100.00", platformFeeAmount: "20", withholdingAmount: "3.25" };
const existingSettlement = () => ({ id: "settlement-1", agencyOrganizationId: "agency-1", currency: "USD", status: "REQUESTED", version: 0,
  grossAmount: decimal("100.00"), platformFeeAmount: decimal("20.00"), withholdingAmount: decimal("3.25"), netAmount: decimal("76.75") });

test("strict actions exclude payment, electronic signatures and forged fields", () => {
  const input = { campaignId: "campaign-1", applicationId: "application-1", reason: "test", ...prepare };
  assert.equal(campaignOperationsSchema.safeParse(input).success, true);
  for (const patch of [{ action: "pay" }, { status: "PAID" }, { currency: "CNY" }, { netAmount: "500" }, { reason: " " }]) assert.equal(campaignOperationsSchema.safeParse({ ...input, ...patch }).success, false);
});
test("money validation is exact up to Decimal(18,2) and rejects negative, exponent, rounding or excess deductions", () => {
  assert.deepEqual(settlementAmounts("100", "20", "3.25"), { grossAmount: "100.00", platformFeeAmount: "20.00", withholdingAmount: "3.25", netAmount: "76.75" });
  assert.equal(settlementAmounts("9999999999999999.99", "0", "0").netAmount, "9999999999999999.99");
  for (const values of [["0", "0", "0"], ["1", "0.50", "0.51"], ["1", "-1", "0"], ["1e9", "0", "0"], ["1.001", "0", "0"], ["10000000000000000", "0", "0"]]) assert.equal(settlementAmounts(...values), null);
});
test("review state machine cannot jump from draft/submitted to verified or rewrite a verified record", () => {
  assert.equal(canReviewContent("SUBMITTED", "APPROVED"), true);
  assert.equal(canReviewContent("PUBLISHED", "VERIFIED"), true);
  for (const [from, to] of [["SUBMITTED", "VERIFIED"], ["DRAFT", "APPROVED"], ["VERIFIED", "REVISION_REQUESTED"], ["APPROVED", "VERIFIED"]]) assert.equal(canReviewContent(from, to), false);
});
test("gross must match proposal and all non-rejected settlements share the campaign budget", () => {
  assert.equal(matchesSettlementBudget("100", "100.00", "1000", ["900"]), true);
  assert.equal(matchesSettlementBudget("100.01", "100.00", "1000", []), false);
  assert.equal(matchesSettlementBudget("100", "100", "1000", ["900.01"]), false);
  assert.equal(matchesSettlementBudget("100", null, "99.99", []), false);
});
test("anonymous, non-admin, revoked and cross-origin writes are denied before domain reads", async () => {
  for (const options of [{ anonymous: true }, { nonAdmin: true }, { revoked: true }]) {
    const f = fixture(options); assert.ok([401, 403].includes((await f.run(review)).status)); assert.equal(f.calls.some(([name]) => name === "application"), false);
  }
  const f = fixture(); assert.equal((await f.run(review, "https://evil.example")).status, 403); assert.equal(f.calls.length, 0);
});
test("operations require accepted application, live organizations and open campaign", async () => {
  for (const application of [{ status: "SUBMITTED" }, { agencyOrganization: { status: "SUSPENDED" } }, { campaign: { status: "CANCELED", brandOrganization: { status: "ACTIVE" } } }, { campaign: { status: "IN_PROGRESS", brandOrganization: { status: "PENDING" } } }]) {
    const f = fixture({ application }); assert.equal((await f.run(review)).status, 409); assert.equal(f.calls.some(([name]) => name.endsWith("Write") || name === "audit"), false);
  }
});
test("latest content version, optimistic timestamp and audit are enforced", async () => {
  const f = fixture(); assert.equal((await f.run(review)).status, 200);
  assert.deepEqual(f.calls.find(([name]) => name === "application")[1].where, { id: "application-1", campaignId: "campaign-1" });
  assert.equal(f.calls.find(([name]) => name === "transaction")[1].isolationLevel, "Serializable");
  assert.equal(f.calls.find(([name]) => name === "submissionWrite")[1].data.status, "APPROVED");
  assert.equal(f.calls.find(([name]) => name === "audit")[1].data.payload.before.status, "SUBMITTED");
  for (const patch of [{ submissionId: "foreign" }, { expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }, { status: "VERIFIED" }]) assert.equal((await fixture().run({ ...review, ...patch })).status, 409);
});
test("contract confirmation needs HTTPS reference, current revision and retains audit trail", async () => {
  const input = { action: "saveContract", expectedVersion: null, status: "CONFIRMED", referenceUrl: "https://example.com/contract", notes: "External reference only" };
  const f = fixture(); assert.equal((await f.run(input)).status, 200); assert.equal(f.calls.find(([name]) => name === "contractWrite")[1].data.status, "CONFIRMED");
  assert.equal((await fixture().run({ ...input, referenceUrl: "" })).status, 400);
  assert.equal((await fixture().run({ ...input, referenceUrl: "javascript:alert(1)" })).status, 400);
  assert.equal((await fixture({ application: { contract: { version: 3 } } }).run(input)).status, 409);
});
test("settlement preparation computes net on server, derives currency and never creates a payout", async () => {
  const f = fixture(); assert.equal((await f.run(prepare)).status, 200);
  const values = f.calls.find(([name]) => name === "settlementWrite")[1].data;
  assert.equal(values.netAmount, "76.75"); assert.equal(values.currency, "USD"); assert.equal(values.status, "REQUESTED"); assert.equal(values.agencyOrganizationId, "agency-1"); assert.equal("paidAt" in values, false);
  assert.equal((await fixture().run({ ...prepare, withholdingAmount: "90" })).status, 400);
  assert.equal((await fixture().run({ ...prepare, grossAmount: "101" })).status, 409);
  assert.equal((await fixture({ otherSettlements: [{ currency: "USD", grossAmount: decimal("950.00") }] }).run(prepare)).status, 409);
  assert.equal((await fixture({ application: { currency: "CNY" } }).run(prepare)).status, 409);
  assert.equal((await fixture({ application: { settlement: { ...existingSettlement(), status: "PAID" } } }).run({ ...prepare, expectedVersion: 0 })).status, 409);
});
test("settlement approval requires contract plus verified latest content, matching tenant/currency and correct net", async () => {
  const application = { contract: { status: "CONFIRMED", referenceUrl: "https://example.com/contract" }, submissions: [{ status: "VERIFIED", verifiedAt: new Date(stamp), publishedUrl: "https://example.com/published" }], settlement: existingSettlement() };
  const input = { action: "reviewSettlement", expectedVersion: 0, status: "APPROVED" };
  const f = fixture({ application }); assert.equal((await f.run(input)).status, 200);
  assert.equal(f.calls.find(([name]) => name === "settlementWrite")[1].data.status, "APPROVED");
  for (const patch of [{ contract: null }, { contract: { status: "CONFIRMED", referenceUrl: null } }, { submissions: [{ status: "PUBLISHED" }] }, { submissions: [{ status: "VERIFIED", verifiedAt: null, publishedUrl: null }] }, { settlement: { ...existingSettlement(), agencyOrganizationId: "foreign" } }, { settlement: { ...existingSettlement(), currency: "CNY" } }, { settlement: { ...existingSettlement(), netAmount: decimal("100.00") } }]) assert.equal((await fixture({ application: { ...application, ...patch } }).run(input)).status, 409);
});
