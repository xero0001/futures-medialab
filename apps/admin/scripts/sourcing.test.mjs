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
const { Request, Response } = globalThis;
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
    applicationRow: {
      update: async ({ where, data }) => {
        const row = application.rows.find((row) => row.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
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
      findMany: async () => options.audits ?? [],
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

test("each creator row can be reviewed independently and published rows cannot be reassigned", async () => {
  const f = fixture({
    application: {
      rows: [
        {
          id: "row-one",
          creatorId: "creator",
          status: "SUBMITTED",
          proposalItems: [],
        },
        {
          id: "row-two",
          creatorId: "creator",
          status: "SUBMITTED",
          proposalItems: [],
        },
      ],
    },
  });
  assert.equal((await f.post({ rowId: "row-one" })).status, 200);
  assert.equal(f.application.rows[0].status, "SHORTLISTED");
  assert.equal(f.application.rows[1].status, "SUBMITTED");
  assert.equal(f.application.status, "SHORTLISTED");
  assert.equal((await f.post({ rowId: "foreign" })).status, 404);
  assert.equal((await f.post()).status, 400);
  f.application.rows[0].proposalItems.push({
    proposal: { publishedAt: new Date() },
  });
  assert.equal(
    (await f.post({ rowId: "row-one", status: "REJECTED" })).status,
    409,
  );
  assert.equal(
    (await f.post({ rowId: "row-two", status: "REJECTED" })).status,
    200,
  );
});

test("supplier offer cap is explicitly saved without copying brand budget or overwriting the brief", async () => {
  const campaign = {
    id: "campaign",
    type: "OPEN_BIDDING",
    status: "RECRUITING",
    currency: "KRW",
    updatedAt: new Date(stamp),
    budgetAmount: "99999999",
    requirements: {
      brandBrief: { budgetAmount: "99999999" },
      supplierOffer: { unitCap: "10000" },
    },
  };
  const audits = [];
  class Failure extends Error {
    constructor(status) {
      super();
      this.status = status;
    }
  }
  const api = compile("lib/supplier-offer-api.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
      getDatabase: () => ({
        $transaction: async (cb) =>
          cb({
            campaign: {
              findUnique: async ({ where }) =>
                where.id === campaign.id ? campaign : null,
              update: async ({ data }) => Object.assign(campaign, data),
            },
            auditLog: { create: async ({ data }) => audits.push(data) },
          }),
      }),
    },
    "./access": {
      fail: (status) => {
        throw new Failure(status);
      },
      json: (data) => Response.json(data),
      boundary: async (cb) => {
        try {
          return await cb();
        } catch (e) {
          if (e instanceof Failure)
            return Response.json({}, { status: e.status });
          throw e;
        }
      },
      requireAdmin: async (headers) => {
        if (headers.get("x-test-admin") !== "yes") throw new Failure(403);
        return { userId: "admin" };
      },
      recheckAdmin: async () => {},
      verifyOrigin: (req) => {
        if (req.headers.get("origin") !== "https://admin.example")
          throw new Failure(403);
      },
      rateLimit: async () => {},
      readBody: async (req, schema) => {
        const p = schema.safeParse(await req.json());
        if (!p.success) throw new Failure(400);
        return p.data;
      },
    },
  }).supplierOfferApi;
  const post = (change = {}, headers = {}) =>
    api(
      new Request("https://admin.example/api", {
        method: "POST",
        headers: {
          origin: "https://admin.example",
          "content-type": "application/json",
          "x-test-admin": "yes",
          ...headers,
        },
        body: JSON.stringify({
          campaignId: "campaign",
          expectedUpdatedAt: stamp,
          unitCap: "20000",
          ...change,
        }),
      }),
    );
  assert.equal((await post({}, { "x-test-admin": "no" })).status, 403);
  assert.equal(
    (await post({ expectedUpdatedAt: "2000-01-01T00:00:00Z" })).status,
    409,
  );
  assert.equal((await post({ unitCap: "200.10" })).status, 400);
  assert.equal((await post()).status, 200);
  assert.equal(campaign.requirements.supplierOffer.unitCap, "20000");
  assert.equal(campaign.requirements.brandBrief.budgetAmount, "99999999");
  assert.equal(audits.length, 1);
  assert.equal((await post({ unitCap: null })).status, 200);
  assert.equal(campaign.requirements.supplierOffer.unitCap, null);
});

test("multi-channel application rows show only their own latest review reason", async () => {
  const row = (id, platform) => ({
    id,
    platform,
    creatorId: "creator",
    status: "SHORTLISTED",
    proposalItems: [],
    format: "쇼츠",
    quantity: 1,
    availableOn: new Date(stamp),
    unitAmount: {
      toFixed: () => "100.00",
      mul: () => ({ toFixed: () => "100.00" }),
    },
  });
  const f = fixture({
    application: {
      rows: [
        row("tiktok-row", "tiktok"),
        row("youtube-row", "youtube"),
        row("unreviewed-row", "instagram"),
      ],
    },
    audits: [
      {
        entityId: "application",
        payload: { rowId: "youtube-row", reason: "YouTube 일정 확인" },
      },
      {
        entityId: "application",
        payload: { rowId: "tiktok-row", reason: "TikTok 조건 확인" },
      },
      {
        entityId: "application",
        payload: { rowId: "tiktok-row", reason: "이전 사유" },
      },
    ],
  });
  const response = await f.get();
  assert.equal(response.status, 200);
  const { applications } = await response.json();
  assert.deepEqual(
    applications.map(({ rowId, reviewReason }) => [rowId, reviewReason]),
    [
      ["tiktok-row", "TikTok 조건 확인"],
      ["youtube-row", "YouTube 일정 확인"],
      ["unreviewed-row", ""],
    ],
  );
});

test("admin request collection exposes POST and forwards invitation creation", async () => {
  const calls = [];
  const route = compile("app/api/admin/requests/route.ts", {
    "../../../../lib/requests-api": {
      requestsApi: async (request) => {
        calls.push(request);
        return Response.json({ id: "invitation" }, { status: 201 });
      },
    },
  });
  const request = new Request("https://admin.example/api/admin/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tool: "invitation",
      recipientOrganizationId: "agency",
    }),
  });
  const response = await route.POST(request);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "invitation" });
  assert.equal(calls[0], request);
});
