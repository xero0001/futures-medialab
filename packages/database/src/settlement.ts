import { createHash } from "node:crypto";
import { Prisma } from "@futures-medialab/database";
import {
  productionFail as settlementFail,
  requireProductionMember,
} from "@futures-medialab/database/production";
import {
  proposalAmount,
  proposalCents,
} from "@futures-medialab/database/proposal-validation";
import {
  adminSettlementMutationSchema,
  settlementDocumentSchema,
} from "@futures-medialab/database/settlement-validation";
import type {
  AdminSettlementMutation,
  AdminSettlementResponse,
  AdminBrandInvoice,
  AdminAgencyPayout,
  BrandInvoice,
  AgencyPayout,
  BrandInvoiceLine,
  AgencyPayoutLine,
  CampaignCompletionSummary,
} from "@futures-medialab/database/settlement-types";
export {
  ProductionError as SettlementError,
  productionTransaction as settlementTransaction,
} from "@futures-medialab/database/production";
type Tx = Prisma.TransactionClient;
type Actor = { userId: string; organizationId: string };
const maxCents = 999999999999999999n;
const activeStatuses = ["IN_PROGRESS", "VERIFYING"];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
};
const contextInclude = {
  brandOrganization: { select: { status: true } },
  completion: true,
  proposals: {
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    take: 1,
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          productionItem: {
            include: {
              supplierOrganization: {
                select: { id: true, name: true, type: true, status: true },
              },
              reportingItem: {
                include: {
                  submissions: {
                    orderBy: { version: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      version: true,
                      releasedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  applications: {
    select: { settlement: { select: { id: true, status: true } } },
  },
} satisfies Prisma.CampaignInclude;
type Context = Prisma.CampaignGetPayload<{ include: typeof contextInclude }>;
const publicDocumentSelect = {
  id: true,
  campaignId: true,
  status: true,
  revision: true,
  currency: true,
  amount: true,
  lineSnapshot: true,
  title: true,
  note: true,
  dueAt: true,
  documentUrl: true,
  issuedAt: true,
  paidAt: true,
  campaign: { select: { title: true } },
  completion: { select: { proposalVersion: true, completedAt: true } },
} satisfies Prisma.BrandInvoiceSelect;
const publicPayoutSelect = {
  ...publicDocumentSelect,
} satisfies Prisma.AgencyPayoutSelect;
const adminInvoiceInclude = {
  campaign: { select: { title: true } },
  completion: { select: { proposalVersion: true, completedAt: true } },
} satisfies Prisma.BrandInvoiceInclude;
const adminPayoutInclude = {
  ...adminInvoiceInclude,
  supplierOrganization: { select: { name: true, status: true, type: true } },
} satisfies Prisma.AgencyPayoutInclude;
type PublicInvoiceRow = Prisma.BrandInvoiceGetPayload<{
  select: typeof publicDocumentSelect;
}>;
type PublicPayoutRow = Prisma.AgencyPayoutGetPayload<{
  select: typeof publicPayoutSelect;
}>;
type AdminInvoiceRow = Prisma.BrandInvoiceGetPayload<{
  include: typeof adminInvoiceInclude;
}>;
type AdminPayoutRow = Prisma.AgencyPayoutGetPayload<{
  include: typeof adminPayoutInclude;
}>;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
function invoiceLines(value: unknown): BrandInvoiceLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = record(item);
    return {
      proposalItemId: String(row.proposalItemId ?? ""),
      creatorName: String(row.creatorName ?? ""),
      platform: String(row.platform ?? ""),
      description: String(row.description ?? ""),
      quantity: typeof row.quantity === "number" ? row.quantity : 0,
      unitAmount: String(row.unitAmount ?? ""),
      lineAmount: String(row.lineAmount ?? ""),
    };
  });
}
function payoutLines(value: unknown): AgencyPayoutLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = record(item);
    return {
      proposalItemId: String(row.proposalItemId ?? ""),
      creatorName: String(row.creatorName ?? ""),
      platform: String(row.platform ?? ""),
      description: String(row.description ?? ""),
      quantity: typeof row.quantity === "number" ? row.quantity : 0,
      itemTotalAmount: String(row.itemTotalAmount ?? ""),
    };
  });
}
function documentBase(row: PublicInvoiceRow | PublicPayoutRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    proposalVersion: row.completion.proposalVersion,
    status: row.status as "ISSUED" | "PAID",
    revision: row.revision,
    currency: row.currency,
    amount: row.amount.toFixed(2),
    title: row.title,
    note: row.note,
    dueAt: row.dueAt?.toISOString() ?? null,
    documentUrl: row.documentUrl,
    issuedAt: row.issuedAt?.toISOString() ?? "",
    paidAt: row.paidAt?.toISOString() ?? null,
    completedAt: row.completion.completedAt.toISOString(),
  };
}
function brandDto(row: PublicInvoiceRow): BrandInvoice {
  if (row.status === "DRAFT" || !row.issuedAt)
    settlementFail(404, "NOT_FOUND", "발행된 청구서를 찾을 수 없습니다.");
  return { ...documentBase(row), lines: invoiceLines(row.lineSnapshot) };
}
function agencyDto(row: PublicPayoutRow): AgencyPayout {
  if (row.status === "DRAFT" || !row.issuedAt)
    settlementFail(404, "NOT_FOUND", "발행된 지급 내역을 찾을 수 없습니다.");
  return { ...documentBase(row), lines: payoutLines(row.lineSnapshot) };
}
function completionDto(
  row: Context["completion"],
): CampaignCompletionSummary | null {
  return row
    ? {
        id: row.id,
        campaignId: row.campaignId,
        proposalId: row.proposalId,
        proposalVersion: row.proposalVersion,
        completedAt: row.completedAt.toISOString(),
        note: row.note,
      }
    : null;
}
async function requireAdmin(tx: Tx, userId: string) {
  if (
    !(await tx.organizationMember.findFirst({
      where: {
        userId,
        role: { in: ["OWNER", "ADMIN"] },
        organization: { type: "PLATFORM", status: "ACTIVE" },
      },
      select: { organizationId: true },
    }))
  )
    settlementFail(403, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
}
async function context(tx: Tx, campaignId: string): Promise<Context> {
  const row = await tx.campaign.findUnique({
    where: { id: campaignId },
    include: contextInclude,
  });
  if (!row) settlementFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  return row;
}
function readiness(row: Context) {
  const proposal = row.proposals[0];
  const money = economics(row);
  const evidence = (proposal?.items ?? []).map((item) => ({
    proposalItemId: item.id,
    proposalItemStatus: item.status,
    productionItemId: item.productionItem?.id ?? null,
    productionStatus: item.productionItem?.status ?? null,
    productionRevision: item.productionItem?.revision ?? null,
    reportingItemId: item.productionItem?.reportingItem?.id ?? null,
    reportingStatus: item.productionItem?.reportingItem?.status ?? null,
    reportingRevision: item.productionItem?.reportingItem?.revision ?? null,
    latestSubmissionId:
      item.productionItem?.reportingItem?.submissions[0]?.id ?? null,
    latestSubmissionStatus:
      item.productionItem?.reportingItem?.submissions[0]?.status ?? null,
    releasedAt:
      item.productionItem?.reportingItem?.submissions[0]?.releasedAt?.toISOString() ??
      null,
  }));
  const token = hash({
    campaignId: row.id,
    campaignStatus: row.status,
    campaignUpdatedAt: row.updatedAt.toISOString(),
    brandStatus: row.brandOrganization.status,
    proposalId: proposal?.id ?? null,
    proposalRevision: proposal?.revision ?? null,
    proposalUpdatedAt: proposal?.updatedAt.toISOString() ?? null,
    currency: row.currency,
    financialSources: {
      brandAmount: money.brandAmount,
      brandLines: money.brandLines,
      suppliers: money.supplierGroups,
      problems: money.problems,
    },
    evidence,
  });
  const problems: string[] = [];
  if (row.completion || row.status === "COMPLETED")
    problems.push("이미 완료 처리된 캠페인입니다.");
  else if (!activeStatuses.includes(row.status))
    problems.push("진행 또는 검증 단계의 캠페인만 완료할 수 있습니다.");
  if (row.brandOrganization.status !== "ACTIVE")
    problems.push("승인된 브랜드 조직의 캠페인만 완료할 수 있습니다.");
  if (
    !proposal ||
    proposal.status !== "APPROVED" ||
    proposal.supersededAt ||
    !proposal.items.length ||
    proposal.items.some((item) => item.status !== "APPROVED")
  )
    problems.push("현재 공식 제안의 모든 항목이 승인되어야 합니다.");
  for (const item of proposal?.items ?? []) {
    const production = item.productionItem,
      reporting = production?.reportingItem,
      latest = reporting?.submissions[0];
    if (
      !production ||
      production.campaignId !== row.id ||
      production.status !== "APPROVED"
    )
      problems.push(`${item.creatorName}: 콘텐츠 승인이 필요합니다.`);
    if (
      !reporting ||
      reporting.campaignId !== row.id ||
      reporting.status !== "PUBLISHED" ||
      latest?.status !== "PUBLISHED" ||
      !latest.releasedAt
    )
      problems.push(
        `${item.creatorName}: 최신 게시·성과 보고서의 공개를 완료해 주세요.`,
      );
  }
  problems.push(...money.problems);
  return { token, evidence, problems };
}
type SupplierGroup = {
  organizationId: string;
  name: string;
  amount: string;
  lines: AgencyPayoutLine[];
};
function sourceCents(value: Prisma.Decimal | null): bigint | null {
  if (!value) return null;
  try {
    return proposalCents(value.toFixed(2));
  } catch {
    return null;
  }
}
function economics(row: Context) {
  const proposal = row.proposals[0],
    problems: string[] = [];
  const brandLines: BrandInvoiceLine[] = [],
    groups = new Map<
      string,
      { name: string; cents: bigint; lines: AgencyPayoutLine[] }
    >();
  let brand = 0n,
    supplier = 0n;
  if (!proposal || proposal.status !== "APPROVED" || proposal.supersededAt)
    problems.push("승인된 현재 공식 제안이 필요합니다.");
  if (proposal && proposal.currency !== row.currency)
    problems.push("캠페인과 확정 제안의 통화가 다릅니다.");
  for (const item of proposal?.items ?? []) {
    if (
      !item.unitAmount ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.status !== "APPROVED"
    ) {
      problems.push(`${item.creatorName}: 확정 청구 금액을 확인해 주세요.`);
      continue;
    }
    const unit = sourceCents(item.unitAmount);
    if (unit === null || unit <= 0n) {
      problems.push(`${item.creatorName}: 양수인 확정 청구 금액이 필요합니다.`);
      continue;
    }
    const line = unit * BigInt(item.quantity);
    if (line > maxCents)
      problems.push(`${item.creatorName}: 청구 금액 범위를 확인해 주세요.`);
    brand += line;
    brandLines.push({
      proposalItemId: item.id,
      creatorName: item.creatorName,
      platform: item.platform,
      description: item.deliverables,
      quantity: item.quantity,
      unitAmount: proposalAmount(unit),
      lineAmount: proposalAmount(line),
    });
    const production = item.productionItem,
      organization = production?.supplierOrganization;
    if (
      !organization ||
      !production.supplierOrganizationId ||
      organization.type !== "AGENCY" ||
      organization.status !== "ACTIVE"
    ) {
      problems.push(`${item.creatorName}: 승인된 수행 조직을 지정해야 합니다.`);
      continue;
    }
    const cost = sourceCents(item.supplierCost);
    if (cost === null || cost <= 0n) {
      problems.push(
        `${item.creatorName}: 양수인 항목 총공급가를 입력해야 합니다.`,
      );
      continue;
    }
    // Item TOTAL, never multiplied by quantity.
    supplier += cost;
    const group = groups.get(organization.id) ?? {
      name: organization.name,
      cents: 0n,
      lines: [],
    };
    group.cents += cost;
    group.lines.push({
      proposalItemId: item.id,
      creatorName: item.creatorName,
      platform: item.platform,
      description: item.deliverables,
      quantity: item.quantity,
      itemTotalAmount: proposalAmount(cost),
    });
    groups.set(organization.id, group);
  }
  if (
    brand <= 0n ||
    brand > maxCents ||
    supplier <= 0n ||
    supplier > maxCents ||
    [...groups.values()].some((group) => group.cents > maxCents)
  )
    problems.push("확정 금액 합계를 저장 가능한 범위에서 확인해 주세요.");
  if (
    row.applications.some(
      (application) =>
        application.settlement && application.settlement.status !== "REJECTED",
    )
  )
    problems.push(
      "기존 신청 기반 정산 기록을 먼저 정리해야 중복 정산을 방지할 수 있습니다.",
    );
  const supplierGroups: SupplierGroup[] = [...groups].map(
    ([organizationId, group]) => ({
      organizationId,
      name: group.name,
      amount: proposalAmount(group.cents),
      lines: group.lines,
    }),
  );
  return {
    problems,
    brandAmount: brand > 0n && brand <= maxCents ? proposalAmount(brand) : null,
    supplierAmount: problems.length ? null : proposalAmount(supplier),
    brandLines,
    supplierGroups,
  };
}
function financialProblem(row: Context): string | null {
  if (!row.completion || row.status !== "COMPLETED")
    return "관리자가 완료 처리한 캠페인만 정산할 수 있습니다.";
  if (row.brandOrganization.status !== "ACTIVE")
    return "브랜드 조직의 승인을 확인해 주세요.";
  const proposal = row.proposals[0];
  if (
    !proposal ||
    proposal.id !== row.completion.proposalId ||
    proposal.status !== "APPROVED" ||
    proposal.supersededAt ||
    proposal.revision !== row.completion.proposalRevision
  )
    return "완료 시점의 확정 제안이 변경되었습니다. 운영 검토가 필요합니다.";
  if (
    hash(canonical(row.completion.evidenceSnapshot)) !==
    hash(canonical(readiness(row).evidence))
  )
    return "완료 시점의 제작·성과 확인 내역이 변경되었습니다. 운영 검토가 필요합니다.";
  return null;
}
function documentProblems(
  row: Context,
  document: AdminInvoiceRow | AdminPayoutRow,
) {
  const problem = financialProblem(row),
    problems = problem ? [problem] : [];
  if (
    "supplierOrganization" in document &&
    (document.supplierOrganization.type !== "AGENCY" ||
      document.supplierOrganization.status !== "ACTIVE")
  )
    problems.push("승인된 수행 조직의 지급 기록만 변경할 수 있습니다.");
  return problems;
}
function adminInvoiceDto(
  row: AdminInvoiceRow,
  campaign: Context,
): AdminBrandInvoice {
  const problems = documentProblems(campaign, row),
    draft = row.status === "DRAFT" && !row.issuedAt;
  return {
    ...documentBase(row),
    lines: invoiceLines(row.lineSnapshot),
    status: row.status,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    internalNote: row.internalNote,
    externalPaymentReference: row.externalPaymentReference,
    canEdit: !problems.length && draft,
    canIssue:
      !problems.length &&
      draft &&
      settlementDocumentSchema.safeParse({
        title: row.title,
        note: row.note,
        dueAt: row.dueAt?.toISOString() ?? null,
        documentUrl: row.documentUrl,
        internalNote: row.internalNote,
      }).success,
    canRecordPayment:
      !problems.length &&
      row.status === "ISSUED" &&
      Boolean(row.issuedAt) &&
      !row.paidAt,
    actionProblems: problems,
  };
}
function adminPayoutDto(
  row: AdminPayoutRow,
  campaign: Context,
): AdminAgencyPayout {
  const problems = documentProblems(campaign, row),
    draft = row.status === "DRAFT" && !row.issuedAt;
  return {
    ...documentBase(row),
    lines: payoutLines(row.lineSnapshot),
    status: row.status,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    internalNote: row.internalNote,
    externalPaymentReference: row.externalPaymentReference,
    supplierOrganizationId: row.supplierOrganizationId,
    supplierName: row.supplierOrganization.name,
    canEdit: !problems.length && draft,
    canIssue:
      !problems.length &&
      draft &&
      settlementDocumentSchema.safeParse({
        title: row.title,
        note: row.note,
        dueAt: row.dueAt?.toISOString() ?? null,
        documentUrl: row.documentUrl,
        internalNote: row.internalNote,
      }).success,
    canRecordPayment:
      !problems.length &&
      row.status === "ISSUED" &&
      Boolean(row.issuedAt) &&
      !row.paidAt,
    actionProblems: problems,
  };
}
export async function listAdminSettlement(
  tx: Tx,
  userId: string,
  campaignId: string,
): Promise<AdminSettlementResponse> {
  await requireAdmin(tx, userId);
  const row = await context(tx, campaignId),
    ready = readiness(row),
    money = economics(row);
  // Interactive transactions use a single database connection; keep reads sequential.
  const invoice = await tx.brandInvoice.findUnique({
    where: { campaignId },
    include: adminInvoiceInclude,
  });
  const payouts = await tx.agencyPayout.findMany({
    where: { campaignId },
    include: adminPayoutInclude,
    orderBy: { id: "asc" },
  });
  const preparationProblems = [...money.problems];
  const financial = financialProblem(row);
  if (financial) preparationProblems.unshift(financial);
  if (invoice || payouts.length)
    preparationProblems.push("청구·지급 초안이 이미 생성되어 있습니다.");
  return {
    campaignId,
    campaignTitle: row.title,
    campaignStatus: row.status,
    currency: row.currency,
    completion: completionDto(row.completion),
    readinessToken: ready.token,
    canComplete: !ready.problems.length,
    completionProblems: ready.problems,
    canPrepare: !preparationProblems.length,
    preparationProblems,
    supplierCostBasis: "ITEM_TOTAL",
    brandTotalAmount: money.brandAmount,
    totalSupplierAmount: money.supplierAmount,
    invoice: invoice ? adminInvoiceDto(invoice, row) : null,
    payouts: payouts.map((payout) => adminPayoutDto(payout, row)),
  };
}
export async function listBrandInvoices(
  tx: Tx,
  actor: Actor,
  campaignId?: string,
  limit?: number,
): Promise<BrandInvoice[]> {
  await requireProductionMember(tx, actor, "BRAND");
  if (
    campaignId &&
    !(await tx.campaign.findFirst({
      where: { id: campaignId, brandOrganizationId: actor.organizationId },
      select: { id: true },
    }))
  )
    settlementFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  const rows = await tx.brandInvoice.findMany({
    where: {
      brandOrganizationId: actor.organizationId,
      ...(campaignId ? { campaignId } : {}),
      status: { in: ["ISSUED", "PAID"] },
      issuedAt: { not: null },
    },
    ...(limit === undefined ? {} : { take: Math.min(501, Math.max(1, limit)) }),
    select: publicDocumentSelect,
    orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
  });
  return rows.map(brandDto);
}
export async function listAgencyPayouts(
  tx: Tx,
  actor: Actor,
  campaignId?: string,
): Promise<AgencyPayout[]> {
  await requireProductionMember(tx, actor, "AGENCY");
  if (
    campaignId &&
    !(await tx.productionItem.findFirst({
      where: { campaignId, supplierOrganizationId: actor.organizationId },
      select: { id: true },
    }))
  )
    settlementFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  const rows = await tx.agencyPayout.findMany({
    where: {
      supplierOrganizationId: actor.organizationId,
      ...(campaignId ? { campaignId } : {}),
      status: { in: ["ISSUED", "PAID"] },
      issuedAt: { not: null },
    },
    select: publicPayoutSelect,
    orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
  });
  return rows.map(agencyDto);
}
async function audit(
  tx: Tx,
  userId: string,
  action: string,
  id: string,
  payload: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: {
      actorId: userId,
      action: `admin.settlement.${action}`,
      entityType: "CampaignCompletion",
      entityId: id,
      payload,
    },
  });
}
async function replay(
  tx: Tx,
  userId: string,
  input: AdminSettlementMutation,
  payloadHash: string,
) {
  const prior = await tx.settlementMutation.findUnique({
    where: {
      actorId_clientRequestId: {
        actorId: userId,
        clientRequestId: input.clientRequestId,
      },
    },
  });
  if (prior && prior.payloadHash !== payloadHash)
    settlementFail(
      409,
      "IDEMPOTENCY_CONFLICT",
      "같은 요청 키로 다른 내용을 전송할 수 없습니다.",
    );
  return prior;
}
export async function applyAdminSettlementMutation(
  tx: Tx,
  userId: string,
  raw: AdminSettlementMutation,
): Promise<AdminSettlementResponse> {
  await requireAdmin(tx, userId);
  const parsed = adminSettlementMutationSchema.safeParse(raw);
  if (!parsed.success)
    settlementFail(
      400,
      "INVALID_INPUT",
      "완료·정산 처리 내용을 확인해 주세요.",
    );
  const input = parsed.data,
    payloadHash = hash(input),
    row = await context(tx, input.campaignId);
  if (await replay(tx, userId, input, payloadHash))
    return listAdminSettlement(tx, userId, row.id);
  let completionId = row.completion?.id;
  if (input.action === "completeCampaign") {
    const ready = readiness(row);
    if (ready.problems.length)
      settlementFail(409, "COMPLETION_NOT_READY", ready.problems.join(" "));
    if (ready.token !== input.expectedReadinessToken)
      settlementFail(
        409,
        "STALE_COMPLETION",
        "검토 내역이 변경되었습니다. 최신 제작·성과를 다시 확인해 주세요.",
      );
    const proposal = row.proposals[0]!;
    const changed = await tx.campaign.updateMany({
      where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
      data: { status: "COMPLETED" },
    });
    if (changed.count !== 1)
      settlementFail(409, "STALE_COMPLETION", "캠페인 상태가 변경되었습니다.");
    const completion = await tx.campaignCompletion.create({
      data: {
        campaignId: row.id,
        proposalId: proposal.id,
        proposalVersion: proposal.version,
        proposalRevision: proposal.revision,
        readinessToken: ready.token,
        evidenceSnapshot: ready.evidence,
        note: input.note,
        completedById: userId,
      },
      select: { id: true },
    });
    completionId = completion.id;
    await audit(tx, userId, input.action, completion.id, {
      campaignId: row.id,
      proposalId: proposal.id,
      items: proposal.items.length,
    });
  } else {
    const problem = financialProblem(row);
    if (problem) settlementFail(409, "SETTLEMENT_NOT_ACTIONABLE", problem);
    completionId = row.completion!.id;
    if (input.action === "prepare") {
      if (input.completionId !== completionId)
        settlementFail(409, "STALE_COMPLETION", "완료 기록이 변경되었습니다.");
      const money = economics(row);
      if (money.problems.length || !money.brandAmount)
        settlementFail(
          409,
          "SETTLEMENT_REQUIREMENTS",
          money.problems.join(" "),
        );
      if (
        (await tx.brandInvoice.findUnique({
          where: { campaignId: row.id },
          select: { id: true },
        })) ||
        (await tx.agencyPayout.count({ where: { campaignId: row.id } }))
      )
        settlementFail(
          409,
          "SETTLEMENT_EXISTS",
          "정산 초안이 이미 생성되었습니다.",
        );
      await tx.brandInvoice.create({
        data: {
          campaignId: row.id,
          completionId,
          brandOrganizationId: row.brandOrganizationId,
          currency: row.currency,
          amount: money.brandAmount,
          lineSnapshot: money.brandLines,
          title: `${row.title} · 브랜드 청구`,
          note: "확정 제안 금액에 따른 청구 내역입니다. 외부 입금 처리 결과는 별도로 기록합니다.",
        },
      });
      for (const group of money.supplierGroups)
        await tx.agencyPayout.create({
          data: {
            campaignId: row.id,
            completionId,
            supplierOrganizationId: group.organizationId,
            currency: row.currency,
            amount: group.amount,
            lineSnapshot: group.lines,
            supplierCostBasis: "ITEM_TOTAL",
            title: `${row.title} · 지급 정산`,
            note: "확정된 항목 총공급가에 따른 지급 내역입니다. 외부 지급 처리 결과는 별도로 기록합니다.",
          },
        });
      await audit(tx, userId, input.action, completionId, {
        campaignId: row.id,
        supplierCostBasis: "ITEM_TOTAL",
        payouts: money.supplierGroups.length,
      });
    } else {
      const brandAction = "invoiceId" in input;
      const invoice = brandAction
        ? await tx.brandInvoice.findFirst({
            where: { id: input.invoiceId, campaignId: row.id, completionId },
            include: adminInvoiceInclude,
          })
        : null;
      const payout = !brandAction
        ? await tx.agencyPayout.findFirst({
            where: { id: input.payoutId, campaignId: row.id, completionId },
            include: adminPayoutInclude,
          })
        : null;
      const document = invoice ?? payout;
      if (!document)
        settlementFail(404, "NOT_FOUND", "정산 문서를 찾을 수 없습니다.");
      if (document.revision !== input.expectedRevision)
        settlementFail(
          409,
          "STALE_SETTLEMENT",
          "정산 내역이 변경되었습니다. 새로고침해 주세요.",
        );
      const problems = documentProblems(row, document);
      if (problems.length)
        settlementFail(409, "SETTLEMENT_NOT_ACTIONABLE", problems.join(" "));
      const where = {
        id: document.id,
        revision: input.expectedRevision,
        status: document.status,
      };
      let data: Prisma.BrandInvoiceUncheckedUpdateManyInput;
      if (
        input.action === "saveBrandInvoice" ||
        input.action === "saveAgencyPayout"
      ) {
        if (document.status !== "DRAFT" || document.issuedAt)
          settlementFail(
            409,
            "IMMUTABLE_SETTLEMENT",
            "발행된 문서는 수정할 수 없습니다.",
          );
        data = {
          title: input.data.title,
          note: input.data.note,
          dueAt: input.data.dueAt ? new Date(input.data.dueAt) : null,
          documentUrl: input.data.documentUrl
            ? new URL(input.data.documentUrl).href
            : null,
          internalNote: input.data.internalNote,
          revision: { increment: 1 },
        };
      } else if (
        input.action === "issueBrandInvoice" ||
        input.action === "issueAgencyPayout"
      ) {
        if (document.status !== "DRAFT" || document.issuedAt)
          settlementFail(
            409,
            "IMMUTABLE_SETTLEMENT",
            "미발행 초안만 발행할 수 있습니다.",
          );
        const dto = invoice
          ? adminInvoiceDto(invoice, row)
          : adminPayoutDto(payout!, row);
        if (!dto.canIssue)
          settlementFail(
            409,
            "SETTLEMENT_REQUIREMENTS",
            "문서 제목과 공개 내용을 검토해 주세요.",
          );
        data = {
          status: "ISSUED",
          issuedAt: new Date(),
          issuedById: userId,
          revision: { increment: 1 },
        };
      } else {
        if (
          document.status !== "ISSUED" ||
          !document.issuedAt ||
          document.paidAt
        )
          settlementFail(
            409,
            "PAYMENT_RECORD_NOT_ALLOWED",
            "발행 후 미처리 문서에만 외부 처리 결과를 기록할 수 있습니다.",
          );
        if (
          input.data.currency !== document.currency ||
          proposalCents(input.data.amount) !==
            proposalCents(document.amount.toFixed(2))
        )
          settlementFail(
            409,
            "AMOUNT_MISMATCH",
            "외부 처리 금액과 통화가 발행 문서와 일치해야 합니다.",
          );
        if (Date.parse(input.data.paidAt) < document.issuedAt.getTime())
          settlementFail(
            400,
            "INVALID_PAYMENT_DATE",
            "처리 시각은 문서 발행 이후여야 합니다.",
          );
        data = {
          status: "PAID",
          paidAt: new Date(input.data.paidAt),
          paidAmount: document.amount,
          paymentRecordedById: userId,
          externalPaymentReference: input.data.reference,
          internalNote: input.data.internalNote,
          revision: { increment: 1 },
        };
      }
      const changed = brandAction
        ? await tx.brandInvoice.updateMany({ where, data })
        : await tx.agencyPayout.updateMany({ where, data });
      if (changed.count !== 1)
        settlementFail(
          409,
          "STALE_SETTLEMENT",
          "다른 담당자가 정산 내역을 변경했습니다.",
        );
      await audit(tx, userId, input.action, completionId, {
        campaignId: row.id,
        documentId: document.id,
        revision: document.revision + 1,
        externalRecordOnly: true,
      });
    }
  }
  await tx.settlementMutation.create({
    data: {
      actorId: userId,
      clientRequestId: input.clientRequestId,
      action: input.action,
      payloadHash,
      campaignId: row.id,
      completionId: completionId!,
    },
  });
  return listAdminSettlement(tx, userId, row.id);
}
