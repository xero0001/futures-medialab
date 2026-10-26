import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { agencyContentSchema, canSubmitContent } from "../lib/agency-content-validation.ts";

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
const input = { action: "submitDraft", applicationId: "application-own", expectedSubmissionId: null, expectedUpdatedAt: null, url: "https://example.com/draft" };
const latest = { id: "content-own", version: 1, status: "APPROVED", updatedAt: new Date(stamp) };
function fixture(options = {}) {
  const calls = [];
  const app = { id: "application-own", campaignId: "campaign-own", status: "ACCEPTED", submissions: [], settlement: null,
    campaign: { status: "IN_PROGRESS", brandOrganizationId: "brand-own", requirements: {}, brandOrganization: { status: "ACTIVE" } }, ...options.application };
  const tx = {
    session: { findFirst: async () => options.revoked ? null : { id: "session-own" } },
    organizationMember: { findFirst: async (query) => { calls.push(["member", query]); return options.noMember ? null : { organizationId: "agency-own", role: options.role ?? "OWNER", organization: { status: options.orgStatus ?? "ACTIVE", metadata: options.incomplete ? {} : { testWorkspaceAccess: true } } }; } },
    campaignApplication: { findFirst: async (query) => { calls.push(["application", query]); return options.foreign ? null : app; } },
    contentSubmission: { create: async (query) => { calls.push(["create", query]); return { id: "new-content", ...query.data }; }, update: async (query) => { calls.push(["update", query]); return { ...latest, ...query.data }; } },
    auditLog: { create: async (query) => { calls.push(["audit", query]); return query.data; } },
  };
  class Failure extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const fail = (status, code) => { throw new Failure(status, code); };
  const handler = compile("lib/agency-content.ts", {
    "server-only": {}, "@futures-medialab/database": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } }, getDatabase: () => ({ $transaction: async (callback, settings) => { calls.push(["transaction", settings]); return callback(tx); } }) },
    "./auth": { getAuth: () => ({ api: { getSession: async () => options.anonymous ? null : { user: { id: "user-own" }, session: { id: "session-own" } } } }) },
    "./workspace-api": { fail, json: (value) => globalThis.Response.json(value), rateLimit: async () => {},
      verifyOrigin: (request) => { if (request.headers.get("origin") !== "https://platform.example") fail(403, "INVALID_ORIGIN"); },
      readBody: async (request, schema) => { const result = schema.safeParse(await request.json()); if (!result.success) fail(400, "INVALID_INPUT"); return result.data; },
      workspaceBoundary: async (work) => { try { return await work(); } catch (error) { if (error instanceof Failure) return globalThis.Response.json({ code: error.code }, { status: error.status }); throw error; } },
    },
  }).submitAgencyContent;
  return { calls, run: (body = input, origin = "https://platform.example") => handler(new globalThis.Request("https://platform.example/api/agency/content-submissions", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) })) };
}
test("public input is strict and cannot inject organization, review state or unsafe URLs", () => {
  assert.equal(agencyContentSchema.safeParse(input).success, true);
  for (const patch of [{ organizationId: "foreign" }, { status: "VERIFIED" }, { url: "javascript:alert(1)" }, { url: "http://example.com/file" }, { url: "https://user:pass@example.com/file" }]) assert.equal(agencyContentSchema.safeParse({ ...input, ...patch }).success, false);
});
test("drafts require no previous version or revision request; publication requires approval", () => {
  assert.equal(canSubmitContent("submitDraft", null), true);
  assert.equal(canSubmitContent("submitDraft", "REVISION_REQUESTED"), true);
  assert.equal(canSubmitContent("publishContent", "APPROVED"), true);
  for (const state of ["SUBMITTED", "PUBLISHED", "VERIFIED"]) { assert.equal(canSubmitContent("submitDraft", state), false); assert.equal(canSubmitContent("publishContent", state), false); }
});
test("anonymous/revoked sessions, member role and unapproved organizations cannot mutate", async () => {
  for (const options of [{ anonymous: true }, { revoked: true }, { role: "MEMBER" }, { orgStatus: "PENDING" }, { orgStatus: "SUSPENDED" }, { incomplete: true }, { noMember: true }]) {
    const f = fixture(options); assert.ok([401, 403].includes((await f.run()).status)); assert.equal(f.calls.some(([name]) => name === "application" || name === "create"), false);
  }
  const f = fixture(); assert.equal((await f.run(input, "https://evil.example")).status, 403); assert.equal(f.calls.length, 0);
});
test("only own accepted active non-demo project may receive a submission", async () => {
  assert.equal((await fixture({ foreign: true }).run()).status, 404);
  for (const application of [{ status: "SUBMITTED" }, { campaign: { status: "CANCELED", brandOrganizationId: "brand-own", requirements: {}, brandOrganization: { status: "ACTIVE" } } }, { campaign: { status: "IN_PROGRESS", brandOrganizationId: "brand-own", requirements: {}, brandOrganization: { status: "SUSPENDED" } } }, { settlement: { status: "APPROVED" } }]) assert.equal((await fixture({ application }).run()).status, 409);
});
test("first draft is persisted as SUBMITTED, versioned and audited; organization comes from session", async () => {
  const f = fixture(); assert.equal((await f.run()).status, 200);
  assert.deepEqual(f.calls.find(([name]) => name === "application")[1].where, { id: "application-own", agencyOrganizationId: "agency-own" });
  assert.equal(f.calls.find(([name]) => name === "transaction")[1].isolationLevel, "Serializable");
  const row = f.calls.find(([name]) => name === "create")[1].data;
  assert.equal(row.status, "SUBMITTED"); assert.equal(row.version, 1); assert.equal(row.draftUrl, input.url); assert.equal("publishedUrl" in row, false);
  assert.equal(f.calls.find(([name]) => name === "audit")[1].data.action, "content.submitDraft");
});
test("stale versions and duplicate review-pending drafts conflict without writes", async () => {
  const prior = { ...latest, status: "SUBMITTED" };
  const f = fixture({ application: { submissions: [prior] } });
  assert.equal((await f.run()).status, 409);
  assert.equal((await f.run({ ...input, expectedSubmissionId: latest.id, expectedUpdatedAt: stamp })).status, 409);
  assert.equal(f.calls.some(([name]) => name === "create" || name === "update" || name === "audit"), false);
});
test("revision creates immutable next version; publication updates approved version without self-verifying", async () => {
  const revision = fixture({ application: { submissions: [{ ...latest, status: "REVISION_REQUESTED" }] } });
  assert.equal((await revision.run({ ...input, expectedSubmissionId: latest.id, expectedUpdatedAt: stamp })).status, 200);
  assert.equal(revision.calls.find(([name]) => name === "create")[1].data.version, 2);
  const publish = fixture({ application: { submissions: [latest] } });
  assert.equal((await publish.run({ ...input, action: "publishContent", expectedSubmissionId: latest.id, expectedUpdatedAt: stamp })).status, 200);
  assert.deepEqual(publish.calls.find(([name]) => name === "update")[1].data, { publishedUrl: input.url, status: "PUBLISHED", verifiedAt: null });
});
