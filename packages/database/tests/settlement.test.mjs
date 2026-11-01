import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "../src/client.ts";
import { fixture, brand, agency } from "./fixtures/production.mjs";
import {
  applyAgencyReportingMutation,
  applyAdminReportingMutation,
  listAgencyReporting,
} from "../src/reporting.ts";
import {
  applyAdminSettlementMutation,
  listAdminSettlement,
  listBrandInvoices,
  listAgencyPayouts,
} from "../src/settlement.ts";
import { adminSettlementMutationSchema } from "../src/settlement-validation.ts";

const fail = (status, code) => (error) =>
  error.status === status && (!code || error.code === code);
const decimal = (value) => new Prisma.Decimal(value);
async function financialFixture() {
  const f = fixture();
  let sequence = 0;
  Object.assign(f.store.campaign, {
    currency: "USD",
    updatedAt: new Date(),
    applications: [],
  });
  Object.assign(f.store.proposals[0], {
    currency: "USD",
    revision: 3,
    updatedAt: new Date(),
  });
  Object.assign(f.store.proposalItems[0], {
    unitAmount: decimal("10.10"),
    quantity: 3,
    supplierCost: decimal("7.25"),
  });
  f.store.completions = [];
  f.store.invoices = [];
  f.store.payouts = [];
  f.store.settlementMutations = [];
  const { matches, select, find, findMany, update } = f.queryHelpers;
  const contextRow = () => ({
    ...f.store.campaign,
    brandOrganization: f.store.orgs.find((o) => o.id === "brand-own"),
    completion: f.store.completions[0] ?? null,
    proposals: f.store.proposals
      .filter((p) => p.publishedAt)
      .sort((a, b) => b.version - a.version)
      .slice(0, 1)
      .map((proposal) => ({
        ...proposal,
        items: f.store.proposalItems
          .filter((i) => i.proposalId === proposal.id)
          .map((item) => {
            const production = f.store.items.find(
                (p) => p.proposalItemId === item.id,
              ),
              reporting = f.store.reportItems.find(
                (r) => r.productionItemId === production?.id,
              );
            return {
              ...item,
              productionItem: production
                ? {
                    ...production,
                    supplierOrganization: f.store.orgs.find(
                      (o) => o.id === production.supplierOrganizationId,
                    ),
                    reportingItem: reporting
                      ? {
                          ...reporting,
                          submissions: f.store.reportSubmissions
                            .filter((s) => s.reportingItemId === reporting.id)
                            .sort((a, b) => b.version - a.version)
                            .slice(0, 1),
                        }
                      : null,
                  }
                : null,
            };
          }),
      })),
  });
  f.tx.campaign.findUnique = async (query) => find([contextRow()], query);
  f.tx.campaign.updateMany = async ({ where, data }) => {
    if (!matches(f.store.campaign, where)) return { count: 0 };
    update(f.store.campaign, data);
    f.store.campaign.updatedAt = new Date();
    return { count: 1 };
  };
  f.tx.campaignCompletion = {
    create: async ({ data, select: fields }) => {
      const row = {
        id: `completion-${++sequence}`,
        completedAt: new Date(),
        ...data,
      };
      f.store.completions.push(row);
      return select(row, { select: fields });
    },
  };
  const decorate = (row) => ({
    ...row,
    campaign: { title: f.store.campaign.title },
    completion: f.store.completions.find((c) => c.id === row.completionId),
    ...(row.supplierOrganizationId
      ? {
          supplierOrganization: f.store.orgs.find(
            (o) => o.id === row.supplierOrganizationId,
          ),
        }
      : {}),
  });
  const model = (rows) => ({
    findUnique: async (query) => find(rows.map(decorate), query),
    findFirst: async (query) => find(rows.map(decorate), query),
    findMany: async (query) => findMany(rows.map(decorate), query),
    count: async ({ where }) =>
      rows.filter((row) => matches(row, where)).length,
    create: async ({ data }) => {
      const row = {
        id: `document-${++sequence}`,
        status: "DRAFT",
        revision: 0,
        dueAt: null,
        documentUrl: null,
        internalNote: "",
        issuedAt: null,
        issuedById: null,
        paidAt: null,
        paidAmount: null,
        paymentRecordedById: null,
        externalPaymentReference: null,
        ...data,
        amount: decimal(data.amount),
      };
      rows.push(row);
      return decorate(row);
    },
    updateMany: async ({ where, data }) => {
      const matchesRows = rows.filter((row) => matches(row, where));
      matchesRows.forEach((row) => update(row, data));
      return { count: matchesRows.length };
    },
  });
  f.tx.brandInvoice = model(f.store.invoices);
  f.tx.agencyPayout = model(f.store.payouts);
  f.tx.settlementMutation = {
    findUnique: async ({ where }) =>
      f.store.settlementMutations.find((row) =>
        matches(row, where.actorId_clientRequestId),
      ) ?? null,
    create: async ({ data }) => {
      f.store.settlementMutations.push(data);
      return data;
    },
  };
  let item = await f.prepare();
  item = (await f.submit(f.submission(item))).item;
  await f.admin(f.release(item));
  item = (await f.read())[0];
  await f.decide(f.decision(item));
  const reporting = (await listAgencyReporting(f.tx, agency)).items[0];
  const data = {
    title: "확인된 게시물",
    postUrl: "https://www.youtube.com/watch?v=public-report",
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    metricsAsOf: null,
    metrics: {
      views: null,
      impressions: null,
      reach: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      clicks: null,
    },
    evidenceUrl: null,
    note: "집계중인 공개 보고",
  };
  const submitted = (
    await applyAgencyReportingMutation(f.tx, agency, {
      action: "submit",
      reportingItemId: reporting.id,
      expectedRevision: reporting.revision,
      clientRequestId: randomUUID(),
      data,
    })
  ).item;
  await applyAdminReportingMutation(f.tx, "admin", {
    action: "releaseToBrand",
    campaignId: "campaign-own",
    reportingItemId: reporting.id,
    submissionId: submitted.latestSubmission.id,
    expectedRevision: submitted.revision,
    clientRequestId: randomUUID(),
    data,
    internalNote: "PRIVATE_REPORT_NOTE",
  });
  const read = () => listAdminSettlement(f.tx, "admin", "campaign-own");
  const action = (action, extra = {}) => ({
    action,
    campaignId: "campaign-own",
    clientRequestId: randomUUID(),
    ...extra,
  });
  const mutate = (input) => applyAdminSettlementMutation(f.tx, "admin", input);
  const complete = async () => {
    const before = await read();
    return mutate(
      action("completeCampaign", {
        expectedReadinessToken: before.readinessToken,
        note: "제작 승인과 최종 보고를 확인했습니다.",
      }),
    );
  };
  const prepare = async () => {
    const completed = await complete();
    return mutate(
      action("prepare", {
        completionId: completed.completion.id,
        supplierCostBasis: "ITEM_TOTAL",
      }),
    );
  };
  const docData = {
    title: "확정 정산 안내",
    note: "공개 조건",
    dueAt: null,
    documentUrl: null,
    internalNote: "PRIVATE_FINANCE_NOTE",
  };
  const save = (document, kind = "BrandInvoice") =>
    action(`save${kind}`, {
      [kind === "BrandInvoice" ? "invoiceId" : "payoutId"]: document.id,
      expectedRevision: document.revision,
      data: docData,
    });
  const issue = (document, kind = "BrandInvoice") =>
    action(`issue${kind}`, {
      [kind === "BrandInvoice" ? "invoiceId" : "payoutId"]: document.id,
      expectedRevision: document.revision,
    });
  const paid = (document, kind = "Brand") =>
    action(`record${kind}Payment`, {
      [kind === "Brand" ? "invoiceId" : "payoutId"]: document.id,
      expectedRevision: document.revision,
      data: {
        paidAt: new Date().toISOString(),
        reference: "PRIVATE_EXTERNAL_REFERENCE",
        amount: document.amount,
        currency: document.currency,
        internalNote: "PRIVATE_EXTERNAL_RECORD_ONLY",
      },
    });
  function addReadyItem({
    id,
    unitAmount,
    quantity,
    supplierCost,
    supplierOrganizationId = "agency-own",
  }) {
    f.store.proposalItems.push({
      ...f.store.proposalItems[0],
      id,
      creatorName: id,
      unitAmount: decimal(unitAmount),
      quantity,
      supplierCost: decimal(supplierCost),
    });
    const production = {
      ...f.store.items[0],
      id: `production-${id}`,
      proposalItemId: id,
      supplierOrganizationId,
    };
    f.store.items.push(production);
    const report = {
      ...f.store.reportItems[0],
      id: `report-${id}`,
      productionItemId: production.id,
    };
    f.store.reportItems.push(report);
    f.store.reportSubmissions.push({
      ...f.store.reportSubmissions[0],
      id: `report-submission-${id}`,
      reportingItemId: report.id,
    });
  }
  return {
    ...f,
    read,
    action,
    mutate,
    complete,
    prepare,
    save,
    issue,
    paid,
    addReadyItem,
  };
}

