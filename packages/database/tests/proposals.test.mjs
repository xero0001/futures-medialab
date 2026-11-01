import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  applyAdminProposalMutation,
  applyBrandProposalDecision,
  getBrandProposal,
  listBrandCampaignProposals,
  listAdminProposals,
  proposalPublicationProblems,
} from "../src/proposals.ts";
import {
  proposalAmount,
  proposalCents,
  publicChannelUrl,
} from "../src/proposal-validation.ts";

// Actual transaction-level services with isolated relational storage. No DB URL,
// network connection, live actor, or production data is used by this test suite.
const decimal = (value) =>
  value === null || value === undefined
    ? null
    : {
        toFixed: () =>
          String(
            value.includes?.(".")
              ? value.padEnd(value.indexOf(".") + 3, "0")
              : `${value}.00`,
          ),
      };
const expiry = () => new Date(Date.now() + 7 * 86400000).toISOString();
const scheduled = () => new Date(Date.now() + 30 * 86400000).toISOString();
const item = (changes = {}) => ({
  creatorId: "creator-own",
  creatorName: "공개 스냅샷 이름",
  platform: "youtube",
  channelLabel: "공개 채널",
  channelUrl: "https://www.youtube.com/@public-channel",
  followers: 10000,
  averageViews: 5000,
  deliverables: "영상 1편",
  quantity: 1,
  unitAmount: "100.10",
  scheduledAt: scheduled(),
  rights: "캠페인 기간 브랜드 채널 공유",
  supplierCost: "37.50",
  internalNotes: "PRIVATE_SUPPLIER_NOTES",
  ...changes,
});
const data = (changes = {}) => ({
  title: "공식 제안",
  summary: "확인된 제작 조건",
  changeSummary: "",
  terms: "조건 승인 후 별도 계약",
  expiresAt: expiry(),
  items: [
    item(),
    item({
      creatorId: null,
      creatorName: "수동 선정 크리에이터",
      channelUrl: "https://www.youtube.com/@manual-channel",
      unitAmount: "200.25",
    }),
  ],
  ...changes,
});
const op = (action, fields = {}) => ({
  action,
  campaignId: "campaign-own",
  clientRequestId: randomUUID(),
  ...fields,
});
const actor = { userId: "brand-owner", organizationId: "brand-own" };
function fixture() {
  let sequence = 0;
  const members = [
    {
      userId: "admin",
      organizationId: "platform",
      role: "ADMIN",
      organization: { type: "PLATFORM", status: "ACTIVE", metadata: {} },
    },
    {
      userId: "brand-owner",
      organizationId: "brand-own",
      role: "OWNER",
      organization: {
        type: "BRAND",
        status: "ACTIVE",
        metadata: { testWorkspaceAccess: true },
      },
    },
    {
      userId: "brand-member",
      organizationId: "brand-own",
      role: "MEMBER",
      organization: {
        type: "BRAND",
        status: "ACTIVE",
        metadata: { testWorkspaceAccess: true },
      },
    },
    {
      userId: "other-owner",
      organizationId: "other-brand",
      role: "OWNER",
      organization: {
        type: "BRAND",
        status: "ACTIVE",
        metadata: { testWorkspaceAccess: true },
      },
    },
  ];
  const store = {
    productionItems: [],
    proposals: [],
    items: [],
    decisions: [],
    mutations: [],
    audits: [],
    messages: [],
    campaign: {
      id: "campaign-own",
      title: "캠페인",
      brandOrganizationId: "brand-own",
      status: "REVIEW",
      type: "MANAGED",
      currency: "USD",
      budgetAmount: decimal("1000.00"),
      requirements: { brandIntake: { requestId: "intake-own" } },
      brandOrganization: {
        id: "brand-own",
        status: "ACTIVE",
        metadata: { testWorkspaceAccess: true },
      },
    },
    request: {
      id: "intake-own",
      campaignId: "campaign-own",
      organizationId: "brand-own",
      status: "REQUESTED",
      version: 0,
      dueAt: new Date(Date.now() + 48 * 3600000),
    },
    creator: {
      id: "creator-own",
      displayName: "원본 변경 가능",
      agencyOrganizationId: "PRIVATE_SUPPLIER_ID",
      isActive: true,
      agencyOrganization: { name: "PRIVATE_SUPPLIER_NAME" },
      channels: [
        { platform: "youtube", url: "https://www.youtube.com/@original" },
      ],
    },
  };
  Object.defineProperty(store.campaign, "proposals", {
    enumerable: true,
    get: () =>
      store.proposals
        .filter((p) => p.publishedAt)
        .sort((a, b) => b.version - a.version)
        .slice(0, 1)
        .map((p) => ({ id: p.id })),
  });
  const match = (value, condition) => {
    if (condition === undefined) return true;
    if (
      condition === null ||
      typeof condition !== "object" ||
      condition instanceof Date
    )
      return value === condition;
    if ("in" in condition && !condition.in.includes(value)) return false;
    if ("not" in condition && value === condition.not) return false;
    if ("gt" in condition && !(value > condition.gt)) return false;
    return true;
  };
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      key === "campaign"
        ? Object.entries(value).every(([k, v]) => match(store.campaign[k], v))
        : match(row[key], value),
    );
  const shape = (row) =>
    row && {
      ...row,
      campaign: {
        ...store.campaign,
        brandOrganization: { ...store.campaign.brandOrganization },
      },
      items: store.items
        .filter((i) => i.proposalId === row.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ ...i })),
      decisions: store.decisions
        .filter((d) => d.proposalId === row.id)
        .map((d) => ({ ...d })),
    };
  function update(row, values) {
    for (const [key, value] of Object.entries(values))
      row[key] =
        value && typeof value === "object" && "increment" in value
          ? row[key] + value.increment
          : value;
    row.updatedAt = new Date();
  }
  function addItem(values) {
    const row = {
      id: `item-${++sequence}`,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...values,
    };
    row.unitAmount = decimal(values.unitAmount);
    row.supplierCost = decimal(values.supplierCost);
    store.items.push(row);
    return row;
  }
  const tx = {
    organizationMember: {
      findFirst: async ({ where }) =>
        members.find(
          (m) =>
            m.userId === where.userId &&
            (!where.organizationId ||
              m.organizationId === where.organizationId) &&
            (!where.role?.in || where.role.in.includes(m.role)) &&
            (!where.organization?.type ||
              m.organization.type === where.organization.type) &&
            (!where.organization?.status ||
              m.organization.status === where.organization.status),
        ) ?? null,
    },
    campaign: {
      findUnique: async ({ where }) =>
        where.id === store.campaign.id ? store.campaign : null,
      findFirst: async ({ where }) =>
        where.id === store.campaign.id &&
        (!where.brandOrganizationId ||
          where.brandOrganizationId === store.campaign.brandOrganizationId)
          ? store.campaign
          : null,
      update: async ({ where, data }) => {
        assert.equal(where.id, store.campaign.id);
        update(store.campaign, data);
        return store.campaign;
      },
    },
    campaignProposal: {
      findFirst: async ({ where, orderBy }) => {
        let rows = store.proposals.filter((p) => matches(p, where));
        if (orderBy?.version === "desc")
          rows = rows.sort((a, b) => b.version - a.version);
        return shape(rows[0] ?? null);
      },
      findMany: async ({ where }) =>
        store.proposals
          .filter((p) => matches(p, where))
          .sort((a, b) => b.version - a.version)
          .map(shape),
      create: async ({ data }) => {
        const { items, ...values } = data;
        const row = {
          id: `proposal-${++sequence}`,
          revision: 0,
          status: "DRAFT",
          publishedAt: null,
          supersededAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...values,
        };
        store.proposals.push(row);
        for (const i of items?.create ?? [])
          addItem({
            ...i,
            unitAmount: i.unitAmount?.toFixed?.(2) ?? i.unitAmount,
            supplierCost: i.supplierCost?.toFixed?.(2) ?? i.supplierCost,
            proposalId: row.id,
          });
        return shape(row);
      },
      updateMany: async ({ where, data }) => {
        const rows = store.proposals.filter((p) => matches(p, where));
        rows.forEach((p) => update(p, data));
        return { count: rows.length };
      },
    },
    productionItem: {
      create: async ({ data }) => {
        const row = { id: `production-${++sequence}`, ...data };
        store.productionItems.push(row);
        return row;
      },
    },
    proposalItem: {
      findMany: async ({ where }) =>
        store.items
          .filter(
            (i) =>
              i.status === where.status &&
              store.proposals.some(
                (p) => p.id === i.proposalId && matches(p, where.proposal),
              ),
          )
          .map((i) => ({
            ...i,
            productionItem:
              store.productionItems.find((p) => p.proposalItemId === i.id) ??
              null,
            supplierOrganization: null,
          })),
      deleteMany: async ({ where }) => {
        store.items = store.items.filter(
          (i) => i.proposalId !== where.proposalId,
        );
      },
      createMany: async ({ data }) => {
        data.forEach(addItem);
        return { count: data.length };
      },
      updateMany: async ({ where, data }) => {
        const rows = store.items.filter((i) => matches(i, where));
        rows.forEach((i) => update(i, data));
        return { count: rows.length };
      },
    },
    proposalDecision: {
      create: async ({ data }) => {
        const row = {
          id: `decision-${++sequence}`,
          createdAt: new Date(),
          ...data,
        };
        store.decisions.push(row);
        return row;
      },
    },
    proposalMutation: {
      findUnique: async ({ where }) =>
        store.mutations.find(
          (m) =>
            m.actorId === where.actorId_clientRequestId.actorId &&
            m.clientRequestId === where.actorId_clientRequestId.clientRequestId,
        ) ?? null,
      create: async ({ data }) => {
        store.mutations.push(data);
        return data;
      },
    },
    creatorProfile: {
      findFirst: async ({ where }) => {
        assert.equal(
          where.applications.some.application.campaignId,
          "campaign-own",
        );
        return where.id === store.creator.id && store.creator.isActive
          ? store.creator
          : null;
      },
      findMany: async ({ where }) => {
        assert.equal(
          where.applications.some.application.campaignId,
          "campaign-own",
        );
        return [store.creator];
      },
    },
    workspaceToolRequest: {
      findFirst: async ({ where }) =>
        matches(store.request, where) ? { ...store.request } : null,
      updateMany: async ({ where, data }) => {
        if (!matches(store.request, where)) return { count: 0 };
        update(store.request, data);
        return { count: 1 };
      },
    },
    requestMessage: {
      create: async ({ data }) => {
        store.messages.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        store.audits.push(data);
        return data;
      },
    },
    settlement: new Proxy(
      {},
      {
        get() {
          throw new Error("Approvals must never execute payment");
        },
      },
    ),
    campaignContract: new Proxy(
      {},
      {
        get() {
          throw new Error("Approvals must never execute a contract");
        },
      },
    ),
  };
  const admin = (input) => applyAdminProposalMutation(tx, "admin", input);
  const decide = (input) => applyBrandProposalDecision(tx, actor, input);
  async function prepared(input = data()) {
    const draft = await admin(op("createDraft"));
    return (
      await admin(
        op("saveDraft", {
          proposalId: draft.proposal.id,
          expectedRevision: draft.proposal.revision,
          data: input,
        }),
      )
    ).proposal;
  }
  async function published(input = data()) {
    const draft = await prepared(input);
    return (
      await admin(
        op("publish", {
          proposalId: draft.id,
          expectedRevision: draft.revision,
        }),
      )
    ).proposal;
  }
  return { tx, store, members, admin, decide, prepared, published };
}
const decision = (
  proposal,
  kind = "APPROVE",
  ids = proposal.items.map((i) => i.id),
  message = "",
) => ({
  action: "decide",
  proposalId: proposal.id,
  expectedRevision: proposal.revision,
  clientRequestId: randomUUID(),
  decision: kind,
  itemIds: ids,
  message,
});
const statusError = (status, code) => (error) =>
  error.status === status && (!code || error.code === code);

