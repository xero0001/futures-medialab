import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  applyAdminProductionMutation,
  applyAgencyProductionMutation,
  applyBrandProductionMutation,
  ensureCampaignProductionItems,
  listAdminProduction,
  listAgencyProduction,
  listBrandProductionItems,
} from "../src/production.ts";
import {
  productionPublicUrl,
  agencyProductionMutationSchema,
} from "../src/production-validation.ts";
import { readProductionBody } from "../src/production-http.ts";

const brand = { userId: "brand-owner", organizationId: "brand-own" };
const agency = { userId: "agency-owner", organizationId: "agency-own" };
const fail = (status, code) => (error) =>
  error.status === status && (!code || error.code === code);
function fixture() {
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
  };
}

test("only current approved official items become production assignments, idempotently; manual item remains explicitly unassigned", async () => {
  const f = fixture();
  f.store.proposalItems.push({
    ...f.store.proposalItems[0],
    id: "manual",
    supplierOrganizationId: null,
  });
  f.store.proposalItems.push({
    ...f.store.proposalItems[0],
    id: "not-approved",
    status: "PENDING",
  });
  assert.equal(
    await ensureCampaignProductionItems(f.tx, "campaign-own", "admin"),
    2,
  );
  assert.equal(
    await ensureCampaignProductionItems(f.tx, "campaign-own", "admin"),
    0,
  );
  assert.equal(
    f.store.items.find((i) => i.proposalItemId === "manual")
      .supplierOrganizationId,
    null,
  );
  const admin = await listAdminProduction(f.tx, "admin", "campaign-own");
  assert.equal(admin.eligibleApprovedItemCount, 2);
  assert.equal(admin.unpreparedApprovedItemCount, 0);
  f.store.proposalItems.push({
    ...f.store.proposalItems[0],
    id: "backfill-approved",
  });
  assert.equal(
    (await listAdminProduction(f.tx, "admin", "campaign-own"))
      .unpreparedApprovedItemCount,
    1,
  );
  assert.equal(
    admin.items.find((i) => i.proposalItemId === "manual").canAssign,
    true,
  );
  assert.equal((await listAgencyProduction(f.tx, agency)).items.length, 1);
  assert.equal(f.store.audits.length, 2);
});

test("raw source is invisible until admin release; public snapshot never includes source or private provenance", async () => {
  const f = fixture(),
    initial = await f.prepare();
  const submitted = (await f.submit(f.submission(initial))).item;
  const before = (await f.read())[0];
  assert.equal(before.status, "ADMIN_REVIEW");
  assert.equal(before.latestSubmission, null);
  assert.deepEqual(before.submissions, []);
  const rawId = submitted.latestSubmission.id;
  await assert.rejects(
    () =>
      f.decide({
        action: "approve",
        productionItemId: submitted.id,
        submissionId: rawId,
        expectedRevision: submitted.revision,
        clientRequestId: randomUUID(),
        message: "",
      }),
    fail(409),
  );
  const released = (await f.admin(f.release(submitted))).items[0];
  assert.equal(released.latestSubmission.title, "PRIVATE_RAW_TITLE");
  const publicItem = (await f.read())[0];
  assert.equal(publicItem.latestSubmission.title, "검수 요청 영상");
  assert.equal(publicItem.canRespond, true);
  assert.equal(publicItem.coverImageUrl, "/demo/nte/city-key-art.jpg");
  assert.equal(publicItem.gameSourceUrl, "https://nte.perfectworld.com/kr/");
  for (const needle of [
    "PRIVATE_",
    "sourceUrl",
    "sourceTitle",
    "supplierOrganizationId",
    "supplierCost",
    "creatorId",
    "internalNote",
    "agencyFeedback",
    "drive.google.com",
  ])
    assert.ok(!JSON.stringify(publicItem).includes(needle), needle);
  assert.ok(
    !JSON.stringify((await listAgencyProduction(f.tx, agency)).items).includes(
      "PRIVATE_INTERNAL_NOTE",
    ),
  );
  assert.ok(!JSON.stringify(f.store.audits).includes("PRIVATE_RAW"));
  const original = { ...f.store.submissions[0] };
  await assert.rejects(() => f.admin(f.release(released)), fail(409));
  assert.deepEqual(f.store.submissions[0], original);
});

