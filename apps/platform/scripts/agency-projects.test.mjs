import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

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

const date = new Date("2026-10-01T00:00:00Z");
const agency = "agency-own";
function campaign(id = "campaign-own", patch = {}) {
  return {
    id,
    title: "Assigned campaign",
    type: "MANAGED",
    status: "IN_PROGRESS",
    platforms: ["youtube"],
    contentDeadline: date,
    createdAt: date,
    updatedAt: date,
    requirements: { privateMarker: "secret-requirements" },
    brandOrganizationId: "private-brand-id",
    coverImageUrl: null,
    applications: [],
    proposals: [],
    productionItems: [],
    agencyPayouts: [],
    ...patch,
  };
}
function proposal(id = "proposal-current", patch = {}) {
  return {
    id,
    status: "APPROVED",
    publishedAt: date,
    supersededAt: null,
    items: [{ supplierOrganizationId: agency }],
    ...patch,
  };
}
function production(patch = {}) {
  return {
    supplierOrganizationId: agency,
    status: "APPROVED",
    proposalItem: {
      status: "APPROVED",
      proposal: {
        id: "proposal-current",
        campaignId: "campaign-own",
        status: "APPROVED",
        publishedAt: date,
      },
    },
    reportingItem: {
      campaignId: "campaign-own",
      status: "ADMIN_REVIEW",
      _count: { submissions: 1 },
    },
    ...patch,
  };
}
const member = {
  organizationId: agency,
  role: "OWNER",
  createdAt: date,
  organization: {
    name: "Own agency",
    status: "ACTIVE",
    metadata: { testWorkspaceAccess: true },
  },
};
const ordinaryMetadata = {
  agencyProfileSubmittedAt: date.toISOString(),
  agencyProfile: {
    organizationName: "Own agency",
    agencyType: "agency",
    address: "Seoul",
    countryCode: "KR",
    establishedOn: "2020-01-01",
    contactName: "Contact",
    contactMethod: "email",
    contactValue: "test@example.com",
    businessLicenseId: "license",
    scopeOfBusiness: "Production",
    platformContact: "contact",
    businessDocumentId: "business-document",
    contractDocumentId: "",
  },
};

function fixture(options = {}) {
  const calls = [];
  class Failure extends Error {
    constructor(status, code) {
      super(code);
      this.status = status;
      this.code = code;
    }
  }
  const tx = {
    session: {
      findFirst: async (query) => {
        calls.push(["session", query]);
        return options.revoked ? null : { id: "session-own" };
      },
    },
    organizationMember: {
      findFirst: async (query) => {
        calls.push(["member", query]);
        if (options.member === null) return null;
        return (options.members ?? [options.member ?? member]).toSorted(
          (a, b) =>
            a.createdAt - b.createdAt ||
            a.organizationId.localeCompare(b.organizationId),
        )[0];
      },
    },
    campaign: {
      findMany: async (query) => {
        calls.push(["campaign", query]);
        const rows = (options.rows ?? []).filter(
          (row) => !query.where.id || row.id === query.where.id,
        );
        const start = query.cursor
          ? rows.findIndex((row) => row.id === query.cursor.id) + 1
          : 0;
        return rows.slice(start, start + query.take);
      },
    },
  };
  const module = compile("lib/agency-projects.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      Prisma: {
        TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" },
      },
      getDatabase: () => ({
        $transaction: async (run, settings) => {
          calls.push(["transaction", settings]);
          return run(tx);
        },
      }),
    },
    "./auth": {
      getAuth: () => ({
        api: {
          getSession: async () =>
            options.anonymous
              ? null
              : { user: { id: "user-own" }, session: { id: "session-own" } },
        },
      }),
    },
    "./workspace-api": {
      fail: (status, code) => {
        throw new Failure(status, code);
      },
      json: (value) =>
        globalThis.Response.json(value, {
          headers: { "Cache-Control": "private, no-store" },
        }),
      rateLimit: async (...args) => calls.push(["rateLimit", args]),
      workspaceBoundary: async (run) => {
        try {
          return await run();
        } catch (error) {
          if (error instanceof Failure)
            return globalThis.Response.json(
              { code: error.code },
              { status: error.status },
            );
          throw error;
        }
      },
    },
  });
  return {
    calls,
    run: (query = "") =>
      module.agencyProjects(
        new globalThis.Request(
          `https://example.com/api/agency/projects${query}`,
        ),
      ),
  };
}