test("exact monetary totals and channel URL allowlist reject unsafe or contact URLs", () => {
  assert.equal(
    proposalAmount(proposalCents("100.10") * 3n + proposalCents("0.05")),
    "300.35",
  );
  assert.equal(
    publicChannelUrl("https://www.youtube.com/@creator", "youtube"),
    "https://www.youtube.com/@creator",
  );
  for (const url of [
    "https://attacker.example/@creator",
    "javascript:alert(1)",
    "https://user:pass@youtube.com/@creator",
    "https://youtube.com/",
    "https://youtube.com/@creator?email=private@example.com",
  ])
    assert.equal(publicChannelUrl(url, "youtube"), null);
});

test("unpublished data is invisible; publication freezes snapshots and public DTO omits all private fields", async () => {
  const f = fixture(),
    draft = await f.prepared();
  assert.deepEqual(
    await listBrandCampaignProposals(f.tx, "brand-own", "campaign-own", true),
    [],
  );
  await assert.rejects(
    () => getBrandProposal(f.tx, "brand-own", draft.id, true),
    statusError(404),
  );
  const result = await f.admin(
    op("publish", { proposalId: draft.id, expectedRevision: draft.revision }),
  );
  const visible = await getBrandProposal(f.tx, "brand-own", draft.id, true);
  assert.equal(visible.totalAmount, "300.35");
  assert.equal(visible.canRespond, true);
  assert.equal(f.store.request.status, "WAITING_BRAND");
  assert.equal(f.store.request.dueAt, null);
  f.store.creator.displayName = "원본 변경됨";
  assert.equal(
    (await getBrandProposal(f.tx, "brand-own", draft.id, true)).items[0]
      .creatorName,
    "공개 스냅샷 이름",
  );
  for (const needle of [
    "creatorId",
    "supplierOrganizationId",
    "supplierCost",
    "internalNotes",
    "PRIVATE_SUPPLIER",
    "37.50",
  ])
    assert.ok(!JSON.stringify(visible).includes(needle), needle);
  assert.ok(result.proposal.items[0].supplierCost === "37.50");
  assert.ok(
    f.store.audits.some((a) => a.action === "admin.proposal.published"),
  );
  await assert.rejects(
    () =>
      f.admin(
        op("saveDraft", {
          proposalId: draft.id,
          expectedRevision: result.proposal.revision,
          data: data(),
        }),
      ),
    statusError(409, "STALE_PROPOSAL"),
  );
});

