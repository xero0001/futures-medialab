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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith("."))
      return compile(
        resolve(dirname(filename), `${specifier}.ts`),
        overrides,
        cache,
      );
    return require(specifier);
  };
  runInThisContext(`(function(exports,require,module){${source}\n})`, {
    filename,
  })(module.exports, localRequire, module);
  return module.exports;
}

function fixture(status = "ACTIVE", anonymous = false) {
  let databaseCalls = 0;
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw new Error("Creator DB must never be queried");
      },
    },
  );
  const tx = {
    organizationMember: {
      findFirst: async () => ({
        role: "OWNER",
        organizationId: "brand-own",
        user: { email: "brand@example.com" },
        organization: {
          name: "Brand",
          status,
          countryCode: "KR",
          websiteUrl: null,
          metadata: { testWorkspaceAccess: true },
        },
      }),
    },
    creatorDirectoryEntry: forbidden,
    creatorCollection: forbidden,
    directorySearch: forbidden,
    shortLink: { findMany: async () => [] },
    workspaceToolRequest: { findMany: async () => [] },
    campaign: {
      findMany: async (query) => {
        assert.equal(query.where.brandOrganizationId, "brand-own");
        return [
          {
            id: "campaign-own",
            title: "Agency campaign",
            budgetAmount: null,
            createdAt: new Date("2026-11-01"),
            applicationDeadline: null,
            requirements: {},
            _count: { applications: 2 },
          },
        ];
      },
    },
  };
  const handlers = compile("lib/workspace-api.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: {
        TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" },
        PrismaClientKnownRequestError: class extends Error {},
      },
      getDatabase: () => {
        databaseCalls++;
        return {
          $queryRaw: async () => [{ count: 1 }],
          $transaction: async (work) => work(tx),
        };
      },
    },
    "./auth": {
      getAuth: () => ({
        api: {
          getSession: async () =>
            anonymous ? null : { user: { id: "brand-user" } },
        },
      }),
    },
    "./brand-profile": { hasCompletedBrandProfile: () => true },
  });
  return { handlers, calls: () => databaseCalls };
}

test("all retired discovery handlers deny even authenticated callers without touching the DB", async () => {
  const { handlers, calls } = fixture();
  for (const name of [
    "previewCreatorDirectory",
    "searchWorkspace",
    "collectionWorkspace",
    "creatorDirectoryUnavailable",
  ]) {
    const result = await handlers[name](
      new Request("https://example.com/api", {
        method: "POST",
        body: JSON.stringify({ mode: "similar", creatorId: "known-id" }),
      }),
    );
    assert.equal(result.status, 404);
    assert.match(result.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await result.json(), {
      code: "NOT_FOUND",
      message: "This resource is unavailable.",
    });
  }
  assert.equal(calls(), 0);
});

test("approved test brands receive campaigns but no creator data, saved IDs or search history", async () => {
  const { handlers } = fixture();
  const response = await handlers.bootstrapWorkspace(
    new Request("https://example.com/api/workspace/bootstrap"),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const field of ["creators", "brands", "collections", "recentSearches"])
    assert.deepEqual(data[field], []);
  assert.equal(data.campaigns[0].id, "campaign-own");
  assert.equal(data.campaigns[0].applicationCount, 2);
  assert.equal(data.account.name, "Brand");
});

test("legacy supplier application reads and direct brand decisions are retired", async () => {
  const { handlers, calls } = fixture();
  const route = compile("app/api/workspace/campaign-applications/route.ts", {
    "../../../../lib/workspace-api": handlers,
  });
  for (const method of ["GET", "POST"]) {
    const response = await route[method](new Request(
      "https://example.com/api/workspace/campaign-applications?campaignId=campaign-own",
      { method, ...(method === "POST" ? { body: JSON.stringify({ action: "accept", applicationId: "supplier-private" }) } : {}) },
    ));
    assert.equal(response.status, 404);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(JSON.stringify(await response.json()).includes("supplier-private"), false);
  }
  assert.equal(calls(), 0);
});

test("bootstrap still rejects anonymous, pending and suspended accounts", async () => {
  for (const [status, anonymous, expected] of [
    ["ACTIVE", true, 401],
    ["PENDING", false, 403],
    ["SUSPENDED", false, 403],
  ]) {
    const state = fixture(status, anonymous);
    const response = await state.handlers.bootstrapWorkspace(
      new Request("https://example.com/api/workspace/bootstrap"),
    );
    assert.equal(response.status, expected);
    if (anonymous) assert.equal(state.calls(), 0);
  }
});

test("legacy creator-project deep links are absent from selectable agency sections", () => {
  const { agencySections } = compile("app/agency/agency-workspace-copy.ts", {});
  assert.equal(agencySections.includes("creator-projects"), false);
  for (const section of ["offers", "projects", "applications", "payments"])
    assert.ok(agencySections.includes(section));
});