test("fresh session and active approval are required before any campaign read", async () => {
  for (const [options, status] of [
    [{ anonymous: true }, 401],
    [{ revoked: true }, 401],
    [{ member: null }, 403],
    [
      {
        member: {
          ...member,
          organization: { ...member.organization, status: "SUSPENDED" },
        },
      },
      403,
    ],
    [
      {
        member: {
          ...member,
          organization: { ...member.organization, status: "PENDING" },
        },
      },
      403,
    ],
    [
      {
        member: {
          ...member,
          organization: { ...member.organization, metadata: {} },
        },
      },
      403,
    ],
  ]) {
    const f = fixture(options);
    assert.equal((await f.run()).status, status);
    assert.equal(
      f.calls.some(([name]) => name === "campaign"),
      false,
    );
  }
  const f = fixture();
  await f.run();
  const query = f.calls.find(([name]) => name === "session")[1];
  assert.equal(query.where.userId, "user-own");
  assert.equal(query.where.id, "session-own");
  assert.ok(query.where.expiresAt.gt instanceof Date);
});

test("multi-org users cannot select a permissive second organization through query parameters", async () => {
  const restricted = {
    ...member,
    organization: { ...member.organization, status: "SUSPENDED" },
  };
  const permissive = {
    ...member,
    organizationId: "agency-second",
    createdAt: new Date("2026-10-02T00:00:00Z"),
  };
  const f = fixture({ members: [permissive, restricted] });
  assert.equal((await f.run("?organizationId=agency-second")).status, 403);
  const query = f.calls.find(([name]) => name === "member")[1];
  assert.deepEqual(query.where, {
    userId: "user-own",
    organization: { type: "AGENCY" },
  });
  assert.deepEqual(query.orderBy, [
    { createdAt: "asc" },
    { organizationId: "asc" },
  ]);
  assert.equal(
    f.calls.some(([name]) => name === "campaign"),
    false,
  );
});

test("assigned public proposals and production qualify without inventing accepted applications", async () => {
  const rows = [
    campaign("campaign-official", {
      proposals: [proposal("p-official", { status: "PUBLISHED" })],
    }),
    campaign("campaign-own", {
      productionItems: [production()],
      proposals: [proposal()],
    }),
    campaign("campaign-legacy", {
      applications: [{ agencyOrganizationId: agency, status: "ACCEPTED" }],
    }),
    campaign("campaign-shortlisted", {
      applications: [{ agencyOrganizationId: agency, status: "SHORTLISTED" }],
    }),
    campaign("campaign-private", {
      proposals: [proposal("private", { status: "DRAFT", publishedAt: null })],
    }),
    campaign("campaign-superseded", {
      proposals: [
        proposal("old", { status: "SUPERSEDED", supersededAt: date }),
      ],
    }),
    campaign("campaign-foreign", {
      proposals: [
        proposal("foreign", {
          items: [{ supplierOrganizationId: "agency-other" }],
        }),
      ],
    }),
  ];
  const f = fixture({ rows });
  const response = await f.run();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(
    body.projects.map((row) => row.campaignId),
    ["campaign-official", "campaign-own", "campaign-legacy"],
  );
  assert.equal(body.projects[0].assignment.acceptedApplication, false);
  assert.deepEqual(body.projects[0].availableStages, []);
  assert.deepEqual(body.projects[1].availableStages, [
    "production",
    "reporting",
  ]);
  assert.deepEqual(body.projects[2].availableStages, ["records"]);
  const query = f.calls.find(([name]) => name === "campaign")[1];
  assert.equal(query.where.OR[0].applications.some.status, "ACCEPTED");
  assert.equal(
    query.where.OR[1].productionItems.some.supplierOrganizationId,
    agency,
  );
  assert.equal(
    query.where.OR[2].proposals.some.items.some.OR[1].supplierOrganizationId,
    agency,
  );
  assert.deepEqual(query.select.proposals.where.publishedAt, { not: null });
  assert.equal(query.select.proposals.where.supersededAt, null);
  assert.equal(query.select.proposals.take, 1);
});

