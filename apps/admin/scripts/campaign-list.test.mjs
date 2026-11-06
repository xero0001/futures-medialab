import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { URL } from "node:url";
const require = createRequire(new URL("../package.json", import.meta.url));
function fixture(options = {}) {
  const calls = [];
  const row = {
    id: "c1",
    type: "MANAGED",
    title: "Test",
    summary: "Brief",
    status: "RECRUITING",
    platforms: ["youtube"],
    currency: "USD",
    budgetAmount: { toFixed: () => "100.00" },
    applicationDeadline: null,
    createdAt: new Date("2026-11-06"),
    requirements: { brandIntake: { requestId: "r1" } },
    brandOrganizationId: "b1",
    brandOrganization: { name: "Brand", status: "ACTIVE" },
    _count: { applications: 1 },
  };
  const tx = {
    campaign: {
      count: async (query) => {
        calls.push(["count", query]);
        return options.total ?? 60;
      },
      findMany: async (query) => {
        calls.push(["rows", query]);
        return [row];
      },
    },
    workspaceToolRequest: {
      findMany: async () => [
        {
          id: "r1",
          campaignId: "c1",
          organizationId: options.foreign ? "other" : "b1",
          dueAt: null,
          assignedTo: { name: "Manager" },
        },
      ],
    },
  };
  class Failure extends Error {
    constructor(status) {
      super();
      this.status = status;
    }
  }
  const overrides = {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: {
        TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" },
      },
      getDatabase: () => ({ $transaction: (callback) => callback(tx) }),
    },
    "./verification": {
      record: (v) => (v && typeof v === "object" ? v : {}),
      text: (v) => (typeof v === "string" ? v : ""),
      reviewReason: () => "",
    },
    "./access": {
      requireAdmin: async () => {
        if (options.denied) throw new Failure(403);
        return { userId: "admin" };
      },
      rateLimit: async () => {},
      recheckAdmin: async () => {
        if (options.revoked) throw new Failure(401);
      },
      fail: (status) => {
        throw new Failure(status);
      },
      json: (body) =>
        globalThis.Response.json(body, {
          headers: { "Cache-Control": "private, no-store" },
        }),
      boundary: async (fn) => {
        try {
          return await fn();
        } catch (e) {
          if (e instanceof Failure)
            return globalThis.Response.json({}, { status: e.status });
          throw e;
        }
      },
    },
  };
  const source = ts.transpileModule(
    readFileSync(
      new URL("../lib/campaign-list-api.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  runInThisContext(`(function(exports,require,module){${source}\n})`)(
    module.exports,
    (id) => (Object.hasOwn(overrides, id) ? overrides[id] : require(id)),
    module,
  );
  return {
    calls,
    run: (query) =>
      module.exports.listCampaigns(
        new globalThis.Request(
          "https://admin.example/api/admin/campaigns" +
            (query ? "?" + query : ""),
        ),
      ),
  };
}
test("denied or revoked admin never reaches campaign reads", async () => {
  for (const options of [{ denied: true }, { revoked: true }]) {
    const f = fixture(options);
    assert.ok([401, 403].includes((await f.run()).status));
    assert.equal(f.calls.length, 0);
  }
});
test("invalid pagination and unsupported scopes are rejected before reads", async () => {
  for (const q of [
    "page=0",
    "page=Infinity",
    "type=PLATFORM",
    "status=PAID",
    "q=" + "x".repeat(161),
  ]) {
    const f = fixture();
    assert.equal((await f.run(q)).status, 400);
    assert.equal(f.calls.length, 0);
  }
});
test("search covers full dataset and clamps page to last available page", async () => {
  const f = fixture();
  const r = await f.run("q=needle&type=MANAGED&status=RECRUITING&page=999");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.total, 60);
  assert.equal(b.page, 3);
  const query = f.calls.find(([k]) => k === "rows")[1];
  assert.equal(query.skip, 50);
  assert.equal(query.take, 25);
  assert.equal(query.where.type, "MANAGED");
  assert.equal(query.where.OR[1].brandOrganization.name.contains, "needle");
  assert.match(r.headers.get("cache-control"), /no-store/);
});
test("forged linked intake from another organization is not returned", async () => {
  const f = fixture({ foreign: true });
  const b = await (await f.run()).json();
  assert.equal(b.campaigns[0].assigneeName, null);
  assert.equal(b.campaigns[0].requestId, null);
});