test("completion requires every approved item and latest public report, including financial readiness", async () => {
  for (const change of [
    (f) => (f.store.items[0].status = "BRAND_REVISION"),
    (f) => (f.store.reportItems[0].status = "ADMIN_REVIEW"),
    (f) => (f.store.reportSubmissions[0].releasedAt = null),
    (f) => (f.store.proposals[0].status = "PUBLISHED"),
    (f) => (f.store.proposalItems[0].supplierCost = null),
    (f) => (f.store.proposalItems[0].supplierCost = decimal("0")),
    (f) => (f.store.proposalItems[0].supplierCost = decimal("-1")),
    (f) => (f.store.items[0].supplierOrganizationId = null),
    (f) => (f.store.orgs.find((o) => o.id === "agency-own").status = "PENDING"),
    (f) =>
      (f.store.campaign.applications = [
        { settlement: { id: "legacy", status: "APPROVED" } },
      ]),
  ]) {
    const f = await financialFixture();
    change(f);
    const view = await f.read();
    assert.equal(view.canComplete, false);
    assert.ok(view.completionProblems.length);
    await assert.rejects(
      () =>
        f.mutate(
          f.action("completeCampaign", {
            expectedReadinessToken: view.readinessToken,
            note: "완료 요청",
          }),
        ),
      fail(409, "COMPLETION_NOT_READY"),
    );
    assert.equal(f.store.completions.length, 0);
    assert.equal(f.store.campaign.status, "IN_PROGRESS");
  }
});

