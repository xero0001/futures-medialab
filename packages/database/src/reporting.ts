import { createHash } from "node:crypto";
import { Prisma } from "@futures-medialab/database";
import {
  productionFail as reportingFail,
  requireProductionMember,
} from "@futures-medialab/database/production";
import {
  adminReportingMutationSchema,
  agencyReportingMutationSchema,
  reportingMetricKeys,
} from "@futures-medialab/database/reporting-validation";
import type {
  AdminReportingItem,
  AdminReportingMutation,
  AdminReportingResponse,
  AgencyReportingItem,
  AgencyReportingMutation,
  AgencyReportingResponse,
  BrandReportingItem,
  BrandReportingSubmission,
  ReportingMetrics,
  ReportingSnapshot,
  ReportingStatus,
} from "@futures-medialab/database/reporting-types";

export {
  ProductionError as ReportingError,
  productionTransaction as reportingTransaction,
} from "@futures-medialab/database/production";
type Tx = Prisma.TransactionClient;
type Actor = { userId: string; organizationId: string };
const activeStatuses = ["IN_PROGRESS", "VERIFYING"];
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const campaignSelect = {
  type: true,
  id: true,
  title: true,
  status: true,
  brandOrganizationId: true,
  coverImageUrl: true,
  requirements: true,
  brandOrganization: { select: { status: true } },
  proposals: {
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.CampaignSelect;
const productionSelect = {
  id: true,
  campaignId: true,
  status: true,
  proposalItemId: true,
  submissions: {
    where: { brandDecision: "APPROVE", releasedAt: { not: null } },
    orderBy: { version: "desc" },
    take: 1,
    select: { releasedUrl: true },
  },
  proposalItem: {
    select: {
      id: true,
      status: true,
      proposalId: true,
      creatorName: true,
      channelUrl: true,
      channelLabel: true,
      platform: true,
      deliverables: true,
      quantity: true,
      scheduledAt: true,
      rights: true,
      proposal: {
        select: {
          id: true,
          campaignId: true,
          version: true,
          status: true,
          publishedAt: true,
          supersededAt: true,
        },
      },
    },
  },
} satisfies Prisma.ProductionItemSelect;
const baseSelect = {
  id: true,
  campaignId: true,
  productionItemId: true,
  status: true,
  revision: true,
  campaign: { select: campaignSelect },
  productionItem: { select: productionSelect },
} satisfies Prisma.ReportingItemSelect;
const releasedSelect = {
  id: true,
  version: true,
  releasedTitle: true,
  releasedPostUrl: true,
  releasedPublishedAt: true,
  releasedMetricsAsOf: true,
  releasedMetrics: true,
  releasedEvidenceUrl: true,
  releasedNote: true,
  releasedAt: true,
} satisfies Prisma.ReportingSubmissionSelect;
// Source URLs, counters, notes, submitter IDs, feedback and supplier fields are never selected for brand reads.
const publicSelect = {
  ...baseSelect,
  submissions: {
    where: {
      releasedAt: { not: null },
      releasedPublishedAt: { not: null },
      releasedPostUrl: { not: null },
    },
    orderBy: { version: "desc" },
    select: releasedSelect,
  },
} satisfies Prisma.ReportingItemSelect;
const privateSelect = {
  ...baseSelect,
  productionItem: {
    select: {
      ...productionSelect,
      supplierOrganizationId: true,
      supplierOrganization: {
        select: { id: true, name: true, status: true, type: true },
      },
    },
  },
  submissions: { orderBy: { version: "desc" } },
} satisfies Prisma.ReportingItemSelect;
type BaseRow = Prisma.ReportingItemGetPayload<{ select: typeof baseSelect }>;
type PublicRow = Prisma.ReportingItemGetPayload<{
  select: typeof publicSelect;
}>;
type PrivateRow = Prisma.ReportingItemGetPayload<{
  select: typeof privateSelect;
}>;
type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>;
type ReleasedRow = Prisma.ReportingSubmissionGetPayload<{
  select: typeof releasedSelect;
}>;
function artwork(campaign: {
  coverImageUrl: string | null;
  requirements: unknown;
}) {
  const requirements = object(campaign.requirements),
    game = object(requirements.game);
  const demo =
    requirements.demo === true &&
    requirements.seed === "official-proposals-nte-v1";
  return {
    coverImageUrl:
      demo && campaign.coverImageUrl === "/demo/nte/city-key-art.jpg"
        ? campaign.coverImageUrl
        : null,
    gameIconUrl:
      demo && game.iconUrl === "/demo/nte/game-icon.png" ? game.iconUrl : null,
    gameName:
      demo && typeof game.name === "string" ? game.name.slice(0, 120) : null,
    gameSourceUrl:
      demo && game.sourceUrl === "https://nte.perfectworld.com/kr/"
        ? game.sourceUrl
        : null,
  };
}
function current(row: BaseRow): boolean {
  const production = row.productionItem,
    item = production.proposalItem,
    proposal = item.proposal;
  return (
    production.campaignId === row.campaignId &&
    production.status === "APPROVED" &&
    item.status === "APPROVED" &&
    proposal.campaignId === row.campaignId &&
    ["PUBLISHED", "APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
      proposal.status,
    ) &&
    Boolean(proposal.publishedAt) &&
    !proposal.supersededAt &&
    row.campaign.proposals[0]?.id === proposal.id
  );
}
function activeProblem(row: BaseRow): string | null {
  if (
    !activeStatuses.includes(row.campaign.status) ||
    row.campaign.brandOrganization.status !== "ACTIVE"
  )
    return "현재 캠페인 단계에서는 게시·성과를 변경할 수 없습니다.";
  if (!current(row))
    return "현재 공식 제안에 속한 콘텐츠 승인 항목만 게시·성과를 등록할 수 있습니다.";
  return null;
}
function baseDto(row: BaseRow) {
  const item = row.productionItem.proposalItem;
  return {
    id: row.id,
    productionItemId: row.productionItemId,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    proposalId: item.proposalId,
    proposalVersion: item.proposal.version,
    proposalItemId: item.id,
    creatorName: item.creatorName,
    channelUrl: item.channelUrl,
    channelLabel: item.channelLabel,
    productionVideoUrl:
      row.productionItem.submissions?.[0]?.releasedUrl ?? null,
    platform: item.platform,
    deliverables: item.deliverables,
    quantity: item.quantity,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    rights: item.rights,
    status: row.status,
    revision: row.revision,
    isCurrent: current(row),
    ...artwork(row.campaign),
  };
}
function metricsDto(raw: unknown): ReportingMetrics {
  const value = object(raw);
  return Object.fromEntries(
    reportingMetricKeys.map((key) => {
      const counter = value[key];
      return [
        key,
        typeof counter === "number" &&
        Number.isSafeInteger(counter) &&
        counter >= 0
          ? counter
          : null,
      ];
    }),
  ) as ReportingMetrics;
}
function releasedSnapshot(row: ReleasedRow): ReportingSnapshot | null {
  if (!row.releasedAt || !row.releasedPublishedAt || !row.releasedPostUrl)
    return null;
  return {
    title: row.releasedTitle ?? "",
    postUrl: row.releasedPostUrl,
    publishedAt: row.releasedPublishedAt.toISOString(),
    metricsAsOf: row.releasedMetricsAsOf?.toISOString() ?? null,
    metrics: metricsDto(row.releasedMetrics),
    evidenceUrl: row.releasedEvidenceUrl,
    note: row.releasedNote ?? "",
  };
}
function brandDto(row: PublicRow): BrandReportingItem {
  const submissions = row.submissions.flatMap((submission, index) => {
    const snapshot = releasedSnapshot(submission);
    return snapshot
      ? [
          {
            ...snapshot,
            id: submission.id,
            version: submission.version,
            releasedAt: submission.releasedAt!.toISOString(),
            isLatest: index === 0,
          },
        ]
      : [];
  });
  // Public v1 remains latest while private v2 is awaiting operator review.
  return {
    ...baseDto(row),
    submissions,
    latestSubmission: submissions[0] ?? null,
  };
}
function agencySubmissionDto(row: PrivateRow["submissions"][number]) {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.sourceTitle,
    postUrl: row.sourcePostUrl,
    publishedAt: row.sourcePublishedAt.toISOString(),
    metricsAsOf: row.sourceMetricsAsOf?.toISOString() ?? null,
    metrics: metricsDto(row.sourceMetrics),
    evidenceUrl: row.sourceEvidenceUrl,
    note: row.sourceNote,
    submittedAt: row.submittedAt.toISOString(),
    agencyFeedback: row.agencyFeedback,
    adminReviewedAt: row.adminReviewedAt?.toISOString() ?? null,
    releasedSnapshot: releasedSnapshot(row),
    releasedAt: row.releasedAt?.toISOString() ?? null,
  };
}
function agencyDto(row: PrivateRow, canManage: boolean): AgencyReportingItem {
  const supplier = row.productionItem.supplierOrganization;
  const problem =
    activeProblem(row) ||
    (!supplier || supplier.type !== "AGENCY" || supplier.status !== "ACTIVE"
      ? "승인된 수행 조직이 지정되어야 합니다."
      : !["AWAITING_SUBMISSION", "AGENCY_REVISION", "PUBLISHED"].includes(
            row.status,
          )
        ? "운영 검토가 끝난 뒤 다음 성과 버전을 제출할 수 있습니다."
        : !canManage
          ? "소유자 또는 관리자만 제출할 수 있습니다."
          : row.submissions.length >= 100
            ? "제출 버전 한도에 도달했습니다. 운영팀에 문의해 주세요."
            : null);
  const submissions = row.submissions.map(agencySubmissionDto);
  return {
    ...baseDto(row),
    submissions,
    latestSubmission: submissions[0] ?? null,
    canSubmit: !problem,
    submitDisabledReason: problem,
  };
}
function adminSubmitProblem(row: PrivateRow): string | null {
  return (
    activeProblem(row) ||
    (row.submissions.length >= 100 ? "제출 버전 한도에 도달했습니다." : null)
  );
}
function adminDto(row: PrivateRow): AdminReportingItem {
  const problem =
    activeProblem(row) ||
    (row.status !== "ADMIN_REVIEW" ||
    row.submissions[0]?.status !== "ADMIN_REVIEW"
      ? "운영 검토 대기 중인 최신 제출본만 검토할 수 있습니다."
      : null);
  const submissions = row.submissions.map((submission) => ({
    ...agencySubmissionDto(submission),
    internalNote: submission.internalNote,
  }));
  return {
    ...baseDto(row),
    isManaged: row.campaign.type === "MANAGED",
    canSubmit: !adminSubmitProblem(row),
    submitDisabledReason: adminSubmitProblem(row),
    supplierOrganizationId: row.productionItem.supplierOrganizationId,
    supplierName: row.productionItem.supplierOrganization?.name ?? null,
    submissions,
    latestSubmission: submissions[0] ?? null,
    canReview: !problem,
    reviewDisabledReason: problem,
  };
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
    reportingFail(403, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
}
async function getCampaign(
  tx: Tx,
  campaignId: string,
  organizationId?: string,
) {
  const row = await tx.campaign.findFirst({
    where: {
      id: campaignId,
      ...(organizationId ? { brandOrganizationId: organizationId } : {}),
    },
    select: campaignSelect,
  });
  if (!row) reportingFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  return row;
}
export async function listBrandReportingItems(
  tx: Tx,
  organizationId: string,
  campaignId?: string,
): Promise<BrandReportingItem[]> {
  if (campaignId) await getCampaign(tx, campaignId, organizationId);
  const rows = await tx.reportingItem.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      campaign: { brandOrganizationId: organizationId },
      productionItem: {
        proposalItem: { proposal: { publishedAt: { not: null } } },
      },
    },
    select: publicSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map(brandDto);
}
/** Sort by publication time, including older versions already released to this brand. */
export async function listBrandDocumentReports(
  tx: Tx,
  organizationId: string,
  campaignId?: string,
  limit = 101,
): Promise<
  Array<{
    campaignId: string;
    campaignTitle: string;
    creatorName: string;
    platform: string;
    submission: BrandReportingSubmission;
  }>
> {
  const published = {
    releasedAt: { not: null },
    releasedPublishedAt: { not: null },
    releasedPostUrl: { not: null },
  } satisfies Prisma.ReportingSubmissionWhereInput;
  const rows = await tx.reportingSubmission.findMany({
    where: {
      ...published,
      reportingItem: {
        ...(campaignId ? { campaignId } : {}),
        campaign: { brandOrganizationId: organizationId },
        productionItem: {
          proposalItem: {
            proposal: { publishedAt: { not: null }, status: { not: "DRAFT" } },
          },
        },
      },
    },
    orderBy: [{ releasedAt: "desc" }, { id: "asc" }],
    take: Math.min(501, Math.max(1, limit)),
    select: {
      ...releasedSelect,
      reportingItem: {
        select: {
          ...baseSelect,
          submissions: {
            where: published,
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  return rows.flatMap((row) => {
    const snapshot = releasedSnapshot(row);
    const production = row.reportingItem.productionItem;
    if (
      !snapshot ||
      production.campaignId !== row.reportingItem.campaignId ||
      production.proposalItem.proposal.campaignId !==
        row.reportingItem.campaignId
    )
      return [];
    const item = baseDto(row.reportingItem);
    return [
      {
        campaignId: item.campaignId,
        campaignTitle: item.campaignTitle,
        creatorName: item.creatorName,
        platform: item.platform,
        submission: {
          ...snapshot,
          id: row.id,
          version: row.version,
          releasedAt: row.releasedAt!.toISOString(),
          isLatest: row.reportingItem.submissions[0]?.id === row.id,
        },
      },
    ];
  });
}

export async function listAgencyReporting(
  tx: Tx,
  actor: Actor,
  campaignId?: string,
): Promise<AgencyReportingResponse> {
  const member = await requireProductionMember(tx, actor, "AGENCY");
  const rows = await tx.reportingItem.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      productionItem: { supplierOrganizationId: actor.organizationId },
    },
    select: privateSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  if (campaignId && !rows.length)
    reportingFail(404, "NOT_FOUND", "게시·성과 항목을 찾을 수 없습니다.");
  const canSubmit = member.role !== "MEMBER";
  return { items: rows.map((row) => agencyDto(row, canSubmit)), canSubmit };
}
async function approvedProduction(tx: Tx, campaign: CampaignRow) {
  return tx.productionItem.findMany({
    where: {
      campaignId: campaign.id,
      status: "APPROVED",
      proposalItem: {
        status: "APPROVED",
        proposal: {
          id: campaign.proposals[0]?.id ?? "",
          campaignId: campaign.id,
          status: {
            in: ["PUBLISHED", "APPROVED", "CHANGES_REQUESTED", "REJECTED"],
          },
          publishedAt: { not: null },
          supersededAt: null,
        },
      },
    },
    select: { id: true, reportingItem: { select: { id: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}
export async function listAdminReporting(
  tx: Tx,
  actorId: string,
  campaignId: string,
): Promise<AdminReportingResponse> {
  await requireAdmin(tx, actorId);
  const campaign = await getCampaign(tx, campaignId);
  const [rows, eligible] = await Promise.all([
    tx.reportingItem.findMany({
      where: { campaignId },
      select: privateSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    approvedProduction(tx, campaign),
  ]);
  const canPrepare =
    activeStatuses.includes(campaign.status) &&
    campaign.brandOrganization.status === "ACTIVE";
  return {
    campaignId,
    campaignTitle: campaign.title,
    ...artwork(campaign),
    items: rows.map(adminDto),
    eligibleApprovedItemCount: canPrepare ? eligible.length : 0,
    unpreparedApprovedItemCount: canPrepare
      ? eligible.filter((item) => !item.reportingItem).length
      : 0,
  };
}
async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  payload: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType: "ReportingItem", entityId, payload },
  });
}
/** Trusted helper for the content-approval transaction and explicit administrator backfill. Never used by GET. */
export async function ensureCampaignReportingItems(
  tx: Tx,
  campaignId: string,
  actorId: string,
): Promise<number> {
  const campaign = await getCampaign(tx, campaignId);
  if (
    !activeStatuses.includes(campaign.status) ||
    campaign.brandOrganization.status !== "ACTIVE"
  )
    reportingFail(
      409,
      "REPORTING_NOT_ACTIONABLE",
      "진행 중인 승인 캠페인에만 게시·성과 항목을 준비할 수 있습니다.",
    );
  const eligible = await approvedProduction(tx, campaign);
  let count = 0;
  for (const item of eligible) {
    if (item.reportingItem) continue;
    const saved = await tx.reportingItem.create({
      data: { campaignId, productionItemId: item.id },
      select: { id: true },
    });
    await audit(tx, actorId, "reporting.prepared", saved.id, {
      campaignId,
      productionItemId: item.id,
    });
    count++;
  }
  return count;
}
function mutationHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
async function previousMutation(
  tx: Tx,
  actorId: string,
  input: { clientRequestId: string },
  hash: string,
) {
  const row = await tx.reportingMutation.findUnique({
    where: {
      actorId_clientRequestId: {
        actorId,
        clientRequestId: input.clientRequestId,
      },
    },
  });
  if (row && row.payloadHash !== hash)
    reportingFail(
      409,
      "IDEMPOTENCY_CONFLICT",
      "같은 요청 키로 다른 내용을 전송할 수 없습니다.",
    );
  return row;
}
async function remember(
  tx: Tx,
  actorId: string,
  input: { clientRequestId: string; action: string },
  hash: string,
  campaignId: string,
  reportingItemId: string | null,
) {
  await tx.reportingMutation.create({
    data: {
      actorId,
      clientRequestId: input.clientRequestId,
      action: input.action,
      payloadHash: hash,
      campaignId,
      reportingItemId,
    },
  });
}
async function getPrivate(
  tx: Tx,
  id: string,
  scope: { campaignId?: string; supplierOrganizationId?: string } = {},
) {
  const row = await tx.reportingItem.findFirst({
    where: {
      id,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
      ...(scope.supplierOrganizationId
        ? {
            productionItem: {
              supplierOrganizationId: scope.supplierOrganizationId,
            },
          }
        : {}),
    },
    select: privateSelect,
  });
  if (!row)
    reportingFail(404, "NOT_FOUND", "게시·성과 항목을 찾을 수 없습니다.");
  return row;
}
function assertActionable(row: BaseRow, revision: number) {
  if (row.revision !== revision)
    reportingFail(
      409,
      "STALE_REPORTING",
      "게시·성과 내역이 변경되었습니다. 새로고침 후 확인해 주세요.",
    );
  const problem = activeProblem(row);
  if (problem) reportingFail(409, "REPORTING_NOT_ACTIONABLE", problem);
}
async function advance(tx: Tx, row: BaseRow, status: ReportingStatus) {
  const updated = await tx.reportingItem.updateMany({
    where: { id: row.id, revision: row.revision, status: row.status },
    data: { status, revision: { increment: 1 } },
  });
  if (updated.count !== 1)
    reportingFail(
      409,
      "STALE_REPORTING",
      "다른 담당자가 게시·성과 내역을 변경했습니다.",
    );
}
function sourceData(snapshot: ReportingSnapshot) {
  return {
    sourceTitle: snapshot.title,
    sourcePostUrl: new URL(snapshot.postUrl).href,
    sourcePublishedAt: new Date(snapshot.publishedAt),
    sourceMetricsAsOf: snapshot.metricsAsOf
      ? new Date(snapshot.metricsAsOf)
      : null,
    sourceMetrics: snapshot.metrics,
    sourceEvidenceUrl: snapshot.evidenceUrl
      ? new URL(snapshot.evidenceUrl).href
      : null,
    sourceNote: snapshot.note,
  };
}
function releasedData(snapshot: ReportingSnapshot) {
  return {
    releasedTitle: snapshot.title,
    releasedPostUrl: new URL(snapshot.postUrl).href,
    releasedPublishedAt: new Date(snapshot.publishedAt),
    releasedMetricsAsOf: snapshot.metricsAsOf
      ? new Date(snapshot.metricsAsOf)
      : null,
    releasedMetrics: snapshot.metrics,
    releasedEvidenceUrl: snapshot.evidenceUrl
      ? new URL(snapshot.evidenceUrl).href
      : null,
    releasedNote: snapshot.note,
    releasedAt: new Date(),
  };
}
export async function applyAgencyReportingMutation(
  tx: Tx,
  actor: Actor,
  rawInput: AgencyReportingMutation,
): Promise<{ item: AgencyReportingItem }> {
  await requireProductionMember(tx, actor, "AGENCY", true);
  const parsed = agencyReportingMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    reportingFail(
      400,
      "INVALID_INPUT",
      "게시 링크, 게시·집계 시각과 성과 지표를 확인해 주세요.",
    );
  const input = parsed.data,
    hash = mutationHash(input);
  const row = await getPrivate(tx, input.reportingItemId, {
    supplierOrganizationId: actor.organizationId,
  });
  if (await previousMutation(tx, actor.userId, input, hash))
    return { item: agencyDto(row, true) };
  assertActionable(row, input.expectedRevision);
  const dto = agencyDto(row, true);
  if (!dto.canSubmit)
    reportingFail(409, "REPORTING_NOT_ACTIONABLE", dto.submitDisabledReason!);
  const version = (row.submissions[0]?.version ?? 0) + 1;
  await advance(tx, row, "ADMIN_REVIEW");
  await tx.reportingSubmission.create({
    data: {
      reportingItemId: row.id,
      version,
      ...sourceData(input.data),
      submittedById: actor.userId,
    },
  });
  await audit(tx, actor.userId, "reporting.agency_submitted", row.id, {
    campaignId: row.campaignId,
    version,
  });
  await remember(tx, actor.userId, input, hash, row.campaignId, row.id);
  return {
    item: agencyDto(
      await getPrivate(tx, row.id, {
        supplierOrganizationId: actor.organizationId,
      }),
      true,
    ),
  };
}
export async function applyAdminReportingMutation(
  tx: Tx,
  actorId: string,
  rawInput: AdminReportingMutation,
): Promise<AdminReportingResponse> {
  await requireAdmin(tx, actorId);
  const parsed = adminReportingMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    reportingFail(
      400,
      "INVALID_INPUT",
      "게시 링크, 게시·집계 시각과 성과 지표를 확인해 주세요.",
    );
  const input = parsed.data,
    hash = mutationHash(input);
  await getCampaign(tx, input.campaignId);
  if (await previousMutation(tx, actorId, input, hash))
    return listAdminReporting(tx, actorId, input.campaignId);
  if (input.action === "prepare") {
    await ensureCampaignReportingItems(tx, input.campaignId, actorId);
    await remember(tx, actorId, input, hash, input.campaignId, null);
  } else {
    const row = await getPrivate(tx, input.reportingItemId, {
      campaignId: input.campaignId,
    });
    assertActionable(row, input.expectedRevision);
    if (input.action === "submit") {
      const problem = adminSubmitProblem(row);
      if (problem) reportingFail(409, "REPORTING_NOT_ACTIONABLE", problem);
      const version = (row.submissions[0]?.version ?? 0) + 1;
      await advance(tx, row, "ADMIN_REVIEW");
      await tx.reportingSubmission.create({
        data: {
          reportingItemId: row.id,
          version,
          ...sourceData(input.data),
          submittedById: actorId,
        },
      });
      await audit(tx, actorId, "admin.reporting.submit", row.id, {
        campaignId: row.campaignId,
        version,
        revision: row.revision + 1,
      });
      await remember(tx, actorId, input, hash, row.campaignId, row.id);
      return listAdminReporting(tx, actorId, input.campaignId);
    }
    const latest = row.submissions[0];
    if (
      !adminDto(row).canReview ||
      latest?.id !== input.submissionId ||
      latest.releasedAt
    )
      reportingFail(
        409,
        "REPORTING_NOT_ACTIONABLE",
        "운영 검토 대기 중인 최신 제출본만 검토할 수 있습니다.",
      );
    const status =
      input.action === "releaseToBrand" ? "PUBLISHED" : "AGENCY_REVISION";
    await advance(tx, row, status);
    const reviewed = await tx.reportingSubmission.updateMany({
      where: {
        id: latest.id,
        reportingItemId: row.id,
        status: "ADMIN_REVIEW",
        releasedAt: null,
      },
      data: {
        status,
        adminReviewedById: actorId,
        adminReviewedAt: new Date(),
        internalNote: input.internalNote,
        ...(input.action === "releaseToBrand"
          ? releasedData(input.data)
          : { agencyFeedback: input.agencyFeedback }),
      },
    });
    if (reviewed.count !== 1)
      reportingFail(409, "STALE_REPORTING", "이미 검토된 제출본입니다.");
    await audit(tx, actorId, `admin.reporting.${input.action}`, row.id, {
      campaignId: row.campaignId,
      submissionId: latest.id,
      version: latest.version,
      revision: row.revision + 1,
    });
    await remember(tx, actorId, input, hash, row.campaignId, row.id);
  }
  return listAdminReporting(tx, actorId, input.campaignId);
}
