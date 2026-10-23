import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Compile the real handler and pure validators in memory. All auth/Prisma I/O
// is replaced below: this suite does not load environment files or use a DB.
const base = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(relative, overrides, cache = new Map()) {
  const filename = resolve(base, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith(".")) return compile(resolve(dirname(filename), `${specifier}.ts`), overrides, cache);
    return require(specifier);
  };
  runInThisContext(`(function(exports,require,module){${source}\n})`, { filename })(module.exports, localRequire, module);
  return module.exports;
}

const createdAt = new Date("2026-10-01T00:00:00Z");
const updatedAt = new Date("2026-10-02T00:00:00Z");
const decimal = (value) => ({ toFixed: () => value });
const campaign = {
  title: "Own campaign", status: "IN_PROGRESS", platforms: ["youtube"], contentDeadline: new Date("2026-11-01T00:00:00Z"),
  requirements: { internalSecret: "private-campaign-metadata" }, brandOrganizationId: "private-brand-id",
};
const application = {
  id: "app-own", campaignId: "campaign-own", agencyOrganizationId: "agency-own", status: "ACCEPTED",
  proposedAmount: decimal("100.00"), currency: "USD", createdAt, updatedAt, campaign,
  creators: [
    { creator: { id: "creator-own", agencyOrganizationId: "agency-own", displayName: "Creator", countryCode: "KR", isActive: true } },
    { creator: { id: "creator-foreign", agencyOrganizationId: "agency-other", displayName: "Must not leak", countryCode: "KR", isActive: true } },
  ],
  submissions: [{ id: "content-own", version: 1, status: "SUBMITTED", draftUrl: "javascript:alert(1)", publishedUrl: "https://user:password@example.com/video", reviewNotes: "Please update the draft.", submittedAt: createdAt, reviewedAt: null, verifiedAt: null, updatedAt }],
};
const settlement = {
  id: "settlement-own", applicationId: application.id, agencyOrganizationId: "agency-own", status: "PENDING", currency: "USD",
  grossAmount: decimal("100.00"), platformFeeAmount: decimal("20.00"), withholdingAmount: decimal("0.00"), netAmount: decimal("80.00"),
  createdAt, updatedAt, requestedAt: null, approvedAt: null, paidAt: null,
  transferReference: "private-transfer-reference", application: { agencyOrganizationId: "agency-own", campaign },
};
const profile = {
  organizationName: "Agency", agencyType: "agency", address: "Seoul", countryCode: "KR", establishedOn: "2020-01-01",
  contactName: "Contact", contactMethod: "email", contactValue: "private@example.com", businessLicenseId: "private-license",
  scopeOfBusiness: "Creator management", platformContact: "private-operator", businessDocumentId: "private-document-id", contractDocumentId: "",
};
function fixture(options = {}) {
  const calls = [];
  const organization = options.organization ?? {
    name: "Agency", status: "ACTIVE", countryCode: "KR",
    metadata: { agencyType: "agency", agencyProfile: profile, agencyProfileSubmittedAt: createdAt.toISOString(), internalSecret: "private-org-metadata" },
  };
  const member = options.member === null ? null : { organizationId: "agency-own", role: options.role ?? "OWNER", organization };
  const tx = {
    session: { findFirst: async (query) => { calls.push(["session", query]); return options.revoked ? null : { id: "session-own" }; } },
    organizationMember: { findFirst: async (query) => { calls.push(["member", query]); return member; } },
    campaignApplication: { findMany: async (query) => { calls.push(["applications", query]); return query.where.status === "ACCEPTED" ? options.projects ?? [] : options.applications ?? []; } },
    contentSubmission: { findMany: async (query) => { calls.push(["submissions", query]); return options.submissions ?? []; } },
    settlement: { findMany: async (query) => { calls.push(["settlements", query]); return options.settlements ?? []; } },
  };
  class Failure extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const handler = compile("lib/agency-operations.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
      getDatabase: () => ({ $transaction: async (callback, settings) => { calls.push(["transaction", settings]); return callback(tx); } }),
    },
    "./auth": { getAuth: () => ({ api: { getSession: async () => options.anonymous ? null : { user: { id: "user-own" }, session: { id: "session-own" } } } }) },
    "./workspace-api": {
      fail: (status, code) => { throw new Failure(status, code); },
      json: (value) => globalThis.Response.json(value, { headers: { "Cache-Control": "private, no-store" } }),
      rateLimit: async (user, bucket, limit) => { calls.push(["rateLimit", { user, bucket, limit }]); },
      workspaceBoundary: async (work) => {
        try { return await work(); } catch (error) {
          if (error instanceof Failure) return globalThis.Response.json({ code: error.code }, { status: error.status });
          throw error;
        }
      },
    },
  }).agencyOperations;
  return { calls, run: () => handler(new globalThis.Request("https://example.com/api/agency/operations?organizationId=agency-other")) };
}

