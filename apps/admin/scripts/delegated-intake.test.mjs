import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { URL } from "node:url";
import test from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { record, submittedProfile } from "../lib/verification.ts";
const require = createRequire(new URL("../package.json", import.meta.url));
const now = Date.now(),
  day = 86400000;
const body = {
  organizationId: "buyer",
  requesterId: "requester",
  assignToMe: true,
  channel: "email",
  reason: "이메일로 받은 의뢰",
  finalAdvertiserName: "광고주",
  brief: {
    clientRequestId: "71c491ce-f77d-4600-831d-adb97d25aacb",
    title: "대리 접수 테스트",
    genre: "RPG",
    goal: "게임 출시 소개",
    contentFormat: "라이브",
    creatorCount: 2,
    desiredDate: new Date(now + 20 * day).toISOString().slice(0, 10),
    budgetAmount: "5000.50",
    currency: "USD",
    platforms: ["youtube"],
    regions: ["KR"],
    route: "managed",
  },
};
class Failure extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}
class DbError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function setup(options = {}) {
  const campaigns = new Map(),
    requests = [],
    events = [];
  let attempts = 0;
  const admin = { userId: "operator", name: "운영자" };
  const tx = {
    organizationMember: {
      findFirst: async ({ where }) => {
        if (
          options.badRequester ||
          where.userId !== "requester" ||
          where.organizationId !== "buyer"
        )
          return null;
        assert.deepEqual(where.role.in, ["OWNER", "ADMIN"]);
        assert.deepEqual(where.organization, {
          type: "BRAND",
          status: "ACTIVE",
        });
        return {
          user: { name: "브랜드 요청자", email: "owner@example.test" },
          organization: {
            name: "구매자 조직",
            metadata: options.metadata ?? {
              profileCompletedAt: "2026-01-01T00:00:00Z",
            },
          },
        };
      },
    },
    campaign: {
      findUnique: async ({ where }) => campaigns.get(where.id) ?? null,
      count: async () => (options.full ? 100 : campaigns.size),
      create: async ({ data }) => {
        campaigns.set(data.id, { ...data });
        return data;
      },
      update: async ({ where, data }) =>
        Object.assign(campaigns.get(where.id), data),
    },
    workspaceToolRequest: {
      create: async ({ data }) => {
        requests.push(data);
        return { id: "request-1" };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        if (options.failAudit && data.action.startsWith("admin."))
          throw Error("audit write failed");
        events.push(data);
        return data;
      },
    },
  };
  const overrides = {
    "server-only": {},
    "./verification": { record, submittedProfile },
    "@futures-medialab/database": {
      Prisma: {
        PrismaClientKnownRequestError: DbError,
        TransactionIsolationLevel: { Serializable: "Serializable" },
      },
      getDatabase: () => ({
        $transaction: async (work, opts) => {
          assert.equal(opts.isolationLevel, "Serializable");
          attempts++;
          if (options.conflict && attempts === 1)
            throw Object.assign(new Error("pg adapter conflict"), {
              code: "P2034",
            });
          const before = [new Map(campaigns), requests.length, events.length];
          try {
            return await work(tx);
          } catch (e) {
            campaigns.clear();
            for (const [k, v] of before[0]) campaigns.set(k, v);
            requests.length = before[1];
            events.length = before[2];
            throw e;
          }
        },
      }),
    },
    "./access": {
      requireAdmin: async () => {
        if (options.nonAdmin) throw new Failure(403, "FORBIDDEN");
        return admin;
      },
      recheckAdmin: async () => {
        if (options.revoked) throw new Failure(401, "UNAUTHORIZED");
      },
      rateLimit: async () => {},
      verifyOrigin: (req) => {
        if (req.headers.get("origin") !== "https://admin.example")
          throw new Failure(403, "INVALID_ORIGIN");
      },
      readBody: async (req, schema) => {
        const parsed = schema.safeParse(await req.json());
        if (!parsed.success) throw new Failure(400, "INVALID_INPUT");
        return parsed.data;
      },
      fail: (status, code) => {
        throw new Failure(status, code);
      },
      json: (value) => globalThis.Response.json(value),
      boundary: async (work) => {
        try {
          return await work();
        } catch (e) {
          return globalThis.Response.json(
            { code: e.message },
            { status: e.status ?? 503 },
          );
        }
      },
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(
      new URL("../lib/delegated-intake.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInThisContext(`(function(exports,require,module){${source}\n})`)(
    module.exports,
    (key) => (Object.hasOwn(overrides, key) ? overrides[key] : require(key)),
    module,
  );
  return {
    campaigns,
    requests,
    events,
    submit: (input = body, origin = "https://admin.example") =>
      module.exports.submitDelegatedIntake(
        new globalThis.Request(
          "https://admin.example/api/admin/delegated-intake",
          {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify(input),
          },
        ),
      ),
  };
}
test("delegation records admin actor, real buyer requester, and same managed 48-hour intake", async () => {
  const f = setup(),
    response = await f.submit();
  assert.equal(response.status, 200);
  const result = await response.json(),
    campaign = f.campaigns.get(result.id),
    request = f.requests[0];
  assert.equal(campaign.status, "REVIEW");
  assert.equal(campaign.createdById, "operator");
  assert.equal(campaign.brandOrganizationId, "buyer");
  assert.equal(campaign.requirements.brandIntake.requestId, result.requestId);
  assert.equal(request.userId, "requester");
  assert.equal(request.assignedToId, "operator");
  assert.equal(
    request.dueAt.getTime() - Date.parse(request.inputJson.submittedAt),
    48 * 3600000,
  );
  assert.equal(f.events[0].actorId, "operator");
  assert.equal(f.events[1].payload.requesterId, "requester");
  assert.equal(f.events[1].payload.reason, body.reason);
  assert.ok(!JSON.stringify(request.inputJson).includes(body.reason));
});
test("identical retries return the linked campaign once and reject changed identity/payload", async () => {
  const f = setup();
  const first = await (await f.submit()).json();
  assert.deepEqual(await (await f.submit()).json(), first);
  assert.equal((await f.submit({ ...body, reason: "다른 사유" })).status, 409);
  assert.equal(f.campaigns.size, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.events.length, 2);
});
test("open recruitment enforces actual future deadline and has no proposal SLA", async () => {
  const f = setup();
  assert.equal(
    (await f.submit({ ...body, brief: { ...body.brief, route: "open" } }))
      .status,
    400,
  );
  assert.equal(
    (
      await f.submit({
        ...body,
        brief: {
          ...body.brief,
          route: "open",
          applicationDeadline: new Date(now + 30 * day).toISOString(),
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.submit({
        ...body,
        assignToMe: false,
        brief: {
          ...body.brief,
          route: "open",
          applicationDeadline: new Date(now + 7 * day).toISOString(),
        },
      })
    ).status,
    200,
  );
  assert.equal(f.requests[0].dueAt, null);
  assert.equal(f.requests[0].assignedToId, undefined);
});
test("rechecks platform rights, organization/member, and active buyer access before creation", async () => {
  for (const [config, status] of [
    [{ nonAdmin: true }, 403],
    [{ revoked: true }, 401],
    [{ badRequester: true }, 409],
    [{ metadata: {} }, 409],
  ]) {
    const f = setup(config);
    assert.equal((await f.submit()).status, status);
    assert.equal(f.campaigns.size, 0);
  }
  const f = setup();
  assert.equal((await f.submit(body, "https://other.example")).status, 403);
  assert.equal(
    (await f.submit({ ...body, requesterId: "foreign-owner" })).status,
    409,
  );
  assert.equal(
    (await f.submit({ ...body, registeredById: "spoofed" })).status,
    400,
  );
  assert.equal(f.events.length, 0);
});
test("buyer agency requires the actual advertiser and honors the organization registration limit", async () => {
  const f = setup({
    metadata: { testWorkspaceAccess: true, organizationType: "client_agency" },
  });
  assert.equal(
    (await f.submit({ ...body, finalAdvertiserName: "" })).status,
    400,
  );
  assert.equal((await f.submit()).status, 200);
  const full = setup({ full: true });
  assert.equal((await full.submit()).status, 409);
  assert.equal(full.campaigns.size, 0);
});
test("transaction rollback leaves no partial campaign and serializable conflict is retryable", async () => {
  const f = setup({ failAudit: true });
  assert.equal((await f.submit()).status, 503);
  assert.equal(f.campaigns.size + f.requests.length + f.events.length, 0);
  const retry = setup({ conflict: true });
  assert.equal((await retry.submit()).status, 200);
  assert.equal(retry.requests.length, 1);
});
