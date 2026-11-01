import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Real platform authentication/approval/rate-limit/response boundaries, isolated
// from persistent storage. Shared ledger privacy and snapshots have DB smoke tests.
const base = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(relative, overrides, cache = new Map()) {
  const filename = resolve(base, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
  const localRequire = specifier => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith(".")) return compile(resolve(dirname(filename), `${specifier}.ts`), overrides, cache);
    if (specifier === "@futures-medialab/database/production-validation") return compile("../../packages/database/src/production-validation.ts", overrides, cache);
    return require(specifier);
  };
  runInThisContext(`(function(exports,require,module){${source}\n})`, { filename })(module.exports, localRequire, module);
  return module.exports;
}
class ServiceError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
class ProductionError extends ServiceError {}
class SettlementError extends ServiceError {}
const request = (kind, suffix = "", method = "GET") => new globalThis.Request(`https://futures.example.com/api/${kind}/settlement${suffix}`, { method });
function fixture(kind, options = {}) {
  const calls = { auth: 0, transactions: [], reads: [], rateLimits: 0 };
  const member = { role: options.role ?? "OWNER", organizationId: `${kind}-own`, organization: { name: "Own organization", status: options.status ?? "ACTIVE", metadata: options.unapproved ? {} : { testWorkspaceAccess: true } } };
  const database = {
    organizationMember: { findFirst: async ({ where }) => {
      assert.equal(where.userId, "current-user");
      assert.equal(where.organization.type, kind.toUpperCase());
      return options.noMember ? null : member;
    } },
    $queryRaw: async () => { calls.rateLimits++; return [{ count: options.rateLimited ? 121 : 1 }]; },
  };
  const read = async (tx, actor, campaignId) => {
    assert.equal(tx, database);
    assert.equal(actor.organizationId, `${kind}-own`);
    assert.equal(actor.userId, "current-user");
    calls.reads.push(campaignId ?? null);
    if (campaignId === "other-campaign") throw new SettlementError(404, "NOT_FOUND");
    return [{ id: "published-statement", campaignId: campaignId ?? "own-campaign", amount: "100.01", status: "ISSUED" }];
  };
  const overrides = {
    "server-only": {},
    "@futures-medialab/database": { getDatabase: () => database, Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "./auth": { getAuth: () => ({ api: { getSession: async () => { calls.auth++; return options.anonymous ? null : { user: { id: "current-user" }, session: { id: "current-session" } }; } } }) },
    "@futures-medialab/database/production": { ProductionError },
    "@futures-medialab/database/settlement": {
      SettlementError,
      listBrandInvoices: kind === "brand" ? read : () => assert.fail("Agency must never invoke the brand invoice reader"),
      listAgencyPayouts: kind === "agency" ? read : () => assert.fail("Brand must never invoke the supplier payout reader"),
      settlementTransaction: async (actor, run) => {
        calls.transactions.push(actor);
        if (options.revokedSession) throw new ProductionError(401, "UNAUTHORIZED");
        return run(database);
      },
    },
  };
  overrides["@futures-medialab/database/settlement-validation"] = compile("../../packages/database/src/settlement-validation.ts", overrides);
  return { handler: compile(`lib/${kind}-settlement-api.ts`, overrides)[`${kind}SettlementApi`], calls };
}
for (const kind of ["brand", "agency"]) {
  test(`${kind}: current approved tenant and MEMBER may only read their own statement kind`, async () => {
    const { handler, calls } = fixture(kind, { role: "MEMBER" });
    const response = await handler(request(kind, "?campaignId=own-campaign&organizationId=attacker&userId=attacker"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const body = await response.json();
    assert.deepEqual(Object.keys(body), [kind === "brand" ? "invoices" : "payouts"]);
    assert.deepEqual(calls.transactions, [{ userId: "current-user", sessionId: "current-session", kind, organizationId: `${kind}-own` }]);
    assert.deepEqual(calls.reads, ["own-campaign"]);
    assert.equal(calls.rateLimits, 1);
  });
  test(`${kind}: anonymous, inactive, incomplete and missing membership cannot reach financial reads`, async () => {
    for (const [options, status] of [[{ anonymous: true }, 401], [{ noMember: true }, 403], [{ status: "SUSPENDED" }, 403], [{ status: "PENDING" }, 403], [{ unapproved: true }, 403]]) {
      const { handler, calls } = fixture(kind, options);
      const response = await handler(request(kind));
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(calls.transactions.length, 0);
      assert.equal(calls.reads.length, 0);
    }
  });
  test(`${kind}: read-only method, validated campaign, stale session, tenant denial and rate limit stay enforced`, async () => {
    const mutation = fixture(kind);
    assert.equal((await mutation.handler(request(kind, "", "POST"))).status, 405);
    assert.equal(mutation.calls.auth, 0);
    assert.equal(mutation.calls.transactions.length, 0);
    const invalid = fixture(kind);
    assert.equal((await invalid.handler(request(kind, "?campaignId=%3Cscript%3E"))).status, 400);
    assert.equal(invalid.calls.transactions.length, 0);
    const stale = fixture(kind, { revokedSession: true });
    assert.equal((await stale.handler(request(kind))).status, 401);
    assert.equal(stale.calls.reads.length, 0);
    assert.equal((await fixture(kind).handler(request(kind, "?campaignId=other-campaign"))).status, 404);
    const limited = fixture(kind, { rateLimited: true });
    const response = await limited.handler(request(kind));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal(limited.calls.transactions.length, 0);
  });
}