test("anonymous and revoked sessions never reach organization or domain queries", async () => {
  const anonymous = fixture({ anonymous: true });
  assert.equal((await anonymous.run()).status, 401);
  assert.deepEqual(anonymous.calls, []);
  const revoked = fixture({ revoked: true });
  assert.equal((await revoked.run()).status, 401);
  assert.equal(revoked.calls.some(([name]) => name === "member" || name === "applications"), false);
  const session = revoked.calls.find(([name]) => name === "session")[1];
  assert.equal(session.where.id, "session-own");
  assert.equal(session.where.userId, "user-own");
  assert.ok(session.where.expiresAt.gt instanceof Date);
});

test("missing, suspended, pending and incomplete organizations are denied", async () => {
  const inputs = [
    { member: null },
    { organization: { name: "Agency", status: "SUSPENDED", metadata: { testWorkspaceAccess: true } } },
    { organization: { name: "Agency", status: "PENDING", metadata: { testWorkspaceAccess: true } } },
    { organization: { name: "Agency", status: "ACTIVE", metadata: {} } },
  ];
  for (const input of inputs) {
    const state = fixture(input);
    assert.equal((await state.run()).status, 403);
    assert.equal(state.calls.some(([name]) => name === "applications"), false);
  }
});

test("queries and returned records are scoped to the session organization; identities and private payloads are stripped", async () => {
  const foreign = { ...application, id: "app-other", agencyOrganizationId: "agency-other" };
  const state = fixture({
    projects: [application, foreign], applications: [application, foreign],
    submissions: [{ id: "content-own", status: "SUBMITTED", updatedAt, application: { agencyOrganizationId: "agency-own", campaign } }, { id: "content-other", status: "VERIFIED", updatedAt, application: { agencyOrganizationId: "agency-other", campaign } }],
    settlements: [settlement, { ...settlement, id: "settlement-other", agencyOrganizationId: "agency-other" }, { ...settlement, id: "settlement-mismatch", application: { agencyOrganizationId: "agency-other", campaign } }],
  });
  const response = await state.run();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(body.projects.map((item) => item.id), ["app-own"]);
  assert.deepEqual(body.projects[0].creators.map((item) => item.id), ["creator-own"]);
  assert.equal(body.projects[0].submissions[0].draftUrl, null);
  assert.equal(body.projects[0].submissions[0].publishedUrl, null);
  assert.deepEqual(body.settlements.map((item) => item.id), ["settlement-own"]);
  assert.equal(body.settlements[0].netAmount, "80.00");
  assert.equal(body.settlements[0].paidAt, null);
  assert.equal(body.activity.some((item) => item.entityId.includes("other")), false);
  assert.equal(body.activity.find((item) => item.kind === "application_created").status, "");
  const serialized = JSON.stringify(body);
  for (const secret of ["private-brand-id", "private-campaign-metadata", "private-org-metadata", "private-document-id", "private-transfer-reference", "creator-foreign", "agency-other"]) assert.equal(serialized.includes(secret), false, secret);
  const membership = state.calls.find(([name]) => name === "member")[1];
  assert.deepEqual(membership.where, { userId: "user-own", organization: { type: "AGENCY" } });
  for (const [name, query] of state.calls) {
    if (name === "applications") assert.equal(query.where.agencyOrganizationId, "agency-own");
    if (name === "submissions" || name === "settlements") assert.equal(query.where.application.agencyOrganizationId, "agency-own");
    if (name === "settlements") assert.equal(query.where.agencyOrganizationId, "agency-own");
  }
});

