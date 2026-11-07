import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// Exercise the real handlers, validators, tenant policy and HTTP boundary with
// isolated storage. This suite never loads .env files or connects to a database.
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
const origin = "https://futures.example.com";
const key = "4a957481-a381-49d9-b5a9-b9d41bf558d7";
const futureDate = new Date(Date.now() + 30 * 86400000)
  .toISOString()
  .slice(0, 10);
const futureDeadline = new Date(Date.now() + 10 * 86400000).toISOString();
const input = (changes = {}) => ({
  title: "실제 브랜드 요청",
  genre: "RPG",
  goal: "한국 출시 인지도 확대",
  contentFormat: "라이브 + VOD",
  creatorCount: 3,
  desiredDate: futureDate,
  note: "필수 메시지",
  compositionPreference: "balanced",
  budgetAmount: "20000.00",
  currency: "USD",
  platforms: ["youtube", "chzzk"],
  regions: ["KR"],
  route: "managed",
  clientRequestId: key,
  ...changes,
});
const request = (body, headers = {}) =>
  new globalThis.Request(`${origin}/api/brand/campaigns`, {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: {
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
function fixture(options = {}) {
  const store = {
    campaigns: [],
    games: [...(options.games ?? [])],
    requests: [],
    events: [],
    writes: 0,
    reads: 0,
    production: options.production ?? [],
    proposals: options.proposals ?? [],
    reporting: options.reporting ?? [],
    invoices: options.invoices ?? [],
  };
  let memberCalls = 0;
  const forbidden = new Proxy(
    {},
    {
      get: () => {
        throw new Error("Supplier or creator directory data must not be read");
      },
    },
  );
  const member = {
    role: options.role ?? "OWNER",
    organizationId: "brand-own",
    user: { email: "owner@example.com" },
    organization: {
      name: "브랜드",
      status: options.status ?? "ACTIVE",
      countryCode: "KR",
      websiteUrl: null,
      metadata: {
        profileCompletedAt: "2026-01-01",
        contactName: "담당자",
        internalNotes: "private-organization-data",
      },
    },
  };
  const matchesCampaign = (row, where) =>
    row.brandOrganizationId === where.brandOrganizationId &&
    (!where.id || row.id === where.id) &&
    (!where.requirements ||
      row.requirements.brandIntake?.clientRequestId ===
        where.requirements.equals);
  const matchesRequest = (row, where) =>
    row.organizationId === where.organizationId &&
    (!where.campaignId || row.campaignId === where.campaignId) &&
    (!where.id ||
      (typeof where.id === "string"
        ? row.id === where.id
        : where.id.in.includes(row.id)));
  const groups = (rows) =>
    [...new Set(rows.map((row) => row.status))].map((status) => ({
      status,
      _count: { _all: rows.filter((row) => row.status === status).length },
    }));
  const timestamp = () => new Date(Date.now() + store.writes);
  const visibleGame = (game, where) => where.OR.some(scope => scope.verified ? game.verified : game.organizationId === scope.organizationId);
  const tx = {
    gameCatalog: {
      findFirst: async ({ where }) => store.games.find(game => visibleGame(game, where) && (!where.id || game.id === where.id) && (!where.aliases || game.aliases.includes(where.aliases.has))) ?? null,
      findMany: async ({ where, take }) => store.games.filter(game => visibleGame(game, where) && (!where.searchText || game.searchText.includes(where.searchText.contains))).slice(0, take),
      upsert: async ({ where, create }) => {
        const existing = store.games.find(game => game.key === where.key);
        if (existing) return existing;
        const game = { ...create, id: `game-${store.games.length + 1}`, verified: false, localizations: [create.localizations.create] };
        store.games.push(game);
        return game;
      },
    },
    session: {
      findFirst: async ({ where }) => {
        assert.equal(where.userId, "user-own");
        return options.expired ? null : { id: "session-own" };
      },
    },
    organizationMember: {
      findFirst: async ({ where }) => {
        assert.equal(where.userId, "user-own");
        assert.equal(where.organization.type, "BRAND");
        memberCalls++;
        return options.noMembership
          ? null
          : {
              ...member,
              organization: {
                ...member.organization,
                status:
                  options.revoke && memberCalls > 1
                    ? "PENDING"
                    : member.organization.status,
              },
            };
      },
    },
    campaignProposal: { count: async () => 0 },
    productionItem: { count: async ({ where }) => {
      assert.equal(where.campaign.brandOrganizationId, "brand-own");
      assert.equal(where.status, "BRAND_REVIEW");
      assert.equal(where.proposalItem.proposal.status, "APPROVED");
      assert.equal(where.proposalItem.proposal.supersededAt, null);
      return store.production.filter(item => item.status === "BRAND_REVIEW" && store.campaigns.some(campaign => campaign.id === item.campaignId && where.campaign.status.in.includes(campaign.status)) && store.proposals.some(proposal => proposal.id === item.proposalId && proposal.status === "APPROVED" && !proposal.supersededAt)).length;
    } },
    creatorDirectoryEntry: forbidden,
    creatorProfile: forbidden,
    campaignApplication: forbidden,
    contentSubmission: forbidden,
    campaignContract: forbidden,
    settlement: forbidden,
    campaign: {
      findMany: async ({ where, select, take }) => {
        store.reads++;
        assert.equal(where.brandOrganizationId, "brand-own");
        assert.equal(select.applications, undefined);
        return store.campaigns
          .filter((row) => matchesCampaign(row, where))
          .slice(0, take);
      },
      findFirst: async ({ where }) => {
        store.reads++;
        assert.equal(where.brandOrganizationId, "brand-own");
        return (
          store.campaigns.find((row) => matchesCampaign(row, where)) ?? null
        );
      },
      groupBy: async ({ where }) =>
        groups(store.campaigns.filter((row) => matchesCampaign(row, where))),
      count: async ({ where }) =>
        store.campaigns.filter((row) => matchesCampaign(row, where)).length,
      create: async ({ data }) => {
        store.writes++;
        const row = {
          id: `campaign-${store.campaigns.length + 1}`,
          categories: [],
          applicationDeadline: null,
          contentDeadline: null,
          createdAt: timestamp(),
          updatedAt: timestamp(),
          ...data,
          budgetAmount:
            data.budgetAmount === null
              ? null
              : {
                  toFixed: () => Number(data.budgetAmount).toFixed(2),
                  valueOf: () => Number(data.budgetAmount),
                },
        };
        row.game = store.games.find(game => game.id === row.gameId) ?? null;
        store.campaigns.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        store.writes++;
        const row = store.campaigns.find((row) => row.id === where.id);
        assert.ok(row);
        Object.assign(row, data, { updatedAt: timestamp() });
        row.game = store.games.find(game => game.id === row.gameId) ?? null;
        if (typeof row.budgetAmount === "string") {
          const amount = row.budgetAmount;
          row.budgetAmount = {
            toFixed: () => Number(amount).toFixed(2),
            valueOf: () => Number(amount),
          };
        }
        return row;
      },
    },
    workspaceToolRequest: {
      updateMany: async ({ where, data }) => {
        const rows = store.requests.filter(
          (row) =>
            matchesRequest(row, where) &&
            row.status === where.status &&
            row.version === where.version,
        );
        for (const row of rows)
          Object.assign(row, data, {
            version: row.version + data.version.increment,
          });
        return { count: rows.length };
      },
      findMany: async ({ where, take }) => {
        store.reads++;
        assert.equal(where.organizationId, "brand-own");
        return store.requests
          .filter((row) => matchesRequest(row, where))
          .slice(0, take ?? Infinity)
          .map((row) => ({
            ...row,
            campaign: {
              title:
                store.campaigns.find(
                  (campaign) => campaign.id === row.campaignId,
                )?.title ?? "",
            },
          }));
      },
      findFirst: async ({ where }) => {
        assert.equal(where.organizationId, "brand-own");
        return store.requests.find((row) => matchesRequest(row, where)) ?? null;
      },
      groupBy: async ({ where }) =>
        groups(store.requests.filter((row) => matchesRequest(row, where))),
      create: async ({ data }) => {
        store.writes++;
        const row = {
          id: `request-${store.requests.length + 1}`,
          version: 0,
          createdAt: timestamp(),
          updatedAt: timestamp(),
          ...data,
        };
        store.requests.push(row);
        return row;
      },
    },
    shortLink: {
      findMany: async ({ where }) => {
        assert.equal(where.organizationId, "brand-own");
        return [];
      },
    },
    auditLog: {
      create: async ({ data }) => {
        store.events.push(data);
      },
    },
  };
  const database = {
    ...tx,
    $queryRaw: async () => [{ count: 1 }],
    $transaction: async (work) => work(tx),
  };
  const api = compile("lib/brand-workspace.ts", {
    "server-only": {},
    "@futures-medialab/database/proposals": {
      listBrandLatestProposals: async () => store.proposals.filter(proposal => !proposal.supersededAt),
      listBrandCampaignProposals: async (_tx, organizationId, campaignId) => {
        assert.equal(organizationId, "brand-own");
        return store.proposals.filter(proposal => proposal.campaignId === campaignId);
      },
      summarizeBrandProposal: (proposal) => proposal,
    },
    "@futures-medialab/database/production": {
      listBrandProductionItems: async (_tx, organizationId, campaignId, canManage) => {
        assert.equal(organizationId, "brand-own");
        assert.equal(canManage, member.role !== "MEMBER");
        return store.production.filter(item => !campaignId || item.campaignId === campaignId);
      },
    },
    "@futures-medialab/database/settlement": {
      listBrandInvoices: async (_tx, actor, campaignId) => {
        assert.equal(actor.organizationId, "brand-own");
        assert.equal(actor.userId, "user-own");
        return store.invoices.filter(invoice => !campaignId || invoice.campaignId === campaignId);
      },
    },
    "@futures-medialab/database/reporting": {
      listBrandReportingItems: async (_tx, organizationId, campaignId) => {
        assert.equal(organizationId, "brand-own");
        return store.reporting.filter(item => !campaignId || item.campaignId === campaignId);
      },
    },
    "@futures-medialab/database": {
      getDatabase: () => database,
      Prisma: {
        TransactionIsolationLevel: {
          RepeatableRead: "RepeatableRead",
          Serializable: "Serializable",
        },
        PrismaClientKnownRequestError: class extends Error {},
      },
    },
    "./auth": {
      getAuth: () => ({
        options: { baseURL: origin },
        api: {
          getSession: async () =>
            options.anonymous
              ? null
              : { user: { id: "user-own" }, session: { id: "session-own" } },
        },
      }),
    },
  });
  return { api, store, member };
}

test("authentication, current session, approval and membership gate reads and writes", async () => {
  for (const [options, expected] of [
    [{ anonymous: true }, 401],
    [{ expired: true }, 401],
    [{ status: "PENDING" }, 403],
    [{ status: "SUSPENDED" }, 403],
    [{ noMembership: true }, 403],
  ]) {
    const { api, store } = fixture(options);
    assert.equal((await api.brandWorkspace(request())).status, expected);
    assert.equal(
      (await api.mutateBrandCampaign(request(input()))).status,
      expected,
    );
    assert.equal(store.writes, 0);
    assert.equal(store.reads, 0);
  }
  const revoked = fixture({ revoke: true });
  assert.equal(
    (await revoked.api.mutateBrandCampaign(request(input()))).status,
    403,
  );
  assert.equal(revoked.store.writes, 0);
});

test("member and cross-origin writes are rejected", async () => {
  const member = fixture({ role: "MEMBER" });
  assert.equal(
    (await member.api.mutateBrandCampaign(request(input()))).status,
    403,
  );
  const owner = fixture();
  assert.equal(
    (
      await owner.api.mutateBrandCampaign(
        request(input(), { origin: "https://attacker.example" }),
      )
    ).status,
    403,
  );
  assert.equal(owner.store.writes, 0);
  assert.equal(member.store.writes, 0);
});

test("managed submission persists the brief, request and exact 48-hour deadline with retry protection", async () => {
  const { api, store } = fixture();
  const created = await api.mutateBrandCampaign(request(input()));
  assert.equal(created.status, 200);
  const body = await created.json();
  assert.equal(store.campaigns.length, 1);
  assert.equal(store.requests.length, 1);
  assert.equal(store.campaigns[0].status, "REVIEW");
  assert.equal(store.campaigns[0].brandOrganizationId, "brand-own");
  assert.equal(store.campaigns[0].requirements.brandBrief.goal, input().goal);
  assert.equal(
    Date.parse(body.proposalDueAt) - Date.parse(body.submittedAt),
    48 * 3600000,
  );
  assert.equal(store.requests[0].campaignId, body.id);
  const repeated = await api.mutateBrandCampaign(request(input()));
  assert.deepEqual(await repeated.json(), body);
  assert.equal(store.campaigns.length, 1);
  assert.equal(store.requests.length, 1);
  assert.equal(
    (await api.mutateBrandCampaign(request(input({ budgetAmount: "30000" }))))
      .status,
    409,
  );
});

test("open requests persist their actual recruitment deadline without managed SLA", async () => {
  const { api, store } = fixture();
  const result = await api.mutateBrandCampaign(
    request(input({ route: "open", applicationDeadline: futureDeadline })),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).proposalDueAt, null);
  assert.equal(
    store.campaigns[0].applicationDeadline.toISOString(),
    futureDeadline,
  );
  assert.equal(store.requests[0].dueAt, null);
});

test("draft saves and edits do not submit an intake; submission checks current version and is idempotent", async () => {
  const { api, store } = fixture();
  const saved = await api.mutateBrandCampaign(
    request(input({ action: "saveDraft" })),
  );
  const draft = await saved.json();
  assert.equal(saved.status, 200);
  assert.equal(store.requests.length, 0);
  assert.equal(store.campaigns[0].status, "DRAFT");
  const detail = await api.brandCampaignDetail(request(), draft.id);
  assert.equal((await detail.json()).campaign.submittedAt, null);
  const stale = await api.mutateBrandCampaign(
    request(
      input({
        action: "saveDraft",
        id: draft.id,
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      }),
    ),
  );
  assert.equal(stale.status, 409);
  const updated = await api.mutateBrandCampaign(
    request(
      input({
        action: "saveDraft",
        id: draft.id,
        expectedUpdatedAt: draft.updatedAt,
        goal: "수정된 목표",
      }),
    ),
  );
  const latest = await updated.json();
  assert.equal(updated.status, 200);
  assert.equal(store.requests.length, 0);
  const submit = {
    action: "submitDraft",
    id: draft.id,
    expectedUpdatedAt: latest.updatedAt,
    clientRequestId: "3a957481-a381-49d9-b5a9-b9d41bf558d7",
  };
  const submitted = await api.mutateBrandCampaign(request(submit));
  assert.equal(submitted.status, 200);
  const approved = await submitted.json();
  assert.equal(store.requests.length, 1);
  assert.equal(store.campaigns[0].status, "REVIEW");
  assert.deepEqual(
    await (await api.mutateBrandCampaign(request(submit))).json(),
    approved,
  );
  assert.equal(store.requests.length, 1);
  assert.equal(
    (
      await api.mutateBrandCampaign(
        request({ ...submit, clientRequestId: key }),
      )
    ).status,
    409,
  );
});

test("brand read allowlists omit internal metadata and never query supplier material", async () => {
  const { api, store } = fixture();
  const created = await (
    await api.mutateBrandCampaign(request(input()))
  ).json();
  store.campaigns[0].requirements.secret = "supply-cost-and-margin";
  store.campaigns[0].requirements.brandBrief.partnerName = "private-partner";
  store.campaigns[0].requirements.adminReview = {
    reason: "공개 검토 안내",
    internalMemo: "private-review",
  };
  const response = await api.brandWorkspace(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.campaigns.length, 1);
  assert.equal(body.counts.activeCampaigns, 1);
  assert.equal(body.campaigns[0].reviewNote, "공개 검토 안내");
  assert.equal(body.campaigns[0].requestId, created.requestId);
  const serialized = JSON.stringify(body);
  for (const value of [
    "supply-cost-and-margin",
    "private-partner",
    "private-review",
    "private-organization-data",
    "payloadHash",
    "clientRequestId",
  ])
    assert.ok(!serialized.includes(value), value);
  const detail = await (
    await api.brandCampaignDetail(request(), created.id)
  ).json();
  assert.deepEqual(detail.proposals, []);
  assert.deepEqual(detail.deliverables, []);
  assert.equal(detail.documents, undefined);
  assert.equal(detail.capabilities.campaignDocuments, true);
  assert.deepEqual(detail.performance, { items: [] });
  assert.equal(detail.capabilities.officialProposals, true);
  assert.equal(
    (await api.brandCampaignDetail(request(), "foreign-campaign")).status,
    404,
  );
});

test("strict input rejects extra identity fields, impossible dates and stale deadlines", async () => {
  for (const changes of [
    { creatorName: "private-name" },
    { desiredDate: "2099-02-30" },
    { desiredDate: "2020-01-01" },
    { platforms: ["recommend", "youtube"] },
    { route: "open", applicationDeadline: "2020-01-01T00:00:00.000Z" },
    { budgetAmount: "0" },
  ]) {
    const { api, store } = fixture();
    assert.equal(
      (await api.mutateBrandCampaign(request(input(changes)))).status,
      400,
      JSON.stringify(changes),
    );
    assert.equal(store.writes, 0);
  }
});

test("production summaries count current approved work without making MEMBER review counts disappear", async () => {
  const { api, store, member } = fixture();
  const created = await (await api.mutateBrandCampaign(request(input()))).json();
  store.campaigns[0].status = "IN_PROGRESS";
  store.proposals.push({ id: "proposal-current", campaignId: created.id, status: "APPROVED", items: [], expiresAt: null }, { id: "proposal-old", campaignId: created.id, status: "APPROVED", items: [], supersededAt: new Date() });
  store.production.push(
    { id: "review-current", campaignId: created.id, proposalId: "proposal-current", status: "BRAND_REVIEW" },
    { id: "approved-current", campaignId: created.id, proposalId: "proposal-current", status: "APPROVED" },
    { id: "review-old", campaignId: created.id, proposalId: "proposal-old", status: "BRAND_REVIEW" },
  );
  for (const role of ["OWNER", "MEMBER"]) {
    member.role = role;
    const response = await api.brandWorkspace(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.counts.waitingContentReviews, 1);
    assert.deepEqual(body.campaigns[0].productionSummary, { total: 2, awaitingSubmission: 0, underReview: 0, awaitingBrand: 1, changesRequested: 0, approved: 1 });
    assert.equal(body.capabilities.productionReview, true);
    assert.equal(body.permissions.canManageCampaigns, role !== "MEMBER");
  }
  store.campaigns[0].status = "COMPLETED";
  assert.equal((await (await api.brandWorkspace(request())).json()).counts.waitingContentReviews, 0);
});

test("campaign artwork exposes only approved local demo assets, never arbitrary image or source URLs", async () => {
  const { api, store } = fixture();
  const created = await (await api.mutateBrandCampaign(request(input()))).json();
  const campaign = store.campaigns[0];
  campaign.coverImageUrl = "https://attacker.example/collect";
  campaign.requirements.game = { name: "Game", iconUrl: "https://attacker.example/icon", sourceUrl: "javascript:alert(1)" };
  const read = async () => (await (await api.brandCampaignDetail(request(), created.id)).json()).campaign;
  assert.equal((await read()).coverImageUrl, null);
  Object.assign(campaign.requirements, { demo: true, seed: "official-proposals-nte-v1" });
  const unsafe = await read();
  assert.equal(unsafe.coverImageUrl, null);
  assert.equal(unsafe.gameIconUrl, null);
  assert.equal(unsafe.gameSourceUrl, null);
  campaign.coverImageUrl = "/demo/nte/city-key-art.jpg";
  campaign.requirements.game.iconUrl = "/demo/nte/game-icon.png";
  campaign.requirements.game.sourceUrl = "https://nte.perfectworld.com/kr/";
  const allowed = await read();
  assert.equal(allowed.coverImageUrl, campaign.coverImageUrl);
  assert.equal(allowed.gameIconUrl, "/demo/nte/game-icon.png");
  assert.equal(allowed.gameSourceUrl, "https://nte.perfectworld.com/kr/");
  delete campaign.requirements.seed;
  assert.equal((await read()).coverImageUrl, null);
});

test("reporting summary retains the last public snapshot while an update is reviewed and excludes previous proposal work", async () => {
  const { api, store } = fixture();
  const created = await (await api.mutateBrandCampaign(request(input()))).json();
  store.campaigns[0].status = "IN_PROGRESS";
  store.proposals.push({ id: "current", campaignId: created.id, status: "APPROVED", items: [], expiresAt: null });
  store.reporting.push(
    { id: "report-current", campaignId: created.id, proposalId: "current", isCurrent: true, status: "ADMIN_REVIEW", latestSubmission: { id: "released-v1", metrics: { views: 0, likes: null } }, submissions: [{ id: "released-v1", metrics: { views: 0, likes: null } }] },
    { id: "report-collecting", campaignId: created.id, proposalId: "current", isCurrent: true, status: "PUBLISHED", latestSubmission: { metrics: { views: null, likes: null } } },
    { id: "report-old", campaignId: created.id, proposalId: "old", isCurrent: false, status: "PUBLISHED", latestSubmission: { metrics: { views: 999999 } } },
  );
  const workspace = await (await api.brandWorkspace(request())).json();
  assert.deepEqual(workspace.campaigns[0].reportingSummary, { total: 2, published: 2, pending: 1, allMetricsPending: 1 });
  const detail = await (await api.brandCampaignDetail(request(), created.id)).json();
  assert.equal(detail.capabilities.campaignPerformance, true);
  assert.deepEqual(detail.performance.items[0].submissions.map(value => value.id), ["released-v1"]);
  assert.equal(detail.performance.items[0].latestSubmission.metrics.views, 0);
});

test("title-only drafts roundtrip blanks without a budget, deadline, intake or fake brief", async () => {
  const { api, store } = fixture();
  const response = await api.mutateBrandCampaign(
    request({ action: "saveDraft", title: "새 의뢰", clientRequestId: key }),
  );
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(store.campaigns[0].budgetAmount, null);
  assert.equal(store.campaigns[0].contentDeadline, null);
  assert.equal(store.campaigns[0].summary, "");
  assert.equal(store.requests.length, 0);
  const detail = await (
    await api.brandCampaignDetail(request(), saved.id)
  ).json();
  assert.equal(detail.campaign.brief.goal, "");
  assert.equal(detail.campaign.brief.creatorCount, 0);
  assert.equal(detail.campaign.proposalDueAt, null);
  assert.equal(
    (
      await api.mutateBrandCampaign(
        request({
          action: "submitDraft",
          id: saved.id,
          expectedUpdatedAt: saved.updatedAt,
          clientRequestId: key,
        }),
      )
    ).status,
    400,
  );
});

test("cancellation closes only the linked intake, clears SLA and protects active operator work", async () => {
  const { api, store } = fixture();
  const created = await (
    await api.mutateBrandCampaign(request(input()))
  ).json();
  store.requests.push({
    ...store.requests[0],
    id: "another-inquiry",
    tool: "revision",
  });
  const cancel = {
    action: "cancel",
    id: created.id,
    expectedUpdatedAt: store.campaigns[0].updatedAt.toISOString(),
  };
  assert.equal(
    (
      await api.mutateBrandCampaign(
        request({ ...cancel, id: "foreign-campaign" }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await api.mutateBrandCampaign(
        request({ ...cancel, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" }),
      )
    ).status,
    409,
  );
  store.requests[0].status = "IN_PROGRESS";
  const denied = await api.mutateBrandCampaign(request(cancel));
  assert.equal(denied.status, 409);
  assert.equal((await denied.json()).code, "CANCEL_REVIEW_REQUIRED");
  assert.equal(store.campaigns[0].status, "REVIEW");
  store.requests[0].status = "REQUESTED";
  assert.equal((await api.mutateBrandCampaign(request(cancel))).status, 200);
  assert.equal(store.campaigns[0].status, "CANCELED");
  assert.equal(store.requests[0].status, "CLOSED");
  assert.equal(store.requests[0].dueAt, null);
  assert.equal(store.requests[0].version, 1);
  assert.equal(store.requests[1].status, "REQUESTED");
  assert.ok(
    store.events.some(
      (event) => event.action === "request.closed" && event.payload.public,
    ),
  );
  const detail = await (
    await api.brandCampaignDetail(request(), created.id)
  ).json();
  assert.equal(detail.campaign.proposalDueAt, null);
  assert.equal(detail.campaign.requestId, created.requestId);
  assert.equal((await api.mutateBrandCampaign(request(cancel))).status, 409);
});

test("open final submissions require a recruitment deadline strictly before desired publishing day", async () => {
  const { api, store } = fixture();
  for (const applicationDeadline of [null, `${futureDate}T00:00:00.000Z`]) {
    assert.equal(
      (
        await api.mutateBrandCampaign(
          request(input({ route: "open", applicationDeadline })),
        )
      ).status,
      400,
    );
  }
  const saved = await (
    await api.mutateBrandCampaign(
      request(input({ action: "saveDraft", route: "open" })),
    )
  ).json();
  assert.equal(
    (
      await api.mutateBrandCampaign(
        request({
          action: "submitDraft",
          id: saved.id,
          expectedUpdatedAt: saved.updatedAt,
          clientRequestId: key,
        }),
      )
    ).status,
    400,
  );
  assert.equal(store.requests.length, 0);
});

test("request transaction authorization requires current ACTIVE brand membership", async () => {
  const requests = compile("../../packages/database/src/requests.ts", {
    "./client": {},
  });
  const actor = {
    userId: "user-own",
    sessionId: "session-own",
    kind: "brand",
    organizationId: "brand-own",
  };
  for (const status of ["ACTIVE", "PENDING", "SUSPENDED"]) {
    const tx = {
      session: { findFirst: async () => ({ id: actor.sessionId }) },
      organizationMember: {
        findFirst: async ({ where }) => {
          assert.equal(where.organizationId, actor.organizationId);
          assert.equal(where.organization.type, "BRAND");
          assert.equal(where.organization.status, "ACTIVE");
          return status === where.organization.status
            ? { organizationId: actor.organizationId }
            : null;
        },
      },
    };
    if (status === "ACTIVE") await requests.authorizeRequestActor(tx, actor);
    else
      await assert.rejects(
        () => requests.authorizeRequestActor(tx, actor),
        (error) => error.status === 403,
      );
  }
});

test("a returned campaign reuses its owned intake thread and records the renewed managed deadline", async () => {
  const { api, store } = fixture();
  const created = await (
    await api.mutateBrandCampaign(request(input()))
  ).json();
  const campaign = store.campaigns[0],
    intake = store.requests[0];
  campaign.status = "DRAFT";
  campaign.requirements.adminReview = {
    status: "CHANGES_REQUESTED",
    reason: "목표 보완",
  };
  intake.status = "WAITING_BRAND";
  const originalSubmittedAt = intake.inputJson.submittedAt;
  const submit = {
    action: "submitDraft",
    id: created.id,
    expectedUpdatedAt: campaign.updatedAt.toISOString(),
    clientRequestId: "7a957481-a381-49d9-b5a9-b9d41bf558d7",
  };
  const response = await api.mutateBrandCampaign(request(submit));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requestId, created.requestId);
  assert.equal(store.requests.length, 1);
  assert.equal(intake.status, "REQUESTED");
  assert.equal(intake.version, 1);
  assert.equal(intake.inputJson.firstSubmittedAt, originalSubmittedAt);
  assert.equal(result.originalProposalDueAt, created.proposalDueAt);
  assert.equal(intake.inputJson.originalProposalDueAt, created.proposalDueAt);
  assert.equal(intake.inputJson.waitingFor, null);
  assert.equal(intake.inputJson.operatorReplyPending, false);
  assert.equal(
    Date.parse(result.proposalDueAt) - Date.parse(result.submittedAt),
    48 * 3600000,
  );
  assert.ok(
    store.events.some(
      (event) => event.action === "request.resubmitted" && event.payload.public,
    ),
  );
  assert.deepEqual(
    await (await api.mutateBrandCampaign(request(submit))).json(),
    result,
  );
  assert.equal(intake.version, 1);
});

test("managed campaigns cannot enter public agency discovery or direct application", async () => {
  const queries = [];
  const tx = {
    session: { findFirst: async () => ({ id: "agency-session" }) },
    organizationMember: {
      findFirst: async ({ where }) => {
        assert.equal(where.organization.type, "AGENCY");
        return {
          role: "OWNER",
          organizationId: "agency-own",
          organization: {
            status: "ACTIVE",
            metadata: { testWorkspaceAccess: true },
          },
        };
      },
    },
    campaign: {
      findMany: async ({ where }) => {
        queries.push(where);
        assert.equal(where.type, "OPEN_BIDDING");
        return [];
      },
      findFirst: async ({ where }) => {
        queries.push(where);
        assert.equal(where.type, "OPEN_BIDDING");
        assert.equal(where.id, "managed-private");
        return null;
      },
    },
    campaignApplication: { findMany: async () => [] },
  };
  const api = compile("lib/campaign-marketplace.ts", {
    "server-only": {},
    "@futures-medialab/database": {
      getDatabase: () => ({
        ...tx,
        $transaction: async (work) => work(tx),
        $queryRaw: async () => [{ count: 1 }],
      }),
      Prisma: {
        TransactionIsolationLevel: {
          RepeatableRead: "RepeatableRead",
          Serializable: "Serializable",
        },
        PrismaClientKnownRequestError: class extends Error {},
      },
    },
    "./auth": {
      getAuth: () => ({
        options: { baseURL: origin },
        api: {
          getSession: async () => ({
            user: { id: "agency-user" },
            session: { id: "agency-session" },
          }),
        },
      }),
    },
  });
  assert.equal((await api.agencyCampaigns(request())).status, 200);
  assert.equal(
    (
      await api.agencyApplications(
        request({
          action: "apply",
          campaignId: "managed-private",
          proposal: "Cannot apply by knowing a managed campaign ID",
        }),
      )
    ).status,
    409,
  );
  assert.equal(queries.length, 2);
});

test("completed campaigns expose their issued invoice summary independently from campaign status", async () => {
  const { api, store } = fixture({ role: "OWNER" });
  const created = await (await api.mutateBrandCampaign(request(input()))).json();
  store.campaigns[0].status = "COMPLETED";
  const invoice = { id: "invoice-issued", campaignId: created.id, status: "ISSUED", currency: "USD", amount: "100.01", lines: [] };
  store.invoices.push(invoice, { ...invoice, id: "another-campaign-invoice", campaignId: "campaign-other", status: "PAID" });
  const detail = await (await api.brandCampaignDetail(request(), created.id)).json();
  assert.equal(detail.campaign.status, "COMPLETED");
  assert.deepEqual(detail.campaign.invoiceSummary, { issued: 1, paid: 0 });
  assert.deepEqual(detail.invoices, [invoice]);
  const workspace = await (await api.brandWorkspace(request())).json();
  assert.deepEqual(workspace.campaigns[0].invoiceSummary, { issued: 1, paid: 0 });
  assert.equal(workspace.invoices.length, 2);
  invoice.status = "PAID";
  const paid = await (await api.brandCampaignDetail(request(), created.id)).json();
  assert.equal(paid.campaign.status, "COMPLETED");
  assert.deepEqual(paid.campaign.invoiceSummary, { issued: 0, paid: 1 });
});


test("progress uses the linked intake and public assignee name, never unrelated request state", async () => {
  const { api, store } = fixture();
  const created = await (await api.mutateBrandCampaign(request(input()))).json();
  const intake = store.requests.find((row) => row.id === created.requestId);
  intake.assignedTo = { name: "담당 매니저", email: "PRIVATE_MANAGER_EMAIL" };
  intake.status = "WAITING_BRAND";
  const expectedDue = intake.dueAt.toISOString();
  store.requests.unshift({ ...intake, id: "unrelated-request", status: "RESOLVED", assignedTo: { name: "다른 담당자" }, dueAt: new Date("2099-01-01") });
  const response = await api.brandCampaignDetail(request(), created.id);
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.campaign.intakeStatus, "WAITING_BRAND");
  assert.equal(detail.campaign.intakeAssigneeName, "담당 매니저");
  assert.equal(detail.campaign.intakeDueAt, expectedDue);
  assert.equal(detail.requests.find((row) => row.id === created.requestId).assigneeName, "담당 매니저");
  assert.ok(!JSON.stringify(detail).includes("PRIVATE_MANAGER_EMAIL"));
  store.campaigns[0].status = "DRAFT";
  const draft = await (await api.brandCampaignDetail(request(), created.id)).json();
  for (const field of ["intakeStatus", "intakeAssigneeName", "intakeDueAt"]) assert.equal(draft.campaign[field], null);
});

test("progressive brief validation only requires the revealed groups", () => {
  const { brandCampaignBasicsSchema, brandCampaignDeliverySchema, brandCampaignWizardSchema } = compile("lib/brand-workspace-validation.ts", {});
  const basics = input({ gameName: "신작 게임", goal: "", contentFormat: "", creatorCount: 0, desiredDate: "", platforms: [] });
  assert.equal(brandCampaignBasicsSchema.safeParse(basics).success, true);
  assert.equal(brandCampaignBasicsSchema.safeParse({ ...basics, gameName: " " }).success, false);
  assert.equal(brandCampaignDeliverySchema.safeParse(basics).success, false);
  const delivery = { ...basics, contentFormat: "라이브", creatorCount: 3, desiredDate: futureDate, platforms: ["youtube"] };
  assert.equal(brandCampaignDeliverySchema.safeParse(delivery).success, true);
  assert.equal(brandCampaignWizardSchema.safeParse(delivery).success, false);
  assert.equal(brandCampaignWizardSchema.safeParse({ ...delivery, goal: "인지도 확대", regions: [], note: "" }).success, true);
});

test("each progressive draft roundtrips game name and preserves one campaign until final submission", async () => {
  const { api, store } = fixture();
  const basics = input({ action: "saveDraft", gameName: "신작 게임", goal: "", contentFormat: "", creatorCount: 0, desiredDate: "", platforms: [] });
  const first = await api.mutateBrandCampaign(request(basics));
  assert.equal(first.status, 200);
  let version = await first.json();
  let detail = await (await api.brandCampaignDetail(request(), version.id)).json();
  assert.equal(detail.campaign.brief.gameName, "신작 게임");
  assert.equal(detail.campaign.brief.goal, "");
  assert.equal(store.requests.length, 0);
  const incomplete = await api.mutateBrandCampaign(request({ action: "submitDraft", id: version.id, expectedUpdatedAt: version.updatedAt, clientRequestId: "3a957481-a381-49d9-b5a9-b9d41bf558d7" }));
  assert.equal(incomplete.status, 400);
  for (const values of [
    { ...basics, contentFormat: "쇼츠", creatorCount: 2, desiredDate: futureDate, platforms: ["youtube"] },
    input({ action: "saveDraft", gameName: "수정된 게임명", regions: ["KR", "JP"], note: "참고 사항" }),
  ]) {
    const saved = await api.mutateBrandCampaign(request({ ...values, id: version.id, expectedUpdatedAt: version.updatedAt }));
    assert.equal(saved.status, 200);
    version = await saved.json();
    assert.equal(store.campaigns.length, 1);
    assert.equal(store.requests.length, 0);
  }
  detail = await (await api.brandCampaignDetail(request(), version.id)).json();
  assert.equal(detail.campaign.brief.gameName, "수정된 게임명");
  assert.equal(detail.campaign.brief.note, "참고 사항");
  assert.deepEqual(detail.campaign.regions, ["KR", "JP"]);
  const submitted = await api.mutateBrandCampaign(request({ action: "submitDraft", id: version.id, expectedUpdatedAt: version.updatedAt, clientRequestId: "3a957481-a381-49d9-b5a9-b9d41bf558d7" }));
  assert.equal(submitted.status, 200);
  assert.equal(store.requests.length, 1);
  assert.equal(store.campaigns[0].requirements.brandBrief.gameName, "수정된 게임명");
});

test("draft recovery is scoped and does not overwrite a newer server revision", () => {
  const draft = compile("lib/brand-request-draft.ts", {});
  const storage = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } });
  try {
    const form = { ...input({ gameName: "신작 게임" }), creatorCount: "3", applicationDate: "" };
    const snapshot = { version: 1, savedAt: Date.now(), form, step: 1, stage: 2, requestId: key, submitId: null, draft: { id: "draft-one", updatedAt: "2026-11-08T00:00:00.000Z" } };
    draft.writeRequestDraft("org-a:user-a", "managed", snapshot);
    const restored = draft.readRequestDraft("org-a:user-a", "managed");
    assert.equal(restored.form.gameName, "신작 게임");
    assert.equal(restored.step, 1);
    assert.equal(draft.readRequestDraft("org-a:user-b", "managed"), null);
    assert.equal(draft.readRequestDraft("org-b:user-a", "managed"), null);
    assert.equal(draft.readRequestDraft("org-a:user-a", "open"), null);
    const campaign = { ...snapshot.draft, status: "DRAFT" };
    assert.equal(draft.canRestoreRequestDraft(restored, campaign), true);
    assert.equal(draft.canRestoreRequestDraft(restored, { ...campaign, updatedAt: "2026-11-08T00:00:01.000Z" }), false);
    assert.equal(draft.canRestoreRequestDraft(restored, { ...campaign, status: "REVIEW" }), false);
    assert.equal(draft.canRestoreRequestDraft(restored, { ...campaign, id: "another-draft" }), false);
    assert.equal(draft.canRestoreRequestDraft(restored), false);
    draft.clearRequestDraft("org-a:user-a", "managed");
    assert.equal(draft.readRequestDraft("org-a:user-a", "managed"), null);
    draft.writeRequestDraft("org-a:user-a", "managed", { ...snapshot, savedAt: Date.now() - 31 * 86400000 });
    assert.equal(draft.readRequestDraft("org-a:user-a", "managed"), null);
    storage.set([...storage.keys()][0], "malformed json");
    assert.equal(draft.readRequestDraft("org-a:user-a", "managed"), null);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage disabled"); } });
    assert.equal(draft.readRequestDraft("org-a:user-a", "managed"), null);
    assert.doesNotThrow(() => draft.writeRequestDraft("org-a:user-a", "managed", snapshot));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

const officialGame = {
  id: "game_nte", key: "nte", title: "NTE (Neverness to Everness)", verified: true, organizationId: null,
  thumbnailUrl: "/demo/nte/game-icon.png", aliases: ["이환", "nte", "异环"], searchText: "이환 nte neverness to everness 异环",
  localizations: [
    { locale: "KO", title: "이환", officialUrl: "https://nte.perfectworld.com/kr/" },
    { locale: "EN", title: "NTE (Neverness to Everness)", officialUrl: "https://nte.perfectworld.com/en/" },
    { locale: "ZH", title: "异环", officialUrl: "https://yh.wanmei.com/" },
  ],
};

test("game search localizes official titles and never exposes another brand's unverified games", async () => {
  const privateGame = { ...officialGame, id: "game-private", verified: false, organizationId: "brand-other", title: "Secret game", searchText: "secret", aliases: ["secret"] };
  const { api } = fixture({ games: [officialGame, privateGame] });
  for (const [lang, title] of [["ko", "이환"], ["en", "NTE (Neverness to Everness)"], ["zh", "异环"]]) {
    const result = await api.brandGameCatalog(new globalThis.Request(`${origin}/api/brand/games?q=NTE&lang=${lang}`));
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.games[0].title, title);
    assert.equal(body.games[0].thumbnailUrl, "/demo/nte/game-icon.png");
    assert.equal(body.games.length, 1);
  }
  assert.deepEqual((await (await api.brandGameCatalog(new globalThis.Request(`${origin}/api/brand/games?q=secret`))).json()).games, []);
  assert.equal((await fixture({ expired: true }).api.brandGameCatalog(new globalThis.Request(`${origin}/api/brand/games`))).status, 401);
  assert.equal((await api.brandGameCatalog(new globalThis.Request(`${origin}/api/brand/games?lang=invalid`))).status, 400);
});

test("selected games save canonical localized names, free input creates a scoped game, and duplicates reuse it", async () => {
  const { api, store } = fixture({ games: [officialGame] });
  const result = await api.mutateBrandCampaign(request(input({ gameId: "game_nte", gameName: "spoofed title", gameLocale: "zh", action: "saveDraft" })));
  assert.equal(result.status, 200);
  const version = await result.json();
  let detail = await (await api.brandCampaignDetail(request(), version.id)).json();
  assert.equal(detail.campaign.brief.gameId, "game_nte");
  assert.equal(detail.campaign.brief.gameName, "异环");
  assert.equal(detail.campaign.gameIconUrl, "/demo/nte/game-icon.png");
  const update = input({ action: "saveDraft", id: version.id, expectedUpdatedAt: version.updatedAt, gameName: "새로운 게임", gameLocale: "ko" });
  const changed = await api.mutateBrandCampaign(request(update));
  assert.equal(changed.status, 200);
  const updated = await changed.json();
  detail = await (await api.brandCampaignDetail(request(), version.id)).json();
  assert.equal(store.games.length, 2);
  assert.equal(store.games[1].organizationId, "brand-own");
  assert.equal(store.games[1].verified, false);
  assert.equal(store.games[1].thumbnailUrl, "/games/placeholder.svg");
  assert.equal(store.games[1].localizations.length, 1);
  assert.equal(detail.campaign.brief.gameName, "새로운 게임");
  const repeat = await api.mutateBrandCampaign(request({ ...update, expectedUpdatedAt: updated.updatedAt }));
  assert.equal(repeat.status, 200);
  assert.equal(store.games.length, 2);
  const latest = await repeat.json();
  const missing = await api.mutateBrandCampaign(request({ ...update, expectedUpdatedAt: latest.updatedAt, gameId: "game-missing" }));
  assert.equal(missing.status, 400);
});

test("starting another request keeps previous unfinished work and permits deliberate recovery", () => {
  const draft = compile("lib/brand-request-draft.ts", {});
  const storage = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    get length() { return storage.size; }, key: index => [...storage.keys()][index] ?? null,
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  } });
  try {
    const first = { version: 1, savedAt: Date.now(), form: { ...input({ gameName: "이환" }), gameId: null, creatorCount: "3", applicationDate: "" }, step: 0, stage: 2, requestId: key, submitId: null, draft: null };
    draft.writeRequestDraft("org:user", "managed", first);
    assert.equal(draft.startNewRequestDraft("org:user", "managed"), true);
    assert.equal(draft.readRequestDraft("org:user", "managed"), null);
    assert.equal(draft.listRequestDrafts("org:user", "managed").length, 1);
    const second = { ...first, requestId: "3a957481-a381-49d9-b5a9-b9d41bf558d7", form: { ...first.form, title: "두번째 캠페인" } };
    draft.writeRequestDraft("org:user", "managed", second);
    assert.equal(draft.listRequestDrafts("org:user", "managed").length, 2);
    draft.writeRequestDraft("org:user", "managed", first);
    assert.equal(draft.readRequestDraft("org:user", "managed").form.title, first.form.title);
    assert.equal(draft.listRequestDrafts("org:user", "managed").length, 2);
    assert.equal(draft.listRequestDrafts("org:other-user", "managed").length, 0);
    const options = draft.requestDraftChoices([], draft.listRequestDrafts("org:user", "managed").map(snapshot => ({ storageRoute: "managed", snapshot })));
    assert.equal(options.length, 2);
    const server = { id: "server-draft", title: "서버 초안", updatedAt: new Date().toISOString(), status: "DRAFT", type: "MANAGED" };
    assert.equal(draft.requestDraftChoices([server], []).length, 1);
    assert.equal(draft.requestDraftChoices([{ ...server, status: "REVIEW" }], []).length, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else delete globalThis.localStorage;
  }
});

test("new request currencies follow language and draft links open the correct request route", () => {
  const draft = compile("lib/brand-request-draft.ts", {});
  assert.equal(draft.requestCurrencyForLocale("ko"), "KRW");
  assert.equal(draft.requestCurrencyForLocale("en"), "USD");
  assert.equal(draft.requestCurrencyForLocale("zh"), "CNY");
  assert.equal(draft.requestDraftPath({ id: "campaign-1", type: "MANAGED" }), "/advertiser/campaign/new?draft=campaign-1&route=managed");
  assert.equal(draft.requestDraftPath({ id: "campaign-2", type: "OPEN_BIDDING" }), "/advertiser/campaign/new?draft=campaign-2&route=open");
});
