import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import {
  gameProfileSchema,
  gameMutationSchema,
  gameQuerySchema,
  validGameThumbnail,
  blankGame,
} from "../lib/game-catalog-model.ts";
import {
  normalizeGameTitle,
  localizedGame,
} from "../../../packages/database/src/game-catalog.ts";
const require = createRequire(import.meta.url);
const profile = {
  ...blankGame(),
  title: "이환",
  thumbnailUrl: "/demo/nte/game-icon.png",
  aliases: ["NTE", "이 환"],
  localizations: [
    {
      locale: "KO",
      title: "이환",
      officialUrl: "https://nte.perfectworld.com/kr/",
    },
    {
      locale: "EN",
      title: "NTE (Neverness to Everness)",
      officialUrl: "https://nte.perfectworld.com/en/",
    },
    { locale: "ZH", title: "异环", officialUrl: "https://yh.wanmei.com/" },
  ],
};
const requestId = "71c491ce-f77d-4600-831d-adb97d25aacb";
const create = { action: "create", requestId, profile };
class Failure extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function setup(options = {}) {
  const records = new Map(),
    audits = [];
  let clock = 0;
  const hydrate = (row) =>
    row
      ? {
          ...row,
          organization: row.organizationId ? { name: "원래 브랜드" } : null,
          _count: { campaigns: 2 },
        }
      : null;
  const matches = (row, where) =>
    (!where.verified || row.verified === where.verified) &&
    (where.verified !== false || !row.verified) &&
    (!where.id?.not || where.id.not !== row.id) &&
    (!where.aliases ||
      row.aliases.some((a) => where.aliases.hasSome.includes(a))) &&
    (!where.searchText || row.searchText.includes(where.searchText.contains));
  const tx = {
    gameCatalog: {
      findUnique: async ({ where }) => hydrate(records.get(where.id)),
      findUniqueOrThrow: async ({ where }) => {
        assert.ok(records.has(where.id));
        return hydrate(records.get(where.id));
      },
      findFirst: async ({ where }) =>
        hydrate([...records.values()].find((row) => matches(row, where))),
      findMany: async ({ where, skip, take }) =>
        [...records.values()]
          .filter((row) => matches(row, where))
          .slice(skip, skip + take)
          .map(hydrate),
      count: async ({ where }) =>
        [...records.values()].filter((row) => matches(row, where)).length,
      create: async ({ data }) => {
        const row = {
          ...data,
          updatedAt: new Date(1900000000000 + ++clock),
          localizations: [],
          organizationId: null,
        };
        records.set(data.id, row);
        return hydrate(row);
      },
      updateMany: async ({ where, data }) => {
        const row = records.get(where.id);
        if (!row || +row.updatedAt !== +where.updatedAt) return { count: 0 };
        Object.assign(row, data, {
          updatedAt: new Date(1900000000000 + ++clock),
        });
        return { count: 1 };
      },
    },
    gameLocalization: {
      deleteMany: async ({ where }) => {
        records.get(where.gameId).localizations = [];
      },
      createMany: async ({ data }) => {
        for (const row of data) records.get(row.gameId).localizations.push(row);
      },
    },
    auditLog: {
      findFirst: async ({ where }) =>
        audits.find((row) =>
          Object.entries(where).every(([k, v]) => row[k] === v),
        ),
      create: async ({ data }) => {
        if (options.failAudit) throw Error("audit unavailable");
        audits.push(data);
      },
    },
  };
  const overrides = {
    "server-only": {},
    "./game-catalog-model": { gameMutationSchema, gameQuerySchema },
    "@futures-medialab/database/game-catalog": { normalizeGameTitle },
    "@futures-medialab/database": {
      Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
      getDatabase: () => ({
        $transaction: async (work) => {
          const before = globalThis.structuredClone([...records]),
            count = audits.length;
          try {
            return await work(tx);
          } catch (e) {
            records.clear();
            for (const [k, v] of before) records.set(k, v);
            audits.length = count;
            throw e;
          }
        },
      }),
    },
    "./access": {
      requireAdmin: async () => {
        if (options.nonAdmin) throw new Failure(403, "FORBIDDEN");
        return { userId: "admin" };
      },
      recheckAdmin: async () => {
        if (options.revoked) throw new Failure(401, "UNAUTHORIZED");
      },
      rateLimit: async () => {},
      verifyOrigin: (request) => {
        if (request.headers.get("origin") !== "https://admin.example.com")
          throw new Failure(403, "INVALID_ORIGIN");
      },
      readBody: async (request, schema) => {
        const result = schema.safeParse(await request.json());
        if (!result.success) throw new Failure(400, "INVALID_INPUT");
        return result.data;
      },
      fail: (status, code, message) => {
        throw new Failure(status, message || code);
      },
      json: (value) => globalThis.Response.json(value),
      boundary: async (work) => {
        try {
          return await work();
        } catch (e) {
          return globalThis.Response.json(
            { message: e.message },
            { status: e.status ?? 503 },
          );
        }
      },
    },
  };
  overrides["./game-catalog-model"].gameLanguages = [
    ["KO", "한국어"],
    ["EN", "영어"],
    ["ZH", "중국어"],
  ];
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(
      new globalThis.URL("../lib/game-catalog-api.ts", import.meta.url),
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
    records,
    audits,
    get: (query = "") =>
      module.exports.adminGameCatalog(
        new globalThis.Request(
          "https://admin.example.com/api/admin/games" + query,
        ),
      ),
    post: (body = create, origin = "https://admin.example.com") =>
      module.exports.adminGameCatalog(
        new globalThis.Request("https://admin.example.com/api/admin/games", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
  };
}

test("official names, aliases and images persist and create retries do not duplicate", async () => {
  const f = setup(),
    response = await f.post();
  assert.equal(response.status, 200);
  const { game } = await response.json();
  const stored = f.records.get(game.id);
  assert.equal(stored.localizations.length, 3);
  assert.ok(stored.aliases.includes("nte"));
  assert.equal(localizedGame(stored, "zh").title, "异环");
  assert.equal(game.thumbnailUrl, profile.thumbnailUrl);
  assert.equal(f.audits[0].action, "admin.game.create");
  assert.equal((await f.post()).status, 200);
  assert.equal(f.records.size, 1);
  assert.equal(f.audits.length, 1);
  assert.equal(
    (await f.post({ ...create, profile: { ...profile, title: "다른 게임" } }))
      .status,
    409,
  );
  assert.deepEqual(game.aliases, ["nte", "이 환"]);
});
test("edits update multilingual search and image without breaking existing campaign IDs", async () => {
  const f = setup();
  const { game } = await (await f.post()).json();
  const updated = {
    ...profile,
    thumbnailUrl: "https://cdn.example.com/new.png",
    aliases: ["NEW NTE"],
    localizations: profile.localizations.map((l) =>
      l.locale === "EN" ? { ...l, title: "Neverness to Everness" } : l,
    ),
  };
  const result = await f.post({
    action: "update",
    id: game.id,
    expectedUpdatedAt: game.updatedAt,
    reason: "공식 영문명 수정",
    profile: updated,
  });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).game.id, game.id);
  assert.equal(f.records.get(game.id).thumbnailUrl, updated.thumbnailUrl);
  const search = await (await f.get("?q=NEW%20NTE")).json();
  assert.equal(search.total, 1);
  assert.equal(f.audits[1].payload.before.thumbnailUrl, profile.thumbnailUrl);
  assert.equal(f.audits[1].payload.after.thumbnailUrl, updated.thumbnailUrl);
  assert.equal(
    (
      await f.post({
        action: "update",
        id: game.id,
        expectedUpdatedAt: game.updatedAt,
        reason: "오래된 수정",
        profile,
      })
    ).status,
    409,
  );
});
test("unverified games retain their brand ownership and can be approved", async () => {
  const f = setup();
  const { game } = await (
    await f.post({ ...create, profile: { ...profile, verified: false } })
  ).json();
  f.records.get(game.id).organizationId = "brand_1";
  assert.equal((await (await f.get("?status=pending")).json()).total, 1);
  assert.equal(
    (
      await f.post({
        action: "update",
        id: game.id,
        expectedUpdatedAt: game.updatedAt,
        reason: "공식 명칭 확인",
        profile,
      })
    ).status,
    200,
  );
  assert.equal(f.records.get(game.id).organizationId, "brand_1");
  assert.equal((await (await f.get("?status=pending")).json()).total, 0);
});
test("duplicate official aliases, stale edits and missing games cannot mutate records", async () => {
  const f = setup();
  await f.post();
  assert.equal(
    (
      await f.post({
        ...create,
        requestId: "81c491ce-f77d-4600-831d-adb97d25aacb",
      })
    ).status,
    409,
  );
  assert.equal(f.records.size, 1);
  assert.equal((await f.get("?id=missing")).status, 404);
  assert.equal((await f.get("?page=0")).status, 400);
});
test("non-admin, revoked sessions and foreign origins cannot access or mutate catalog", async () => {
  for (const options of [{ nonAdmin: true }, { revoked: true }]) {
    const f = setup(options);
    assert.ok([401, 403].includes((await f.get()).status));
    assert.ok([401, 403].includes((await f.post()).status));
    assert.equal(f.records.size, 0);
  }
  const f = setup();
  assert.equal((await f.post(create, "https://evil.example.com")).status, 403);
  assert.equal(f.records.size, 0);
});
test("audit failure rolls back the game and localizations", async () => {
  const f = setup({ failAudit: true });
  assert.equal((await f.post()).status, 503);
  assert.equal(f.records.size, 0);
});
test("validation rejects unsafe URLs and incomplete translations, while optional locales remain blank", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "http://example.com/a.png",
    "//evil.example/a.png",
    "https://127.0.0.1/a.png",
    "https://user:pass@example.com/a.png",
    "/demo/../private.png",
    "https://app.local/a.png",
  ])
    assert.equal(validGameThumbnail(url), false, url);
  assert.equal(
    gameProfileSchema.safeParse({
      ...profile,
      localizations: profile.localizations.map((l) => ({
        ...l,
        title: "",
        officialUrl: "",
      })),
    }).success,
    false,
  );
  assert.equal(
    gameProfileSchema.safeParse({
      ...profile,
      localizations: [
        profile.localizations[0],
        profile.localizations[0],
        profile.localizations[2],
      ],
    }).success,
    false,
  );
  assert.equal(
    gameProfileSchema.safeParse({
      ...profile,
      localizations: profile.localizations.map((l) =>
        l.locale === "ZH" ? { ...l, title: "", officialUrl: "" } : l,
      ),
    }).success,
    true,
  );
});