test("agency and brand corrections create fresh versions, each rereleased by admin; old public snapshot stays frozen", async () => {
  const f = fixture();
  let item = await f.prepare();
  item = (await f.submit(f.submission(item))).item;
  const adminReturned = await f.admin(
    f.adminAction("requestChanges", item, {
      submissionId: item.latestSubmission.id,
      agencyFeedback: "민감한 정보를 삭제해 주세요.",
      internalNote: "PRIVATE_REVIEW_REASON",
    }),
  );
  item = adminReturned.items[0];
  assert.equal(item.status, "AGENCY_REVISION");
  assert.equal((await f.read())[0].submissions.length, 0);
  item = (await f.submit(f.submission(item, { title: "PRIVATE_V2" }))).item;
  item = (await f.admin(f.release(item))).items[0];
  let publicItem = (await f.read())[0];
  const oldPublic = { ...publicItem.latestSubmission };
  publicItem = (await f.decide(f.decision(publicItem, "requestChanges"))).item;
  assert.equal(publicItem.status, "BRAND_REVISION");
  item = (await listAgencyProduction(f.tx, agency)).items[0];
  assert.equal(
    item.latestSubmission.brandMessage,
    "첫 장면 문구를 바꿔 주세요.",
  );
  item = (
    await f.submit(
      f.submission(item, { title: "PRIVATE_V3", note: "PRIVATE_NEW_NOTE" }),
    )
  ).item;
  publicItem = (await f.read())[0];
  assert.equal(publicItem.submissions.length, 1);
  assert.equal(publicItem.canRespond, false);
  assert.equal(publicItem.latestSubmission.isLatest, false);
  assert.ok(!JSON.stringify(publicItem).includes(item.latestSubmission.id));
  item = (
    await f.admin(
      f.release(item, { title: "수정 검수본", note: "요청한 문구 수정" }),
    )
  ).items[0];
  publicItem = (await f.read())[0];
  assert.equal(publicItem.submissions.length, 2);
  await assert.rejects(
    () =>
      f.decide(
        f.decision(publicItem, "approve", { submissionId: oldPublic.id }),
      ),
    fail(409),
  );
  const approved = (await f.decide(f.decision(publicItem))).item;
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.canRespond, false);
  assert.equal(approved.submissions[1].title, oldPublic.title);
  assert.equal(approved.submissions[1].url, oldPublic.url);
  assert.equal(f.store.submissions.length, 3);
  assert.equal(f.store.submissions[0].sourceTitle, "PRIVATE_RAW_TITLE");
  assert.equal(f.store.campaign.status, "IN_PROGRESS");
});

test("tenant scope and active memberships are checked on every decision and submission; MEMBER is read only", async () => {
  const f = fixture();
  let item = await f.prepare();
  assert.equal(
    (await listAgencyProduction(f.tx, { ...agency, userId: "agency-member" }))
      .items[0].canSubmit,
    false,
  );
  await assert.rejects(
    () =>
      applyAgencyProductionMutation(
        f.tx,
        { ...agency, userId: "agency-member" },
        f.submission(item),
      ),
    fail(403),
  );
  await assert.rejects(
    () =>
      applyAgencyProductionMutation(
        f.tx,
        { userId: "other-agency", organizationId: "agency-other" },
        f.submission(item),
      ),
    fail(404),
  );
  await assert.rejects(
    () => listBrandProductionItems(f.tx, "brand-other", "campaign-own", true),
    fail(404),
  );
  item = (await f.submit(f.submission(item))).item;
  await f.admin(f.release(item));
  const publicItem = (await f.read())[0];
  assert.equal(
    (
      await listBrandProductionItems(f.tx, "brand-own", "campaign-own", false)
    )[0].canRespond,
    false,
  );
  await assert.rejects(
    () =>
      applyBrandProductionMutation(
        f.tx,
        { ...brand, userId: "brand-member" },
        f.decision(publicItem),
      ),
    fail(403),
  );
  await assert.rejects(
    () =>
      applyBrandProductionMutation(
        f.tx,
        { userId: "other-brand", organizationId: "brand-other" },
        f.decision(publicItem),
      ),
    fail(404),
  );
  f.store.orgs.find((o) => o.id === "brand-own").status = "PENDING";
  await assert.rejects(() => f.decide(f.decision(publicItem)), fail(403));
  f.store.orgs.find((o) => o.id === "agency-own").metadata = {};
  await assert.rejects(() => listAgencyProduction(f.tx, agency), fail(403));
  await assert.rejects(
    () =>
      applyAdminProductionMutation(f.tx, "agency-owner", {
        action: "prepare",
        campaignId: "campaign-own",
        clientRequestId: randomUUID(),
      }),
    fail(403),
  );
});