test("counts only own current work; historical tasks and pending public reports retain read destinations", async () => {
  const old = production({
    proposalItem: {
      status: "APPROVED",
      proposal: {
        id: "old",
        campaignId: "campaign-own",
        status: "SUPERSEDED",
        publishedAt: date,
      },
    },
    reportingItem: null,
  });
  const foreign = production({ supplierOrganizationId: "agency-other" });
  const mismatch = production({
    proposalItem: {
      status: "APPROVED",
      proposal: {
        id: "proposal-current",
        campaignId: "another-campaign",
        status: "APPROVED",
        publishedAt: date,
      },
    },
  });
  const privateTask = production({
    proposalItem: {
      status: "APPROVED",
      proposal: {
        id: "private",
        campaignId: "campaign-own",
        status: "DRAFT",
        publishedAt: null,
      },
    },
  });
  const current = production();
  const f = fixture({
    rows: [
      campaign("campaign-own", {
        status: "COMPLETED",
        proposals: [proposal()],
        productionItems: [current, old, foreign, mismatch, privateTask],
        agencyPayouts: [
          { supplierOrganizationId: agency, status: "ISSUED", issuedAt: date },
          { supplierOrganizationId: agency, status: "DRAFT", issuedAt: null },
          {
            supplierOrganizationId: "agency-other",
            status: "PAID",
            issuedAt: date,
          },
        ],
      }),
    ],
  });
  const row = (await (await f.run()).json()).projects[0];
  assert.equal(row.isClosed, true);
  assert.deepEqual(row.production, {
    total: 2,
    current: 1,
    awaitingSubmission: 0,
    underReview: 0,
    changesRequested: 0,
    approved: 1,
  });
  assert.deepEqual(row.reporting, {
    total: 1,
    current: 1,
    awaitingSubmission: 0,
    underReview: 1,
    changesRequested: 0,
    published: 0,
    publicReports: 1,
  });
  assert.deepEqual(row.settlement, { issued: 1, paid: 0 });
  assert.deepEqual(row.availableStages, [
    "production",
    "reporting",
    "settlement",
  ]);
});

test("final production assignment supersedes the initial supplier for proposal access and counts", async () => {
  const reassignedAway = {
    supplierOrganizationId: agency,
    productionItem: { supplierOrganizationId: "agency-other" },
  };
  const unassigned = {
    supplierOrganizationId: agency,
    productionItem: { supplierOrganizationId: null },
  };
  const assignedToUs = {
    supplierOrganizationId: "agency-other",
    productionItem: { supplierOrganizationId: agency },
  };
  const notPrepared = { supplierOrganizationId: agency, productionItem: null };
  const rows = [
    campaign("reassigned-away", {
      proposals: [
        proposal("old-access", { items: [reassignedAway, unassigned] }),
      ],
    }),
    campaign("campaign-own", {
      proposals: [
        proposal("proposal-current", {
          items: [reassignedAway, assignedToUs, notPrepared],
        }),
      ],
      productionItems: [production()],
    }),
  ];
  const f = fixture({ rows });
  const body = await (await f.run()).json();
  assert.deepEqual(
    body.projects.map((row) => row.campaignId),
    ["campaign-own"],
  );
  assert.equal(body.projects[0].assignment.officialProposalItems, 2);
  assert.equal(body.projects[0].production.total, 1);
  const query = f.calls.find(([name]) => name === "campaign")[1];
  assert.deepEqual(query.select.proposals.select.items.where, {
    OR: [
      { productionItem: { supplierOrganizationId: agency } },
      { productionItem: { is: null }, supplierOrganizationId: agency },
    ],
  });
  assert.deepEqual(
    query.where.OR[2].proposals.some.items.some,
    query.select.proposals.select.items.where,
  );
});