test("same request is idempotent, stale and altered request keys cannot mutate a draft", async () => {
  const f = fixture(),
    create = op("createDraft");
  const a = await f.admin(create),
    b = await f.admin(create);
  assert.equal(a.proposal.id, b.proposal.id);
  assert.equal(f.store.proposals.length, 1);
  const save = op("saveDraft", {
    proposalId: a.proposal.id,
    expectedRevision: 0,
    data: data(),
  });
  const first = await f.admin(save),
    retry = await f.admin(save);
  assert.equal(retry.proposal.revision, first.proposal.revision);
  assert.equal(f.store.items.length, 2);
  await assert.rejects(
    () => f.admin({ ...save, data: data({ title: "다른 내용" }) }),
    statusError(409, "DUPLICATE_REQUEST"),
  );
  await assert.rejects(
    () => f.admin({ ...save, clientRequestId: randomUUID() }),
    statusError(409, "STALE_PROPOSAL"),
  );
});

test("a private replacement draft does not conceal current published proposal; publishing replacement disables old decisions", async () => {
  const f = fixture(),
    old = await f.published();
  const next = await f.admin(op("createDraft", { sourceProposalId: old.id }));
  assert.equal(next.proposal.version, 2);
  assert.equal(
    (await listBrandCampaignProposals(f.tx, "brand-own", "campaign-own", true))
      .length,
    1,
  );
  assert.equal(
    (await getBrandProposal(f.tx, "brand-own", old.id, true)).canRespond,
    true,
  );
  const saved = await f.admin(
    op("saveDraft", {
      proposalId: next.proposal.id,
      expectedRevision: 0,
      data: data({ changeSummary: "일정 변경" }),
    }),
  );
  await f.admin(
    op("publish", {
      proposalId: next.proposal.id,
      expectedRevision: saved.proposal.revision,
    }),
  );
  const history = await listBrandCampaignProposals(
    f.tx,
    "brand-own",
    "campaign-own",
    true,
  );
  assert.equal(history.length, 2);
  assert.equal(history[0].isLatest, true);
  assert.equal(history[1].status, "SUPERSEDED");
  assert.equal(history[1].canRespond, false);
  await assert.rejects(
    () => f.decide(decision(old)),
    statusError(409, "PROPOSAL_NOT_ACTIONABLE"),
  );
});