test("retries never duplicate versions or decisions, changed payload and stale revisions conflict", async () => {
  const f = fixture(),
    initial = await f.prepare();
  const input = f.submission(initial);
  let item = (await f.submit(input)).item;
  assert.equal((await f.submit(input)).item.revision, item.revision);
  assert.equal(f.store.submissions.length, 1);
  await assert.rejects(
    () => f.submit({ ...input, title: "다른 제목" }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
  await assert.rejects(
    () => f.submit({ ...input, clientRequestId: randomUUID() }),
    fail(409, "STALE_PRODUCTION"),
  );
  const released = f.release(item);
  await f.admin(released);
  await f.admin(released);
  const publicItem = (await f.read())[0],
    decision = f.decision(publicItem);
  await f.decide(decision);
  await f.decide(decision);
  assert.equal(f.store.items[0].revision, 3);
  await assert.rejects(
    () => f.decide({ ...decision, message: "changed" }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
  assert.equal(
    f.store.audits.filter((a) => a.action === "production.brand_approve")
      .length,
    1,
  );
});

test("closed campaigns and replaced or no-longer-approved proposals deny mutation while keeping released history", async () => {
  for (const close of [
    (f) => (f.store.campaign.status = "CANCELED"),
    (f) => (f.store.campaign.status = "SETTLING"),
    (f) => (f.store.proposals[0].supersededAt = new Date()),
    (f) => (f.store.proposalItems[0].status = "CHANGES_REQUESTED"),
    (f) =>
      f.store.proposals.push({
        ...f.store.proposals[0],
        id: "newer",
        version: 2,
        status: "PUBLISHED",
      }),
  ]) {
    const f = fixture();
    let item = await f.prepare();
    item = (await f.submit(f.submission(item))).item;
    await f.admin(f.release(item));
    const current = (await f.read())[0];
    close(f);
    const history = (await f.read())[0];
    assert.equal(history.submissions.length, 1);
    assert.equal(history.canRespond, false);
    await assert.rejects(
      () => f.decide(f.decision(current)),
      fail(409, "PRODUCTION_NOT_ACTIONABLE"),
    );
  }
});

test("manual assignment requires approved agency and cannot transfer private content after submission", async () => {
  const f = fixture();
  f.store.proposalItems[0].supplierOrganizationId = null;
  await f.prepare();
  let item = (await listAdminProduction(f.tx, "admin", "campaign-own"))
    .items[0];
  f.store.orgs.find((o) => o.id === "agency-other").status = "PENDING";
  await assert.rejects(
    () =>
      f.admin(
        f.adminAction("assign", item, {
          supplierOrganizationId: "agency-other",
        }),
      ),
    fail(409, "SUPPLIER_NOT_APPROVED"),
  );
  item = (
    await f.admin(
      f.adminAction("assign", item, { supplierOrganizationId: "agency-own" }),
    )
  ).items[0];
  item = (await f.submit(f.submission(item))).item;
  await assert.rejects(
    () =>
      f.admin(
        f.adminAction("assign", item, {
          supplierOrganizationId: "agency-other",
        }),
      ),
    fail(409, "PRODUCTION_NOT_ACTIONABLE"),
  );
});

test("URLs cannot target credentials, local or private hosts, and bounded JSON parsing rejects invalid or huge bodies", async () => {
  assert.equal(
    productionPublicUrl("https://drive.google.com/file/d/review"),
    true,
  );
  for (const url of [
    "javascript:alert(1)",
    "http://youtube.com/video",
    "https://localhost/a",
    "https://sub.local/a",
    "https://127.1/a",
    "https://2130706433/a",
    "https://10.0.0.1/a",
    "https://192.168.1.1/a",
    "https://172.16.0.1/a",
    "https://100.64.1.1/a",
    "https://[::1]/a",
    "https://user:pass@youtube.com/a",
    "https://youtube.com:444/a",
    "https://example.invalid/a",
  ])
    assert.equal(productionPublicUrl(url), false, url);
  await assert.rejects(
    () =>
      readProductionBody(
        new globalThis.Request("https://app.example/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "x".repeat(33000),
        }),
        agencyProductionMutationSchema,
      ),
    fail(413),
  );
  await assert.rejects(
    () =>
      readProductionBody(
        new globalThis.Request("https://app.example/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
        agencyProductionMutationSchema,
      ),
    fail(400),
  );
});