test("readiness revision includes reporting and economic changes; completing is explicit and idempotent", async () => {
  const f = await financialFixture();
  const initial = await f.read();
  assert.equal(initial.canComplete, true);
  assert.equal(initial.canPrepare, false);
  f.store.proposalItems[0].supplierCost = decimal("7.26");
  await assert.rejects(
    () =>
      f.mutate(
        f.action("completeCampaign", {
          expectedReadinessToken: initial.readinessToken,
          note: "완료 확인",
        }),
      ),
    fail(409, "STALE_COMPLETION"),
  );
  const current = await f.read();
  const body = f.action("completeCampaign", {
    expectedReadinessToken: current.readinessToken,
    note: "완료 확인",
  });
  const done = await f.mutate(body);
  await f.mutate(body);
  assert.equal(done.campaignStatus, "COMPLETED");
  assert.equal(f.store.completions.length, 1);
  assert.equal(f.store.invoices.length, 0);
  assert.equal(done.canPrepare, true);
  await assert.rejects(
    () => f.mutate({ ...body, note: "변경된 메모" }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
});

test("exact brand unit×quantity and supplier item-total sum produce separate supplier documents", async () => {
  const f = await financialFixture();
  f.addReadyItem({
    id: "same-agency-item",
    unitAmount: "0.15",
    quantity: 2,
    supplierCost: "0.20",
  });
  f.addReadyItem({
    id: "other-agency-item",
    unitAmount: "20.00",
    quantity: 1,
    supplierCost: "12.00",
    supplierOrganizationId: "agency-other",
  });
  const drafts = await f.prepare();
  assert.equal(drafts.invoice.amount, "50.60");
  assert.equal(drafts.totalSupplierAmount, "19.45");
  assert.equal(drafts.payouts.length, 2);
  const own = drafts.payouts.find(
    (p) => p.supplierOrganizationId === "agency-own",
  );
  assert.equal(own.amount, "7.45");
  assert.equal(own.lines[0].quantity, 3);
  assert.equal(own.lines[0].itemTotalAmount, "7.25");
  assert.equal(drafts.invoice.lines[0].lineAmount, "30.30");
  assert.deepEqual(await listBrandInvoices(f.tx, brand), []);
  assert.deepEqual(await listAgencyPayouts(f.tx, agency), []);
});

test("explicit issuing exposes only recipient-owned snapshots, MEMBER reads are allowed and draft saves lock", async () => {
  const f = await financialFixture();
  f.addReadyItem({
    id: "other-item",
    unitAmount: "99.99",
    quantity: 1,
    supplierCost: "19.91",
    supplierOrganizationId: "agency-other",
  });
  let view = await f.prepare();
  view = await f.mutate(f.save(view.invoice));
  view = await f.mutate(f.issue(view.invoice));
  const own = view.payouts.find(
    (p) => p.supplierOrganizationId === "agency-own",
  );
  view = await f.mutate(f.save(own, "AgencyPayout"));
  view = await f.mutate(
    f.issue(
      view.payouts.find((p) => p.id === own.id),
      "AgencyPayout",
    ),
  );
  const invoices = await listBrandInvoices(f.tx, {
    ...brand,
    userId: "brand-member",
  });
  const payouts = await listAgencyPayouts(f.tx, {
    ...agency,
    userId: "agency-member",
  });
  assert.equal(invoices.length, 1);
  assert.equal(payouts.length, 1);
  for (const needle of [
    "PRIVATE_",
    "supplierOrganizationId",
    "supplierName",
    "supplierCost",
    "itemTotalAmount",
    "externalPaymentReference",
    "7.25",
    "19.91",
  ])
    assert.ok(!JSON.stringify(invoices).includes(needle), needle);
  for (const needle of [
    "PRIVATE_",
    "unitAmount",
    "lineAmount",
    "brandOrganizationId",
    "externalPaymentReference",
    "130.29",
    "other-item",
  ])
    assert.ok(!JSON.stringify(payouts).includes(needle), needle);
  assert.deepEqual(
    await listAgencyPayouts(f.tx, {
      userId: "other-agency",
      organizationId: "agency-other",
    }),
    [],
  );
  await assert.rejects(
    () =>
      listBrandInvoices(
        f.tx,
        { userId: "other-brand", organizationId: "brand-other" },
        "campaign-own",
      ),
    fail(404),
  );
  await assert.rejects(
    () => f.mutate(f.save(view.invoice)),
    fail(409, "IMMUTABLE_SETTLEMENT"),
  );
  await assert.rejects(
    () =>
      applyAdminSettlementMutation(
        f.tx,
        "brand-owner",
        f.action("prepare", {
          completionId: view.completion.id,
          supplierCostBasis: "ITEM_TOTAL",
        }),
      ),
    fail(403),
  );
});

test("external payment records require exact issued currency/amount and preserve immutable financial snapshot", async () => {
  const f = await financialFixture();
  let view = await f.prepare();
  await assert.rejects(
    () => f.mutate(f.paid(view.invoice)),
    fail(409, "PAYMENT_RECORD_NOT_ALLOWED"),
  );
  view = await f.mutate(f.issue(view.invoice));
  const original = {
    amount: view.invoice.amount,
    lines: view.invoice.lines,
    note: view.invoice.note,
    title: view.invoice.title,
  };
  for (const changes of [{ amount: "30.29" }, { currency: "KRW" }]) {
    const input = f.paid(view.invoice);
    await assert.rejects(
      () => f.mutate({ ...input, data: { ...input.data, ...changes } }),
      fail(409, "AMOUNT_MISMATCH"),
    );
  }
  const early = f.paid(view.invoice);
  await assert.rejects(
    () =>
      f.mutate({
        ...early,
        data: {
          ...early.data,
          paidAt: new Date(
            Date.parse(view.invoice.issuedAt) - 1000,
          ).toISOString(),
        },
      }),
    fail(400, "INVALID_PAYMENT_DATE"),
  );
  const payment = f.paid(view.invoice);
  view = await f.mutate(payment);
  await f.mutate(payment);
  assert.equal(view.invoice.status, "PAID");
  assert.equal(f.store.invoices[0].paidAmount.toFixed(2), "30.30");
  const visible = (await listBrandInvoices(f.tx, brand))[0];
  assert.deepEqual(
    {
      amount: visible.amount,
      lines: visible.lines,
      note: visible.note,
      title: visible.title,
    },
    original,
  );
  assert.ok(!JSON.stringify(visible).includes("PRIVATE_EXTERNAL"));
  await assert.rejects(
    () => f.mutate(f.paid(view.invoice)),
    fail(409, "PAYMENT_RECORD_NOT_ALLOWED"),
  );
  view = await f.mutate(f.issue(view.payouts[0], "AgencyPayout"));
  view = await f.mutate(f.paid(view.payouts[0], "Agency"));
  assert.equal(view.payouts[0].status, "PAID");
  assert.equal((await listAgencyPayouts(f.tx, agency))[0].amount, "7.25");
});

test("stale document revisions and changed idempotency keys cannot update or issue draft twice", async () => {
  const f = await financialFixture();
  let view = await f.prepare();
  const body = f.save(view.invoice);
  view = await f.mutate(body);
  await f.mutate(body);
  assert.equal(view.invoice.revision, 1);
  await assert.rejects(
    () => f.mutate({ ...body, data: { ...body.data, title: "changed" } }),
    fail(409, "IDEMPOTENCY_CONFLICT"),
  );
  await assert.rejects(
    () => f.mutate({ ...body, clientRequestId: randomUUID() }),
    fail(409, "STALE_SETTLEMENT"),
  );
  const issue = f.issue(view.invoice);
  await f.mutate(issue);
  await f.mutate(issue);
  assert.equal(f.store.invoices[0].revision, 2);
});

test("closed/canceled and revoked approval block financial changes but issued history remains scoped", async () => {
  const f = await financialFixture();
  let view = await f.prepare();
  view = await f.mutate(f.issue(view.invoice));
  f.store.campaign.status = "CANCELED";
  await assert.rejects(
    () => f.mutate(f.paid(view.invoice)),
    fail(409, "SETTLEMENT_NOT_ACTIONABLE"),
  );
  assert.equal((await listBrandInvoices(f.tx, brand)).length, 1);
  f.store.orgs.find((o) => o.id === "brand-own").status = "PENDING";
  await assert.rejects(() => listBrandInvoices(f.tx, brand), fail(403));
  f.store.orgs.find((o) => o.id === "platform").status = "PENDING";
  await assert.rejects(() => f.read(), fail(403));
});

test("completion evidence remains frozen while JSONB key order does not affect the proof", async () => {
  const f = await financialFixture();
  let view = await f.prepare();
  f.store.completions[0].evidenceSnapshot =
    f.store.completions[0].evidenceSnapshot.map((row) =>
      Object.fromEntries(Object.entries(row).reverse()),
    );
  view = await f.mutate(f.issue(view.invoice));
  f.store.reportItems[0].revision += 1;
  await assert.rejects(
    () => f.mutate(f.paid(view.invoice)),
    fail(409, "SETTLEMENT_NOT_ACTIONABLE"),
  );
  assert.equal((await listBrandInvoices(f.tx, brand))[0].status, "ISSUED");
});

test("currency, decimal precision/limits and explicit supplier item-total confirmation are enforced", async () => {
  const f = await financialFixture();
  f.store.campaign.currency = "KRW";
  assert.equal((await f.read()).canComplete, false);
  f.store.campaign.currency = "USD";
  f.store.proposalItems[0].unitAmount = decimal("9999999999999999.99");
  f.store.proposalItems[0].quantity = 2;
  assert.equal((await f.read()).canComplete, false);
  assert.equal(
    adminSettlementMutationSchema.safeParse(
      f.action("prepare", {
        completionId: "x",
        supplierCostBasis: "UNIT_COST",
      }),
    ).success,
    false,
  );
  const payment = f.paid({
    id: "invoice",
    revision: 0,
    currency: "USD",
    amount: "1.000",
  });
  assert.equal(adminSettlementMutationSchema.safeParse(payment).success, false);
  assert.equal(
    adminSettlementMutationSchema.safeParse({
      ...payment,
      data: { ...payment.data, amount: "-1" },
    }).success,
    false,
  );
});
