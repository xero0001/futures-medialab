import { randomUUID } from "node:crypto";
import {
  applyAdminProductionMutation,
  applyAgencyProductionMutation,
  applyBrandProductionMutation,
  ensureCampaignProductionItems,
  listAgencyProduction,
  listBrandProductionItems,
} from "../../src/production.ts";
export const brand = { userId: "brand-owner", organizationId: "brand-own" };
export const agency = { userId: "agency-owner", organizationId: "agency-own" };
// Isolated relational fixture for real service transitions, never a live DB connection.
export function fixture() {
  let sequence = 0;
  const orgs = [
    {
      id: "brand-own",
      name: "브랜드",
      type: "BRAND",
      status: "ACTIVE",
      metadata: { testWorkspaceAccess: true },
    },
    {
      id: "brand-other",
      name: "다른브랜드",
      type: "BRAND",
      status: "ACTIVE",
      metadata: { testWorkspaceAccess: true },
    },
    {
      id: "agency-own",
      name: "PRIVATE_SUPPLIER_NAME",
      type: "AGENCY",
      status: "ACTIVE",
      metadata: { testWorkspaceAccess: true },
    },
    {
      id: "agency-other",
      name: "타에이전시",
      type: "AGENCY",
      status: "ACTIVE",
      metadata: { testWorkspaceAccess: true },
    },
    {
      id: "platform",
      name: "운영팀",
      type: "PLATFORM",
      status: "ACTIVE",
      metadata: {},
    },
  ];
  const members = [
    { userId: "admin", organizationId: "platform", role: "ADMIN" },
    { userId: "brand-owner", organizationId: "brand-own", role: "OWNER" },
    { userId: "brand-member", organizationId: "brand-own", role: "MEMBER" },
    { userId: "other-brand", organizationId: "brand-other", role: "OWNER" },
    { userId: "agency-owner", organizationId: "agency-own", role: "OWNER" },
    { userId: "agency-member", organizationId: "agency-own", role: "MEMBER" },
    { userId: "other-agency", organizationId: "agency-other", role: "OWNER" },
  ];
  const campaign = {
    id: "campaign-own",
    title: "이환 제작 시연",
    status: "IN_PROGRESS",
    brandOrganizationId: "brand-own",
    coverImageUrl: "/demo/nte/city-key-art.jpg",
    requirements: {
      demo: true,
      seed: "official-proposals-nte-v1",
      game: {
        name: "이환",
        iconUrl: "/demo/nte/game-icon.png",
        sourceUrl: "https://nte.perfectworld.com/kr/",
      },
    },
  };
  const proposals = [
    {
      id: "proposal-own",
      campaignId: campaign.id,
      version: 1,
      status: "APPROVED",
      publishedAt: new Date(),
      supersededAt: null,
    },
  ];
  const proposalItems = [
    {
      id: "approved-item",
      proposalId: "proposal-own",
      status: "APPROVED",
      position: 0,
      creatorName: "공개 이름",
      platform: "youtube",
      deliverables: "쇼츠 1편",
      quantity: 1,
      scheduledAt: new Date(),
      rights: "공식 채널 공유",
      supplierOrganizationId: "agency-own",
      creatorId: "PRIVATE_CREATOR_ID",
      supplierCost: "123.45",
      internalNotes: "PRIVATE_SUPPLIER_NOTES",
    },
  ];
  const store = {
    orgs,
    members,
    campaign,
    proposals,
    proposalItems,
    reportItems: [],
    reportSubmissions: [],
    reportMutations: [],
    items: [],
    submissions: [],
    mutations: [],
    audits: [],
  };
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      const actual = row?.[key];
      if (
        expected === null ||
        typeof expected !== "object" ||
        expected instanceof Date
      )
        return actual === expected;
      if ("in" in expected) return expected.in.includes(actual);
      if ("not" in expected) return actual !== expected.not;
      if ("gt" in expected) return actual > expected.gt;
      return matches(actual, expected);
    });
  function select(row, query = {}) {
    if (!row) return null;
    if (!query.select) return { ...row };
    return Object.fromEntries(
      Object.entries(query.select)
        .filter(([, v]) => v)
        .map(([key, condition]) => {
          let value = row[key];
          if (condition !== true) {
            if (Array.isArray(value)) {
              value = value
                .filter((v) => matches(v, condition.where))
                .map((v) => select(v, condition));
              if (condition.orderBy?.version === "desc")
                value.sort((a, b) => b.version - a.version);
              if (condition.take) value = value.slice(0, condition.take);
            } else value = select(value, condition);
          }
          return [key, value];
        }),
    );
  }
  const campaignRow = () => ({
    ...campaign,
    brandOrganization: orgs.find((o) => o.id === campaign.brandOrganizationId),
    proposals: proposals
      .filter((p) => p.publishedAt)
      .sort((a, b) => b.version - a.version)
      .slice(0, 1),
  });
  const proposalItemRow = (item) => ({
    ...item,
    proposal: proposals.find((p) => p.id === item.proposalId),
    productionItem:
      store.items.find((i) => i.proposalItemId === item.id) ?? null,
    supplierOrganization:
      orgs.find((o) => o.id === item.supplierOrganizationId) ?? null,
  });
  const itemRow = (item) => ({
    ...item,
    reportingItem:
      store.reportItems.find((r) => r.productionItemId === item.id) ?? null,
    campaign: campaignRow(),
    proposalItem: proposalItemRow(
      proposalItems.find((i) => i.id === item.proposalItemId),
    ),
    supplierOrganization:
      orgs.find((o) => o.id === item.supplierOrganizationId) ?? null,
    submissions: store.submissions
      .filter((s) => s.productionItemId === item.id)
      .sort((a, b) => b.version - a.version),
  });
  const reportRow = (row) => ({
    ...row,
    campaign: campaignRow(),
    productionItem: itemRow(
      store.items.find((i) => i.id === row.productionItemId),
    ),
    submissions: store.reportSubmissions
      .filter((s) => s.reportingItemId === row.id)
      .sort((a, b) => b.version - a.version),
  });
  function update(row, values) {
    for (const [key, value] of Object.entries(values))
      row[key] =
        value && typeof value === "object" && "increment" in value
          ? row[key] + value.increment
          : value;
  }
  function find(rows, query) {
    return select(
      rows.find((row) => matches(row, query.where)),
      query,
    );
  }
  function findMany(rows, query) {
    return rows
      .filter((row) => matches(row, query.where))
      .map((row) => select(row, query));
  }
  const tx = {
    organizationMember: {
      findFirst: async (query) =>
        find(
          members.map((m) => ({
            ...m,
            organization: orgs.find((o) => o.id === m.organizationId),
          })),
          query,
        ),
    },
    organization: {
      findFirst: async (query) => find(orgs, query),
      findMany: async (query) => findMany(orgs, query),
    },
    campaign: { findFirst: async (query) => find([campaignRow()], query) },
    proposalItem: {
      findMany: async (query) =>
        findMany(proposalItems.map(proposalItemRow), query),
    },
    productionItem: {
      findFirst: async (query) => find(store.items.map(itemRow), query),
      findMany: async (query) => findMany(store.items.map(itemRow), query),
      create: async ({ data, select: fields }) => {
        const row = {
          id: `production-${++sequence}`,
          status: "AWAITING_SUBMISSION",
          revision: 0,
          supplierOrganizationId: null,
          ...data,
        };
        store.items.push(row);
        return select(row, { select: fields });
      },
      updateMany: async ({ where, data }) => {
        const rows = store.items.filter((row) => matches(row, where));
        rows.forEach((row) => update(row, data));
        return { count: rows.length };
      },
    },
    productionSubmission: {
      create: async ({ data }) => {
        const row = {
          id: `submission-${++sequence}`,
          status: "ADMIN_REVIEW",
          submittedAt: new Date(),
          adminReviewedAt: null,
          agencyFeedback: "",
          internalNote: "",
          releasedTitle: null,
          releasedUrl: null,
          releasedNote: null,
          releasedAt: null,
          brandDecision: null,
          brandMessage: "",
          brandDecidedAt: null,
          ...data,
        };
        store.submissions.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const rows = store.submissions.filter((row) => matches(row, where));
        rows.forEach((row) => update(row, data));
        return { count: rows.length };
      },
    },
    productionMutation: {
      findUnique: async ({ where }) =>
        store.mutations.find((row) =>
          matches(row, where.actorId_clientRequestId),
        ) ?? null,
      create: async ({ data }) => {
        store.mutations.push({ ...data });
        return data;
      },
    },
    reportingItem: {
      findFirst: async (query) => find(store.reportItems.map(reportRow), query),
      findMany: async (query) =>
        findMany(store.reportItems.map(reportRow), query),
      create: async ({ data, select: fields }) => {
        const row = {
          id: `report-${++sequence}`,
          status: "AWAITING_SUBMISSION",
          revision: 0,
          ...data,
        };
        store.reportItems.push(row);
        return select(row, { select: fields });
      },
      updateMany: async ({ where, data }) => {
        const rows = store.reportItems.filter((row) => matches(row, where));
        rows.forEach((row) => update(row, data));
        return { count: rows.length };
      },
    },
    reportingSubmission: {
      create: async ({ data }) => {
        const row = {
          id: `report-submission-${++sequence}`,
          status: "ADMIN_REVIEW",
          submittedAt: new Date(),
          adminReviewedAt: null,
          agencyFeedback: "",
          internalNote: "",
          releasedTitle: null,
          releasedPostUrl: null,
          releasedPublishedAt: null,
          releasedMetricsAsOf: null,
          releasedMetrics: null,
          releasedEvidenceUrl: null,
          releasedNote: null,
          releasedAt: null,
          ...data,
        };
        store.reportSubmissions.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const rows = store.reportSubmissions.filter((row) =>
          matches(row, where),
        );
        rows.forEach((row) => update(row, data));
        return { count: rows.length };
      },
    },
    reportingMutation: {
      findUnique: async ({ where }) =>
        store.reportMutations.find((row) =>
          matches(row, where.actorId_clientRequestId),
        ) ?? null,
      create: async ({ data }) => {
        store.reportMutations.push({ ...data });
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
          throw new Error("Review must never execute payment");
        },
      },
    ),
  };
  const admin = (input) => applyAdminProductionMutation(tx, "admin", input);
  const submit = (input) => applyAgencyProductionMutation(tx, agency, input);
  const decide = (input) => applyBrandProductionMutation(tx, brand, input);
  const read = () =>
    listBrandProductionItems(tx, "brand-own", campaign.id, true);
  async function prepare() {
    await ensureCampaignProductionItems(tx, campaign.id, "admin");
    return (await listAgencyProduction(tx, agency)).items[0];
  }
  const adminAction = (action, item, extra = {}) => ({
    action,
    campaignId: campaign.id,
    productionItemId: item.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    ...extra,
  });
  const submission = (item, extra = {}) => ({
    action: "submit",
    productionItemId: item.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    title: "PRIVATE_RAW_TITLE",
    url: "https://drive.google.com/file/d/private-source",
    note: "PRIVATE_RAW_NOTE",
    ...extra,
  });
  const release = (item, extra = {}) =>
    adminAction("releaseToBrand", item, {
      submissionId: item.latestSubmission.id,
      title: "검수 요청 영상",
      url: "https://www.youtube.com/watch?v=public-preview",
      note: "브랜드 공개 설명",
      internalNote: "PRIVATE_INTERNAL_NOTE",
      ...extra,
    });
  const decision = (item, action = "approve", extra = {}) => ({
    action,
    productionItemId: item.id,
    submissionId: item.latestSubmission.id,
    expectedRevision: item.revision,
    clientRequestId: randomUUID(),
    message: action === "requestChanges" ? "첫 장면 문구를 바꿔 주세요." : "",
    ...extra,
  });
  return {
    tx,
    store,
    admin,
    submit,
    decide,
    read,
    prepare,
    adminAction,
    submission,
    release,
    decision,
    queryHelpers: { matches, select, find, findMany, update },
  };
}