test("cross-organization, MEMBER, revoked approval and invalid selection never decide a proposal", async () => {
  const f = fixture(),
    proposal = await f.published();
  await assert.rejects(
    () => getBrandProposal(f.tx, "other-brand", proposal.id, true),
    statusError(404),
  );
  await assert.rejects(
    () =>
      applyBrandProposalDecision(
        f.tx,
        { userId: "other-owner", organizationId: "other-brand" },
        decision(proposal),
      ),
    statusError(404),
  );
  await assert.rejects(
    () =>
      applyBrandProposalDecision(
        f.tx,
        { userId: "brand-member", organizationId: "brand-own" },
        decision(proposal),
      ),
    statusError(403),
  );
  assert.equal(
    (await getBrandProposal(f.tx, "brand-own", proposal.id, false)).canRespond,
    false,
  );
  await assert.rejects(
    () => f.decide(decision(proposal, "APPROVE", ["foreign-item"])),
    statusError(409, "INVALID_ITEMS"),
  );
  await assert.rejects(
    () => f.decide({ ...decision(proposal), expectedRevision: 0 }),
    statusError(409, "STALE_PROPOSAL"),
  );
  f.members.find((m) => m.userId === "brand-owner").organization.status =
    "PENDING";
  await assert.rejects(() => f.decide(decision(proposal)), statusError(403));
  assert.equal(f.store.decisions.length, 0);
});

