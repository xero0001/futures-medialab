import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import * as prices from "@futures-medialab/database/proposal-validation";
import * as statuses from "@futures-medialab/database/application-status";
const { Request, Response } = globalThis;
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
function compile(file, overrides, cache = new Map()) {
  const filename = resolve(root, file);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
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
const decimal = (v) => ({ toFixed: () => Number(v).toFixed(2) });
const future = () =>
  new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
function fixture(options = {}) {
  const campaigns = [
    {
      id: "campaign",
      type: "OPEN_BIDDING",
      status: "RECRUITING",
      title: "Public game",
      currency: "USD",
      platforms: ["youtube"],
      publishedAt: new Date(),
      applicationDeadline: new Date(Date.now() + 86400000),
      contentDeadline: null,
      requirements: {
        supplierOffer: { unitCap: "100" },
        privateNotes: "SECRET",
      },
      budgetAmount: decimal("123456.78"),
      brandOrganizationId: "brand",
      ...options.campaign,
    },
  ];
  const creators = [
    {
      id: "creator",
      displayName: "Creator",
      agencyOrganizationId: "agency",
      isActive: true,
      categories: ["RPG"],
      channels: [
        {
          platform: "youtube",
          url: "https://youtube.com/@creator",
          followers: 1,
        },
      ],
      partnerProfile: { available: "2026-01-01", acceptance: "검토 가능" },
      updatedAt: new Date(),
    },
    {
      id: "foreign",
      displayName: "Foreign",
      agencyOrganizationId: "other",
      isActive: true,
      channels: [],
    },
  ];
  let sequence = 0;
  const apps = [],
    rows = [],
    links = [],
    audit = [];
  const wrap = (a) => ({
    ...a,
    campaign: campaigns[0],
    rows: rows
      .filter((r) => r.applicationId === a.id)
      .map((r) => ({ ...r, proposalItems: r.proposalItems ?? [] })),
  });
  const member = {
    organizationId: "agency",
    role: options.role ?? "OWNER",
    organization: {
      status: options.pending ? "PENDING" : "ACTIVE",
      metadata: {},
    },
  };
  const tx = {
    session: {
      findFirst: async () => (options.revoked ? null : { id: "session" }),
    },
    organizationMember: {
      findFirst: async ({ where }) =>
        options.foreignRole || where.userId !== "user" ? null : member,
    },
    campaign: {
      findFirst: async ({ where }) =>
        campaigns.find((c) => c.id === where.id) ?? null,
      findMany: async () => campaigns,
    },
    creatorProfile: {
      findMany: async ({ where }) =>
        creators.filter(
          (c) =>
            c.agencyOrganizationId === where.agencyOrganizationId &&
            c.isActive &&
            (!where.id || where.id.in.includes(c.id)),
        ),
      findFirst: async ({ where }) =>
        creators.find(
          (c) =>
            c.id === where.id &&
            c.agencyOrganizationId === where.agencyOrganizationId,
        ) ?? null,
      update: async ({ where, data }) => {
        const c = creators.find((c) => c.id === where.id);
        Object.assign(c, data, { updatedAt: new Date() });
        return c;
      },
      create: async ({ data }) => {
        const c = {
          id: `creator-${++sequence}`,
          ...data,
          isActive: true,
          updatedAt: new Date(),
        };
        creators.push(c);
        return c;
      },
    },
    campaignApplication: {
      findUnique: async ({ where }) =>
        apps.find(
          (a) =>
            a.campaignId === where.campaignId_agencyOrganizationId.campaignId &&
            a.agencyOrganizationId ===
              where.campaignId_agencyOrganizationId.agencyOrganizationId,
        ) ?? null,
      findFirst: async ({ where }) => {
        const a = apps.find(
          (a) =>
            a.id === where.id &&
            a.agencyOrganizationId === where.agencyOrganizationId,
        );
        return a ? wrap(a) : null;
      },
      findMany: async ({ where }) =>
        apps
          .filter((a) => a.agencyOrganizationId === where.agencyOrganizationId)
          .map(wrap),
      count: async () => apps.length,
      create: async ({ data }) => {
        const a = {
          id: `app-${++sequence}`,
          ...data,
          proposedAmount: decimal(data.proposedAmount),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        apps.push(a);
        return a;
      },
      update: async ({ where, data }) => {
        const a = apps.find((a) => a.id === where.id);
        const { rows: mutation, ...values } = data;
        Object.assign(a, values, {
          updatedAt: new Date(Date.now() + ++sequence),
          ...(data.proposedAmount
            ? { proposedAmount: decimal(data.proposedAmount) }
            : {}),
        });
        if (mutation)
          rows
            .filter((r) => r.applicationId === a.id)
            .forEach((r) => {
              r.status = mutation.updateMany.data.status;
            });
        return a;
      },
    },
    applicationRow: {
      createMany: async ({ data }) =>
        data.forEach((d) =>
          rows.push({
            id: `row-${++sequence}`,
            ...d,
            unitAmount: decimal(d.unitAmount),
          }),
        ),
      deleteMany: async ({ where }) => {
        for (let i = rows.length - 1; i >= 0; i--)
          if (rows[i].applicationId === where.applicationId) rows.splice(i, 1);
      },
    },
    applicationCreator: {
      createMany: async ({ data }) => links.push(...data),
      deleteMany: async ({ where }) => {
        for (let i = links.length - 1; i >= 0; i--)
          if (links[i].applicationId === where.applicationId)
            links.splice(i, 1);
      },
    },
    proposalItem: {
      count: async ({ where }) =>
        where.applicationRow
          ? rows
              .filter(
                (r) => r.applicationId === where.applicationRow.applicationId,
              )
              .reduce((sum, r) => sum + (r.proposalItems?.length ?? 0), 0)
          : options.legacyPublished
            ? 1
            : 0,
    },
    auditLog: { create: async ({ data }) => audit.push(data) },
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
  const overrides = {
    "server-only": {},
    "@futures-medialab/database": {
      getDatabase: () => ({ ...tx, $transaction: async (cb) => cb(tx) }),
      Prisma: {
        TransactionIsolationLevel: {
          Serializable: "Serializable",
          RepeatableRead: "RepeatableRead",
        },
      },
    },
    "@futures-medialab/database/proposal-validation": prices,
    "@futures-medialab/database/application-status": statuses,
    "./auth": {
      getAuth: () => ({
        api: {
          getSession: async () =>
            options.anonymous
              ? null
              : { user: { id: "user" }, session: { id: "session" } },
        },
      }),
    },
    "./agency-profile": { hasSubmittedAgencyProfile: () => true },
    "./test-workspace-access": { hasApprovedTestWorkspaceAccess: () => false },
    "./campaign-demo": {
      canAccessCampaign: () => true,
      DEMO_CAMPAIGN_BRAND_ID: "demo",
      getDemoCampaignArtwork: () => null,
      isDemoCampaign: () => false,
    },
    "./workspace-api": {
      fail,
      rateLimit: async () => {},
      json: (data, status = 200) => Response.json(data, { status }),
      workspaceBoundary: async (cb) => {
        try {
          return await cb();
        } catch (e) {
          if (e instanceof Failure)
            return Response.json({ code: e.code }, { status: e.status });
          throw e;
        }
      },
      verifyOrigin: (req) => {
        if (req.headers.get("origin") !== "https://agency.test")
          fail(403, "INVALID_ORIGIN");
      },
      readBody: async (req, schema) => {
        const p = schema.safeParse(await req.json());
        if (!p.success) fail(400, "INVALID_INPUT");
        return p.data;
      },
    },
  };
  const service = compile("lib/partner-applications.ts", overrides);
  const market = compile("lib/campaign-marketplace.ts", overrides);
  const call = (fn, data, origin = "https://agency.test") =>
    fn(
      new Request("https://agency.test/api", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin },
        body: JSON.stringify(data),
      }),
    );
  return {
    apps,
    rows,
    links,
    creators,
    campaigns,
    audit,
    service,
    post: (data, origin) => call(service.agencyApplications, data, origin),
    saveCreator: (data) => call(service.partnerCreatorMutation, data),
    get: () => service.partnerWorkspace(new Request("https://agency.test/api")),
    market: () =>
      market.agencyCampaigns(new Request("https://agency.test/api")),
  };
}
const input = (changes) => ({
  action: "apply",
  campaignId: "campaign",
  clientRequestId: randomUUID(),
  note: "Creator terms",
  rows: [
    {
      creatorId: "creator",
      platform: "youtube",
      format: "VOD",
      quantity: 3,
      unitAmount: "12.35",
      date: future(),
    },
  ],
  ...changes,
});
test("real application stores exact creator rows and sourcing links; reload and retry retain one submission", async () => {
  const f = fixture(),
    body = input();
  assert.equal((await f.post(body)).status, 200);
  assert.equal(f.apps[0].proposedAmount.toFixed(2), "37.05");
  assert.equal(f.rows.length, 1);
  assert.equal(f.links[0].creatorId, "creator");
  assert.equal((await f.post(body)).status, 200);
  assert.equal(f.apps.length, 1);
  const data = await (await f.get()).json();
  assert.equal(data.applications[0].lines[0].rate, 12.35);
  assert.equal(data.applications[0].status, "received");
  assert.equal(
    (await f.post({ ...body, note: "Changed under same key" })).status,
    409,
  );
  assert.equal((await f.post(input())).status, 409);
});
test("draft persists after reload and submits with optimistic concurrency", async () => {
  const f = fixture();
  assert.equal((await f.post(input({ action: "saveDraft" }))).status, 200);
  const draft = (await (await f.get()).json()).applications[0];
  assert.equal(draft.status, "draft");
  assert.equal(
    (
      await f.post(
        input({
          applicationId: draft.id,
          expectedUpdatedAt: "2000-01-01T00:00:00Z",
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.post(
        input({ applicationId: draft.id, expectedUpdatedAt: draft.updated }),
      )
    ).status,
    200,
  );
  assert.equal(f.apps.length, 1);
  assert.equal(f.rows.length, 1);
  assert.equal(f.apps[0].status, "SUBMITTED");
});
test("authorization, CSRF, foreign creators and invalid recruitment terms cannot write", async () => {
  for (const options of [
    { anonymous: true },
    { pending: true },
    { role: "MEMBER" },
    { revoked: true },
    { foreignRole: true },
  ]) {
    const f = fixture(options);
    assert.ok((await f.post(input())).status >= 400);
    assert.equal(f.apps.length, 0);
  }
  const f = fixture();
  assert.equal((await f.post(input(), "https://evil.test")).status, 403);
  for (const row of [
    { creatorId: "foreign" },
    { platform: "tiktok" },
    { unitAmount: "100.01" },
    { date: "2000-01-01" },
    { quantity: 0 },
  ])
    assert.ok(
      (await f.post(input({ rows: [{ ...input().rows[0], ...row }] })))
        .status >= 400,
    );
  assert.equal(
    (await f.post(input({ rows: [input().rows[0], input().rows[0]] }))).status,
    400,
  );
  for (const campaign of [
    { status: "IN_PROGRESS" },
    { applicationDeadline: new Date(0) },
    { publishedAt: null },
  ])
    assert.equal((await fixture({ campaign }).post(input())).status, 409);
  assert.equal(f.apps.length, 0);
});
test("supplier rates are independent of hidden brand budget in API response", async () => {
  const f = fixture();
  const data = await (await f.market()).json();
  assert.equal(data.campaigns[0].supplierRateCap, "100");
  for (const key of [
    "budgetAmount",
    "requirements",
    "brandOrganizationId",
    "brandOrganization",
  ])
    assert.equal(Object.hasOwn(data.campaigns[0], key), false);
  assert.equal(JSON.stringify(data).includes("123456.78"), false);
});
test("withdrawal persists but published or foreign applications are protected", async () => {
  const f = fixture();
  await f.post(input());
  assert.equal(
    (await f.post({ action: "withdraw", applicationId: "foreign" })).status,
    409,
  );
  f.rows[0].proposalItems = [
    {
      status: "PENDING",
      proposal: {
        publishedAt: new Date(),
        supersededAt: null,
        expiresAt: new Date(Date.now() + 100000),
        status: "PUBLISHED",
      },
    },
  ];
  assert.equal(
    (await f.post({ action: "withdraw", applicationId: f.apps[0].id })).status,
    409,
  );
  assert.equal(
    (await (await f.get()).json()).applications[0].status,
    "brand_pending",
  );
  f.rows[0].proposalItems[0].status = "APPROVED";
  assert.equal(
    (await (await f.get()).json()).applications[0].status,
    "confirmed",
  );
  f.rows[0].proposalItems = [];
  assert.equal(
    (await f.post({ action: "withdraw", applicationId: f.apps[0].id })).status,
    200,
  );
  assert.equal(
    (await (await f.get()).json()).applications[0].status,
    "withdrawn",
  );
});
test("creator updates are scoped, retain server identity and survive reload", async () => {
  const f = fixture();
  const body = {
    name: "New creator",
    channel: "https://youtube.com/@new",
    platform: "youtube",
    genre: "RPG",
    followers: 1000,
    format: "VOD",
    rate: 20,
    available: future(),
    acceptance: "검토 가능",
    bio: "Games",
  };
  assert.equal((await f.saveCreator(body)).status, 200);
  const data = await (await f.get()).json();
  assert.equal(data.creators.length, 2);
  assert.equal(
    data.creators.some((c) => c.id === "foreign"),
    false,
  );
  assert.equal(
    (
      await f.saveCreator({
        ...body,
        id: "foreign",
        expectedUpdatedAt: new Date().toISOString(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.saveCreator({ ...body, channel: "https://evil.test/contact" }))
      .status,
    400,
  );
});
test("status derivation respects superseded versions, expiry, partial confirmation and cancellation", () => {
  const proposal = {
    publishedAt: new Date(),
    supersededAt: null,
    status: "PUBLISHED",
    expiresAt: new Date(Date.now() + 100000),
  };
  assert.equal(
    statuses.supplierRowStatus(
      { status: "ACCEPTED", proposalItems: [{ status: "PENDING", proposal }] },
      "RECRUITING",
    ),
    "brand_pending",
  );
  assert.equal(
    statuses.supplierRowStatus(
      {
        status: "ACCEPTED",
        proposalItems: [
          {
            status: "PENDING",
            proposal: { ...proposal, expiresAt: new Date(0) },
          },
        ],
      },
      "RECRUITING",
    ),
    "expired",
  );
  assert.equal(
    statuses.supplierRowStatus(
      {
        status: "ACCEPTED",
        proposalItems: [
          {
            status: "APPROVED",
            proposal: {
              ...proposal,
              supersededAt: new Date(),
              status: "SUPERSEDED",
            },
          },
        ],
      },
      "RECRUITING",
    ),
    "selected",
  );
  assert.equal(
    statuses.supplierApplicationStatus(["confirmed", "not_selected"]),
    "partially_confirmed",
  );
  assert.equal(
    statuses.supplierRowStatus({ status: "ACCEPTED" }, "CANCELED"),
    "canceled",
  );
});

test("incomplete drafts survive reload, require complete submission, and can be corrected after withdrawal", async () => {
  const f = fixture();
  const draftInput = input({
    action: "saveDraft",
    rows: [
      {
        creatorId: "",
        platform: "",
        format: "VOD",
        quantity: 0,
        unitAmount: "0",
        date: "",
      },
    ],
  });
  assert.equal((await f.post(draftInput)).status, 200);
  let app = (await (await f.get()).json()).applications[0];
  assert.equal(app.status, "draft");
  assert.equal(app.lines[0].date, "");
  assert.equal(app.lines[0].creatorId, "");
  assert.equal(f.rows.length, 0);
  assert.equal(
    (
      await f.post({
        ...draftInput,
        action: "apply",
        clientRequestId: randomUUID(),
        applicationId: app.id,
        expectedUpdatedAt: app.updated,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.post(
        input({ applicationId: app.id, expectedUpdatedAt: app.updated }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await f.post({ action: "withdraw", applicationId: app.id })).status,
    200,
  );
  app = (await (await f.get()).json()).applications[0];
  assert.equal(app.canEdit, true);
  assert.equal(
    (
      await f.post(
        input({
          applicationId: app.id,
          expectedUpdatedAt: app.updated,
          note: "Corrected terms",
        }),
      )
    ).status,
    200,
  );
  assert.equal(f.apps.length, 1);
  assert.equal(f.rows.length, 1);
  assert.equal(
    (await (await f.get()).json()).applications[0].status,
    "received",
  );
});

test("unreviewed submissions can be edited with a revision check and every registered channel is selectable", async () => {
  const f = fixture();
  f.creators[0].channels.push({
    platform: "tiktok",
    url: "https://www.tiktok.com/@creator",
    followers: 10,
  });
  f.campaigns[0].platforms = ["tiktok"];
  const roster = (await (await f.get()).json()).creators[0];
  assert.deepEqual(
    roster.channels.map((c) => c.platform),
    ["YouTube", "TikTok"],
  );
  const body = input({ rows: [{ ...input().rows[0], platform: "tiktok" }] });
  assert.equal((await f.post(body)).status, 200);
  const app = (await (await f.get()).json()).applications[0];
  assert.equal(app.canEdit, true);
  assert.equal(
    (
      await f.post({
        ...body,
        clientRequestId: randomUUID(),
        applicationId: app.id,
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.post({
        ...body,
        clientRequestId: randomUUID(),
        applicationId: app.id,
        expectedUpdatedAt: app.updated,
        note: "Updated",
      })
    ).status,
    200,
  );
  assert.equal(f.rows[0].platform, "tiktok");
  assert.equal(f.rows.length, 1);
});

test("editing an application already used in a private or published proposal preserves its rows", async () => {
  const f = fixture();
  await f.post(input());
  f.rows[0].proposalItems = [
    {
      status: "PENDING",
      proposal: {
        publishedAt: null,
        supersededAt: null,
        expiresAt: null,
        status: "DRAFT",
      },
    },
  ];
  const app = (await (await f.get()).json()).applications[0];
  assert.equal(app.canEdit, false);
  assert.equal(
    (
      await f.post(
        input({ applicationId: app.id, expectedUpdatedAt: app.updated }),
      )
    ).status,
    409,
  );
  assert.equal(f.rows.length, 1);
});