test("accepted applications do not expose other agency work, unpublished payouts, prices or private notes", async () => {
  const row = campaign("campaign-own", {
    applications: [{ agencyOrganizationId: agency, status: "ACCEPTED" }],
    productionItems: [
      production({
        supplierOrganizationId: "agency-other",
        internalNote: "internal-secret",
      }),
    ],
    agencyPayouts: [
      {
        supplierOrganizationId: agency,
        status: "DRAFT",
        issuedAt: null,
        amount: "123456",
        internalNote: "internal-secret",
      },
    ],
    brandInvoice: { amount: "99999" },
    brandBudget: "99999",
    supplierCost: "123456",
  });
  const f = fixture({ rows: [row], member: { ...member, role: "MEMBER" } });
  const body = await (await f.run()).json();
  assert.equal(body.organization.role, "MEMBER");
  assert.deepEqual(body.projects[0].availableStages, ["records"]);
  assert.equal(body.projects[0].production.total, 0);
  assert.deepEqual(body.projects[0].settlement, { issued: 0, paid: 0 });
  const serialized = JSON.stringify(body);
  for (const secret of [
    "agency-other",
    "internal-secret",
    "secret-requirements",
    "private-brand-id",
    "123456",
    "99999",
    "supplierCost",
    "brandInvoice",
  ])
    assert.equal(serialized.includes(secret), false, secret);
  const select = f.calls.find(([name]) => name === "campaign")[1].select;
  assert.equal(Object.hasOwn(select, "budget"), false);
  assert.equal(Object.hasOwn(select, "brandInvoices"), false);
  assert.equal(Object.hasOwn(select.agencyPayouts.select, "amount"), false);
  assert.equal(
    Object.hasOwn(select.productionItems.select, "submissions"),
    false,
  );
});

test("ordinary agencies exclude demo metadata and scan past a hidden page without dropping real assignments", async () => {
  const rows = Array.from({ length: 101 }, (_, i) =>
    campaign(`demo-${i}`, {
      requirements: { demo: true },
      applications: [{ agencyOrganizationId: agency, status: "ACCEPTED" }],
    }),
  );
  rows.push(
    campaign("real-own", {
      applications: [{ agencyOrganizationId: agency, status: "ACCEPTED" }],
    }),
  );
  const f = fixture({
    rows,
    member: {
      ...member,
      organization: { ...member.organization, metadata: ordinaryMetadata },
    },
  });
  const body = await (await f.run()).json();
  assert.deepEqual(
    body.projects.map((row) => row.campaignId),
    ["real-own"],
  );
  assert.equal(body.hasMore, false);
  assert.equal(body.organization.isTestWorkspace, false);
  assert.equal(f.calls.filter(([name]) => name === "campaign").length, 2);
});

test("exact campaign filters never fall back to all projects; invalid and foreign requests are rejected", async () => {
  const rows = [campaign("campaign-own", { proposals: [proposal()] })];
  for (const query of [
    "?campaignId=",
    "?campaignId=bad%2Fpath",
    "?campaignId=campaign-own&campaignId=other",
  ]) {
    const f = fixture({ rows });
    assert.equal((await f.run(query)).status, 400);
    assert.equal(
      f.calls.some(([name]) => name === "campaign"),
      false,
    );
  }
  assert.equal(
    (await fixture({ rows }).run("?campaignId=campaign-other")).status,
    404,
  );
  const own = await (
    await fixture({ rows }).run(
      "?campaignId=campaign-own&organizationId=agency-other",
    )
  ).json();
  assert.deepEqual(
    own.projects.map((row) => row.campaignId),
    ["campaign-own"],
  );
});

test("overview is bounded with honest hasMore and the route exports GET only", async () => {
  const rows = Array.from({ length: 101 }, (_, i) =>
    campaign(`campaign-${i}`, {
      applications: [{ agencyOrganizationId: agency, status: "ACCEPTED" }],
    }),
  );
  const body = await (await fixture({ rows }).run()).json();
  assert.equal(body.projects.length, 100);
  assert.equal(body.hasMore, true);
  const route = readFileSync(
    resolve(base, "app/api/agency/projects/route.ts"),
    "utf8",
  );
  assert.match(route, /export const GET = agencyProjects/);
  assert.doesNotMatch(
    route,
    /export (?:const|function|async function) (?:POST|PUT|PATCH|DELETE)/,
  );
});