test("partial and all-item approval persist decisions, only full approval advances campaign, retries do not duplicate", async () => {
  const f = fixture(),
    proposal = await f.published();
  const firstInput = decision(proposal, "APPROVE", [proposal.items[0].id]);
  const first = (await f.decide(firstInput)).proposal;
  assert.equal(first.status, "PUBLISHED");
  assert.equal(f.store.campaign.status, "REVIEW");
  assert.equal(first.canRespond, true);
  assert.equal((await f.decide(firstInput)).proposal.revision, first.revision);
  assert.equal(f.store.decisions.length, 1);
  const final = (
    await f.decide(decision(first, "APPROVE", [proposal.items[1].id]))
  ).proposal;
  assert.equal(final.status, "APPROVED");
  assert.equal(final.canRespond, false);
  assert.equal(f.store.campaign.status, "IN_PROGRESS");
  assert.equal(
    f.store.productionItems.length,
    2,
    "Full proposal approval creates one production item per approved item",
  );
  assert.equal(f.store.request.status, "RESOLVED");
  assert.equal(f.store.decisions.length, 2);
});

test("change request followed by remaining item approval stays with operations, preserving reason and no duplicate decisions", async () => {
  const f = fixture(),
    proposal = await f.published();
  const changed = (
    await f.decide(
      decision(
        proposal,
        "REQUEST_CHANGES",
        [proposal.items[0].id],
        "영상 길이와 게시 일정 보완",
      ),
    )
  ).proposal;
  assert.equal(changed.status, "CHANGES_REQUESTED");
  assert.equal(changed.canRespond, true);
  const final = (
    await f.decide(decision(changed, "APPROVE", [proposal.items[1].id]))
  ).proposal;
  assert.equal(final.status, "CHANGES_REQUESTED");
  assert.equal(final.canRespond, false);
  assert.equal(f.store.request.status, "IN_PROGRESS");
  assert.equal(f.store.campaign.status, "REVIEW");
  assert.ok(
    f.store.messages.some((m) => m.body.includes("영상 길이와 게시 일정 보완")),
  );
  assert.equal(final.decisions[0].message, "영상 길이와 게시 일정 보완");
  await assert.rejects(
    () => f.decide(decision(final, "APPROVE", [proposal.items[0].id])),
    statusError(409),
  );
});