test("ordinary organizations cannot read demo projects, submissions, settlements or activity", async () => {
  const demo = { ...campaign, requirements: { demo: true } };
  const state = fixture({
    projects: [{ ...application, campaign: demo }], applications: [{ ...application, campaign: demo }],
    submissions: [{ id: "demo-submission", status: "SUBMITTED", updatedAt, application: { agencyOrganizationId: "agency-own", campaign: demo } }],
    settlements: [{ ...settlement, application: { agencyOrganizationId: "agency-own", campaign: demo } }],
  });
  const body = await (await state.run()).json();
  assert.deepEqual(body.projects, []);
  assert.deepEqual(body.settlements, []);
  assert.deepEqual(body.activity, []);
});

test("approved test access does not fabricate profile proof, review activity, settlements or supported mutations", async () => {
  const state = fixture({ organization: { name: "Test agency", status: "ACTIVE", countryCode: null, metadata: { testWorkspaceAccess: true, agencyType: "studio" } } });
  const body = await (await state.run()).json();
  assert.equal(body.organization.isTestWorkspace, true);
  assert.equal(body.organization.agencyType, "studio");
  assert.equal(body.organization.submittedAt, null);
  assert.equal(body.organization.profile.businessLicenseId, "");
  assert.deepEqual(body.projects, []);
  assert.deepEqual(body.settlements, []);
  assert.deepEqual(body.activity, []);
  assert.deepEqual(body.capabilities, { invitations: false, payouts: false, contentSubmission: false, activityHistory: false });
});

test("only approved explicit test access includes demo records with their demo label", async () => {
  const demo = { ...campaign, brandOrganizationId: "fm-demo-brand-agency-v1", requirements: {} };
  const state = fixture({
    organization: { name: "Test agency", status: "ACTIVE", countryCode: null, metadata: { testWorkspaceAccess: true } },
    projects: [{ ...application, campaign: demo }], applications: [{ ...application, campaign: demo }],
  });
  const body = await (await state.run()).json();
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0].isDemo, true);
  assert.ok(body.activity.every((event) => event.isDemo));
  for (const value of ["true", false, 1, null]) {
    const denied = fixture({ organization: { name: "Test agency", status: "ACTIVE", metadata: { testWorkspaceAccess: value } } });
    assert.equal((await denied.run()).status, 403);
  }
});

test("members receive non-sensitive organization details; review activity requires an actual approval timestamp", async () => {
  const state = fixture({ role: "MEMBER", organization: {
    name: "Agency", status: "ACTIVE", countryCode: "KR", metadata: {
      agencyType: "agency", agencyProfile: profile, agencyProfileSubmittedAt: createdAt.toISOString(),
      adminReview: { status: "APPROVED", reviewedAt: updatedAt.toISOString(), reason: "private-review-note" },
    },
  } });
  const body = await (await state.run()).json();
  assert.equal(body.organization.profile.address, "Seoul");
  for (const field of ["contactName", "contactValue", "businessLicenseId", "platformContact"]) assert.equal(body.organization.profile[field], "");
  assert.equal(body.activity.length, 1);
  assert.equal(body.activity[0].kind, "organization_review");
  assert.equal(body.activity[0].occurredAt, updatedAt.toISOString());
  assert.equal(JSON.stringify(body).includes("private-review-note"), false);
});

test("endpoint exposes GET only and delegates to the guarded handler", () => {
  const source = readFileSync(resolve(base, "app/api/agency/operations/route.ts"), "utf8");
  assert.match(source, /export const GET = agencyOperations/);
  assert.match(source, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(source, /export (?:const|function|async function) (?:POST|PUT|PATCH|DELETE)/);
});
