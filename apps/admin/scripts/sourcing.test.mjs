import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import {
  canReviewSourcing,
  sourcingLockReason,
} from "../lib/sourcing-validation.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(relative, overrides, cache = new Map()) {
  const filename = resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const localRequire = (name) =>
    Object.hasOwn(overrides, name)
      ? overrides[name]
      : name.startsWith(".")
        ? compile(resolve(dirname(filename), `${name}.ts`), overrides, cache)
        : require(name);
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}
const stamp = "2026-11-06T00:00:00.000Z";
function fixture(options = {}) {
  const calls = [];
  const application = {
    id: "application",
    campaignId: "campaign",
    agencyOrganizationId: "agency",
    status: "SUBMITTED",
    updatedAt: new Date(stamp),
    agencyOrganization: { name: "파트너", status: "ACTIVE" },
    campaign: { status: "RECRUITING", brandOrganization: { status: "ACTIVE" } },
    creators: [
      {
        creator: {
          id: "creator",
          displayName: "인물",
          agencyOrganizationId: "agency",
          isActive: true,
          categories: ["게임"],
          channels: [
            {
              platform: "youtube",
              url: "https://youtube.com/@creator",
              followers: 1000,
            },
          ],
        },
        deliverables: ["영상1편"],
      },
    ],
    proposal: "제안",
    proposedAmount: { toFixed: () => "100.00" },
    currency: "USD",
    _count: { submissions: 0 },
    contract: null,
    settlement: null,
    ...options.application,
  };
  const tx = {
    campaign: {
      findUnique: async () =>
        options.missingCampaign ? null : { id: "campaign" },
    },
    campaignApplication: {
      findFirst: async ({ where }) =>
        where.id === application.id &&
        where.campaignId === application.campaignId
          ? application
          : null,
      findMany: async ({ where }) =>
        where.campaignId === "campaign" ? [application] : [],
      count: async () => 1,
      updateMany: async ({ where, data }) => {
        calls.push(["update", where, data]);
        if (options.race) return { count: 0 };
        assert.equal(where.updatedAt.toISOString(), stamp);
        application.status = data.status;
        return { count: 1 };
      },
    },
    proposalItem: {
      count: async () => (options.linked ? 1 : 0),
      findMany: async () => (options.linked ? [{ creatorId: "creator" }] : []),
    },
    productionItem: {
      count: async () => (options.assigned ? 1 : 0),
      findMany: async () =>
        options.assigned ? [{ supplierOrganizationId: "agency" }] : [],
    },
    auditLog: {
      create: async ({ data }) => {
        calls.push(["audit", data]);
      },
      findMany: async () => [],
    },
  };
  class Failure extends Error {
    constructor(status, code) {
      super(code);
      this.status = status;
      this.code = code;
    }
  }
  const fail = (status, code) => {
    throw new Failure(status, code);
  };
  const api = compile("lib/sourcing-api.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: {
        TransactionIsolationLevel: {
          Serializable: "Serializable",
          RepeatableRead: "RepeatableRead",
        },
      },
      getDatabase: () => ({
        $transaction: async (callback, settings) => {
          calls.push(["transaction", settings]);
          return callback(tx);
        },
      }),
    },
    "./access": {
      fail,
      json: (value, status = 200) =>
        globalThis.Response.json(value, { status }),
      boundary: async (cb) => {
        try {
          return await cb();
        } catch (e) {
          if (e instanceof Failure)
            return globalThis.Response.json(
              { code: e.code },
              { status: e.status },
            );
          throw e;
        }
      },
      verifyOrigin: (request) => {
        if (request.headers.get("origin") !== "https://admin.example")
          fail(403, "INVALID_ORIGIN");
      },
      requireAdmin: async () => {
        if (options.anonymous) fail(401, "UNAUTHORIZED");
        if (options.forbidden) fail(403, "FORBIDDEN");
        return { userId: "admin", sessionId: "session" };
      },
      recheckAdmin: async () => {
        calls.push(["liveAccess"]);
        if (options.revoked) fail(401, "UNAUTHORIZED");
      },
      rateLimit: async () => {},
      readBody: async (request, schema) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) fail(400, "INVALID_INPUT");
        return parsed.data;
      },
    },
  }).adminSourcingApi;
  return {
    calls,
    application,
    get: () =>
      api(
        new globalThis.Request(
          "https://admin.example/api/admin/sourcing?campaignId=campaign",
        ),
      ),
    post: (changes = {}, origin = "https://admin.example") =>
      api(
        new globalThis.Request("https://admin.example/api/admin/sourcing", {
          method: "POST",
          headers: { "Content-Type": "application/json", origin },
          body: JSON.stringify({
            campaignId: "campaign",
            applicationId: "application",
            expectedUpdatedAt: stamp,
            status: "SHORTLISTED",
            reason: "브리프·일정 검토 완료",
            ...changes,
          }),
        }),
      ),
  };
}
test("candidate review requires live platform authorization and same origin before writes", async () => {
  for (const options of [
    { anonymous: true },
    { forbidden: true },
    { revoked: true },
  ]) {
    const f = fixture(options);
    assert.ok([401, 403].includes((await f.post()).status));
    assert.equal(
      f.calls.some((c) => c[0] === "update"),
      false,
    );
  }
  const f = fixture();
  assert.equal((await f.post({}, "https://attacker.example")).status, 403);
  assert.equal(f.calls.length, 0);
});
test("shortlisting scopes campaign and timestamp and records the operator reason", async () => {
  const f = fixture();
  assert.equal((await f.post()).status, 200);
  assert.equal(f.application.status, "SHORTLISTED");
  const audit = f.calls.find((c) => c[0] === "audit")[1];
  assert.equal(audit.payload.before, "SUBMITTED");
  assert.equal(audit.payload.after, "SHORTLISTED");
  assert.equal(audit.actorId, "admin");
  assert.equal(
    f.calls.find((c) => c[0] === "transaction")[1].isolationLevel,
    "Serializable",
  );
  assert.equal(
    (await fixture().post({ campaignId: "foreign-campaign" })).status,
    404,
  );
  assert.equal(
    (await fixture().post({ expectedUpdatedAt: "2026-11-05T00:00:00.000Z" }))
      .status,
    409,
  );
  assert.equal((await fixture({ race: true }).post()).status, 409);
});
test("withdrawn, closed, published and already performed applications cannot be reassigned", async () => {
  for (const options of [
    { application: { status: "WITHDRAWN" } },
    {
      application: {
        campaign: {
          status: "COMPLETED",
          brandOrganization: { status: "ACTIVE" },
        },
      },
    },
    { linked: true },
    { assigned: true },
    { application: { _count: { submissions: 1 } } },
    { application: { contract: { id: "contract" } } },
    { application: { settlement: { id: "settlement" } } },
  ]) {
    const f = fixture(options);
    assert.equal((await f.post()).status, 409);
    assert.equal(
      f.calls.some((c) => c[0] === "update"),
      false,
    );
  }
});
test("review prevents direct unreviewed acceptance and requires active partner candidates", async () => {
  assert.equal((await fixture().post({ status: "ACCEPTED" })).status, 409);
  assert.equal(
    (
      await fixture({
        application: {
          agencyOrganization: { name: "파트너", status: "SUSPENDED" },
        },
      }).post()
    ).status,
    409,
  );
  assert.equal(
    (await fixture({ application: { creators: [] } }).post()).status,
    409,
  );
  assert.equal((await fixture().post({ reason: "" })).status, 400);
  assert.equal(
    (
      await fixture({ application: { status: "SHORTLISTED" } }).post({
        status: "ACCEPTED",
      })
    ).status,
    200,
  );
  assert.equal((await fixture().post({ status: "REJECTED" })).status, 200);
});
test("candidate list omits foreign creator links and marks published work locked", async () => {
  const f = fixture({ linked: true });
  f.application.creators.push({
    creator: {
      ...f.application.creators[0].creator,
      id: "foreign",
      agencyOrganizationId: "other",
    },
    deliverables: [],
  });
  const response = await f.get();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(
    data.applications[0].creators.map((c) => c.id),
    ["creator"],
  );
  assert.match(data.applications[0].lockReason, /공개 제안/);
  assert.equal(data.applications[0].creators[0].channels[0].followers, 1000);
});
test("state policy preserves withdrawal and performed work while allowing reconsideration", () => {
  assert.equal(canReviewSourcing("REJECTED", "SHORTLISTED"), true);
  assert.equal(canReviewSourcing("WITHDRAWN", "SHORTLISTED"), false);
  assert.equal(canReviewSourcing("SUBMITTED", "ACCEPTED"), false);
  assert.equal(
    sourcingLockReason({
      campaignStatus: "RECRUITING",
      brandActive: true,
      applicationStatus: "SUBMITTED",
      hasWork: false,
    }),
    null,
  );
});