test("expired and canceled proposals remain readable but reject approval; private creator association is checked", async () => {
  const f = fixture(),
    proposal = await f.published();
  const stored = f.store.proposals[0];
  stored.expiresAt = new Date(Date.now() - 1000);
  assert.equal(
    (await getBrandProposal(f.tx, "brand-own", proposal.id, true)).canRespond,
    false,
  );
  await assert.rejects(() => f.decide(decision(proposal)), statusError(409));
  stored.expiresAt = new Date(expiry());
  f.store.campaign.status = "CANCELED";
  await assert.rejects(() => f.decide(decision(proposal)), statusError(409));
  const g = fixture(),
    draft = await g.admin(op("createDraft"));
  await assert.rejects(
    () =>
      g.admin(
        op("saveDraft", {
          proposalId: draft.proposal.id,
          expectedRevision: 0,
          data: data({ items: [item({ creatorId: "foreign-creator" })] }),
        }),
      ),
    statusError(409, "CREATOR_NOT_SHORTLISTED"),
  );
});

test("publication checks price, expiration, schedule and exact trusted demo-channel exception", async () => {
  for (const incomplete of [
    data({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    data({
      items: [
        item({ scheduledAt: new Date(Date.now() + 86400000).toISOString() }),
      ],
    }),
    data({ items: [item({ rights: "" })] }),
  ]) {
    const sample = fixture();
    const invalid = await sample.prepared(incomplete);
    assert.equal(invalid.canPublish, false);
  }
  const f = fixture(),
    draft = await f.prepared(
      data({ items: [item({ unitAmount: "1001.00" })] }),
    );
  assert.equal(draft.canPublish, false);
  await assert.rejects(
    () =>
      f.admin(
        op("publish", {
          proposalId: draft.id,
          expectedRevision: draft.revision,
        }),
      ),
    statusError(409, "PUBLICATION_REQUIREMENTS"),
  );
  const g = fixture();
  g.store.campaign.requirements.demo = true;
  g.store.campaign.requirements.seed = "official-proposals-nte-v1";
  const demo = await g.prepared(
    data({
      items: [item({ channelUrl: "https://example.invalid/nte-demo/raon" })],
    }),
  );
  assert.equal(demo.canPublish, true);
  g.store.campaign.brandOrganization.metadata.testWorkspaceAccess = false;
  const adminView = await listAdminProposals(g.tx, "admin", "campaign-own");
  assert.equal(adminView.proposals[0].canPublish, false);
  const row = {
    ...g.store.proposals[0],
    campaign: g.store.campaign,
    items: g.store.items,
    decisions: [],
  };
  assert.ok(proposalPublicationProblems(row).some((p) => p.includes("HTTPS")));
});
