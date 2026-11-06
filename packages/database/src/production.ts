import { createHash } from "node:crypto";
import { ensureCampaignReportingItems } from "@futures-medialab/database/reporting";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  adminProductionMutationSchema,
  agencyProductionMutationSchema,
  brandProductionMutationSchema,
} from "@futures-medialab/database/production-validation";
import type {
  AdminProductionItem,
  AdminProductionMutation,
  AdminProductionResponse,
  AgencyProductionItem,
  AgencyProductionMutation,
  AgencyProductionResponse,
  BrandProductionItem,
  BrandProductionMutation,
  ProductionStatus,
} from "@futures-medialab/database/production-types";

export class ProductionError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function productionFail(
  status: number,
  code: string,
  message: string,
): never {
  throw new ProductionError(status, code, message);
}
type Tx = Prisma.TransactionClient;
type OrganizationActor = { userId: string; organizationId: string };
export type ProductionActor = {
  userId: string;
  sessionId: string;
  kind: "admin" | "brand" | "agency";
  organizationId?: string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const managers = ["OWNER", "ADMIN"];
const activeStatuses = ["IN_PROGRESS", "VERIFYING"];
const validDate = (value: unknown) =>
  typeof value === "string" &&
  Boolean(value) &&
  Number.isFinite(Date.parse(value));
function profileReady(type: string, raw: unknown) {
  const metadata = object(raw);
  if (metadata.testWorkspaceAccess === true) return true;
  if (type === "BRAND") return validDate(metadata.profileCompletedAt);
  const profile = object(metadata.agencyProfile);
  const fields = [
    "organizationName",
    "address",
    "countryCode",
    "establishedOn",
    "contactValue",
    "scopeOfBusiness",
    "platformContact",
    "businessDocumentId",
  ];
  return (
    validDate(metadata.agencyProfileSubmittedAt) &&
    fields.every(
      (key) =>
        typeof profile[key] === "string" &&
        Boolean(String(profile[key]).trim()),
    ) &&
    ["agency", "studio"].includes(String(profile.agencyType)) &&
    (profile.agencyType !== "agency" || Boolean(profile.businessLicenseId))
  );
}
export async function requireProductionMember(
  tx: Tx,
  actor: OrganizationActor,
  kind: "BRAND" | "AGENCY",
  write = false,
) {
  const member = await tx.organizationMember.findFirst({
    where: {
      userId: actor.userId,
      organizationId: actor.organizationId,
      organization: { type: kind, status: "ACTIVE" },
    },
    select: { role: true, organization: { select: { metadata: true } } },
  });
  if (!member || !profileReady(kind, member.organization.metadata))
    productionFail(403, "FORBIDDEN", "승인된 조직의 권한이 필요합니다.");
  if (write && !managers.includes(member.role))
    productionFail(
      403,
      "FORBIDDEN",
      "소유자 또는 관리자만 변경할 수 있습니다.",
    );
  return member;
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
    productionFail(403, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
}
export function productionTransaction<T>(
  actor: ProductionActor,
  run: (tx: Tx) => Promise<T>,
) {
  return getDatabase().$transaction(
    async (tx) => {
      if (
        !(await tx.session.findFirst({
          where: {
            id: actor.sessionId,
            userId: actor.userId,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }))
      )
        productionFail(401, "UNAUTHORIZED", "로그인이 만료되었습니다.");
      if (actor.kind === "admin") await requireAdmin(tx, actor.userId);
      else
        await requireProductionMember(
          tx,
          { userId: actor.userId, organizationId: actor.organizationId || "" },
          actor.kind === "brand" ? "BRAND" : "AGENCY",
        );
      return run(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 20000,
    },
  );
}
const campaignSelect = {
  id: true,
  title: true,
  status: true,
  brandOrganizationId: true,
  coverImageUrl: true,
  requirements: true,
  brandOrganization: { select: { status: true, metadata: true } },
  proposals: {
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.CampaignSelect;
const proposalItemSelect = {
  id: true,
  proposalId: true,
  status: true,
  creatorName: true,
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
} satisfies Prisma.ProposalItemSelect;
const baseSelect = {
  id: true,
  campaignId: true,
  proposalItemId: true,
  status: true,
  revision: true,
  campaign: { select: campaignSelect },
  proposalItem: { select: proposalItemSelect },
} satisfies Prisma.ProductionItemSelect;
const publicSubmissionSelect = {
  id: true,
  version: true,
  status: true,
  releasedTitle: true,
  releasedUrl: true,
  releasedNote: true,
  releasedAt: true,
  brandDecision: true,
  brandMessage: true,
  brandDecidedAt: true,
} satisfies Prisma.ProductionSubmissionSelect;
const publicSelect = {
  ...baseSelect,
  submissions: {
    where: { releasedAt: { not: null } },
    orderBy: { version: "desc" },
    select: publicSubmissionSelect,
  },
} satisfies Prisma.ProductionItemSelect;
const privateSelect = {
  ...baseSelect,
  supplierOrganizationId: true,
  supplierOrganization: {
    select: { id: true, name: true, type: true, status: true, metadata: true },
  },
  submissions: { orderBy: { version: "desc" } },
} satisfies Prisma.ProductionItemSelect;
type PublicRow = Prisma.ProductionItemGetPayload<{
  select: typeof publicSelect;
}>;
type PrivateRow = Prisma.ProductionItemGetPayload<{
  select: typeof privateSelect;
}>;
type BaseRow = Prisma.ProductionItemGetPayload<{ select: typeof baseSelect }>;
type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>;
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
function baseDto(row: BaseRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    proposalId: row.proposalItem.proposalId,
    proposalVersion: row.proposalItem.proposal.version,
    proposalItemId: row.proposalItemId,
    creatorName: row.proposalItem.creatorName,
    platform: row.proposalItem.platform,
    deliverables: row.proposalItem.deliverables,
    quantity: row.proposalItem.quantity,
    scheduledAt: row.proposalItem.scheduledAt?.toISOString() ?? null,
    rights: row.proposalItem.rights,
    status: row.status,
    revision: row.revision,
    ...artwork(row.campaign),
  };
}
function activeProblem(row: BaseRow): string | null {
  if (
    row.campaign.brandOrganization.status !== "ACTIVE" ||
    !activeStatuses.includes(row.campaign.status)
  )
    return "현재 캠페인 단계에서는 콘텐츠를 변경할 수 없습니다.";
  const proposal = row.proposalItem.proposal;
  if (
    proposal.campaignId !== row.campaignId ||
    proposal.status !== "APPROVED" ||
    !proposal.publishedAt ||
    proposal.supersededAt ||
    row.proposalItem.status !== "APPROVED" ||
    row.campaign.proposals[0]?.id !== proposal.id
  )
    return "현재 승인된 공식 제안 항목만 제작할 수 있습니다.";
  return null;
}
function brandDto(row: PublicRow, canManage: boolean): BrandProductionItem {
  const active = activeProblem(row);
  const problem =
    active ||
    (row.status !== "BRAND_REVIEW"
      ? "운영팀이 공개한 최신 검수본의 검토 차례에 결정할 수 있습니다."
      : !canManage
        ? "소유자 또는 관리자만 검수 결과를 결정할 수 있습니다."
        : null);
  const submissions = row.submissions.map((submission, index) => {
    const isLatest =
      index === 0 &&
      ["BRAND_REVIEW", "BRAND_REVISION", "APPROVED"].includes(row.status);
    const reason = !isLatest
      ? "이전 검수 버전입니다."
      : submission.brandDecision
        ? "이미 검수 결과를 기록한 버전입니다."
        : problem;
    return {
      id: submission.id,
      version: submission.version,
      status: submission.status,
      title: submission.releasedTitle || "",
      url: submission.releasedUrl || "",
      note: submission.releasedNote || "",
      releasedAt: submission.releasedAt!.toISOString(),
      brandDecision: submission.brandDecision,
      brandMessage: submission.brandMessage,
      brandDecidedAt: submission.brandDecidedAt?.toISOString() ?? null,
      isLatest,
      canRespond: !reason,
      responseDisabledReason: reason,
    };
  });
  const latestSubmission = submissions[0] ?? null;
  return {
    ...baseDto(row),
    submissions,
    latestSubmission,
    canRespond: latestSubmission?.canRespond ?? false,
    responseDisabledReason:
      latestSubmission?.responseDisabledReason ??
      problem ??
      "아직 공개된 검수본이 없습니다.",
  };
}
function agencySubmissionDto(submission: PrivateRow["submissions"][number]) {
  return {
    id: submission.id,
    version: submission.version,
    status: submission.status,
    title: submission.sourceTitle,
    url: submission.sourceUrl,
    note: submission.sourceNote,
    submittedAt: submission.submittedAt.toISOString(),
    agencyFeedback: submission.agencyFeedback,
    adminReviewedAt: submission.adminReviewedAt?.toISOString() ?? null,
    releasedTitle: submission.releasedTitle,
    releasedUrl: submission.releasedUrl,
    releasedNote: submission.releasedNote,
    releasedAt: submission.releasedAt?.toISOString() ?? null,
    brandDecision: submission.brandDecision,
    brandMessage: submission.brandMessage,
    brandDecidedAt: submission.brandDecidedAt?.toISOString() ?? null,
  };
}
function agencyDto(row: PrivateRow, canManage: boolean): AgencyProductionItem {
  const supplier = row.supplierOrganization;
  const problem =
    activeProblem(row) ||
    (!supplier ||
    supplier.status !== "ACTIVE" ||
    supplier.type !== "AGENCY" ||
    !profileReady("AGENCY", supplier.metadata)
      ? "승인된 수행 조직이 지정되어야 합니다."
      : !["AWAITING_SUBMISSION", "AGENCY_REVISION", "BRAND_REVISION"].includes(
            row.status,
          )
        ? "현재 검토가 끝난 뒤 다음 버전을 제출할 수 있습니다."
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
function adminDto(row: PrivateRow): AdminProductionItem {
  const problem =
    activeProblem(row) ||
    (row.status !== "ADMIN_REVIEW" ||
    !row.submissions[0] ||
    row.submissions[0].status !== "ADMIN_REVIEW"
      ? "운영 검토 대기 중인 최신 제출본만 검토할 수 있습니다."
      : null);
  const submissions = row.submissions.map((submission) => ({
    ...agencySubmissionDto(submission),
    internalNote: submission.internalNote,
  }));
  return {
    ...baseDto(row),
    isCurrent: Boolean(
      row.proposalItem.proposal.campaignId === row.campaignId &&
      row.proposalItem.proposal.publishedAt &&
      !row.proposalItem.proposal.supersededAt &&
      row.proposalItem.proposal.status === "APPROVED" &&
      row.proposalItem.status === "APPROVED" &&
      row.campaign.proposals[0]?.id === row.proposalItem.proposal.id,
    ),
    supplierOrganizationId: row.supplierOrganizationId,
    supplierName: row.supplierOrganization?.name ?? null,
    submissions,
    latestSubmission: submissions[0] ?? null,
    canAssign:
      !activeProblem(row) &&
      row.submissions.length === 0 &&
      row.status === "AWAITING_SUBMISSION",
    canReview: !problem,
    reviewDisabledReason: problem,
  };
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
  if (!row) productionFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  return row;
}
export async function listBrandProductionItems(
  tx: Tx,
  organizationId: string,
  campaignId?: string,
  canManage = false,
): Promise<BrandProductionItem[]> {
  if (campaignId) await getCampaign(tx, campaignId, organizationId);
  const rows = await tx.productionItem.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      campaign: { brandOrganizationId: organizationId },
      proposalItem: { proposal: { publishedAt: { not: null } } },
    },
    select: publicSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row) => brandDto(row, canManage));
}
export async function listAgencyProduction(
  tx: Tx,
  actor: OrganizationActor,
  campaignId?: string,
): Promise<AgencyProductionResponse> {
  const member = await requireProductionMember(tx, actor, "AGENCY");
  const rows = await tx.productionItem.findMany({
    where: {
      supplierOrganizationId: actor.organizationId,
      ...(campaignId ? { campaignId } : {}),
    },
    select: privateSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  if (campaignId && !rows.length)
    productionFail(404, "NOT_FOUND", "제작 항목을 찾을 수 없습니다.");
  const canManage = managers.includes(member.role);
  return {
    items: rows.map((row) => agencyDto(row, canManage)),
    canSubmit: canManage,
  };
}
async function approvedItems(tx: Tx, campaign: CampaignRow) {
  return tx.proposalItem.findMany({
    where: {
      status: "APPROVED",
      proposal: {
        id: campaign.proposals[0]?.id ?? "",
        campaignId: campaign.id,
        status: "APPROVED",
        publishedAt: { not: null },
        supersededAt: null,
      },
    },
    select: {
      id: true,
      supplierOrganizationId: true,
      productionItem: { select: { id: true } },
      supplierOrganization: {
        select: { type: true, status: true, metadata: true },
      },
    },
    orderBy: { position: "asc" },
  });
}
export async function listAdminProduction(
  tx: Tx,
  actorId: string,
  campaignId: string,
): Promise<AdminProductionResponse> {
  await requireAdmin(tx, actorId);
  const campaign = await getCampaign(tx, campaignId);
  const [rows, eligible, suppliers] = await Promise.all([
    tx.productionItem.findMany({
      where: { campaignId },
      select: privateSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    approvedItems(tx, campaign),
    tx.organization.findMany({
      where: { type: "AGENCY", status: "ACTIVE" },
      select: { id: true, name: true, metadata: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    campaignId,
    campaignTitle: campaign.title,
    ...artwork(campaign),
    items: rows.map(adminDto),
    eligibleApprovedItemCount:
      activeStatuses.includes(campaign.status) &&
      campaign.brandOrganization.status === "ACTIVE"
        ? eligible.length
        : 0,
    unpreparedApprovedItemCount:
      activeStatuses.includes(campaign.status) &&
      campaign.brandOrganization.status === "ACTIVE"
        ? eligible.filter((item) => !item.productionItem).length
        : 0,
    suppliers: suppliers
      .filter((supplier) => profileReady("AGENCY", supplier.metadata))
      .map(({ id, name }) => ({ id, name })),
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
    data: { actorId, action, entityType: "ProductionItem", entityId, payload },
  });
}
/** Trusted transactional helper, used after complete official-proposal approval. Does not accept supplier applications. */
export async function ensureCampaignProductionItems(
  tx: Tx,
  campaignId: string,
  actorId: string,
): Promise<number> {
  const campaign = await getCampaign(tx, campaignId);
  if (
    !activeStatuses.includes(campaign.status) ||
    campaign.brandOrganization.status !== "ACTIVE"
  )
    productionFail(
      409,
      "PRODUCTION_NOT_ACTIONABLE",
      "진행 중인 승인 캠페인에만 제작 항목을 준비할 수 있습니다.",
    );
  const eligible = await approvedItems(tx, campaign);
  let created = 0;
  for (const item of eligible) {
    if (item.productionItem) continue;
    const supplier = item.supplierOrganization;
    const assigned =
      supplier?.status === "ACTIVE" &&
      supplier.type === "AGENCY" &&
      profileReady("AGENCY", supplier.metadata)
        ? item.supplierOrganizationId
        : null;
    const saved = await tx.productionItem.create({
      data: {
        campaignId,
        proposalItemId: item.id,
        supplierOrganizationId: assigned,
        assignedById: actorId,
      },
      select: { id: true },
    });
    await audit(tx, actorId, "production.prepared", saved.id, {
      campaignId,
      proposalItemId: item.id,
      assigned: Boolean(assigned),
    });
    created++;
  }
  return created;
}
function hashMutation(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
async function replay(
  tx: Tx,
  actorId: string,
  input: { clientRequestId: string },
  hash: string,
) {
  const prior = await tx.productionMutation.findUnique({
    where: {
      actorId_clientRequestId: {
        actorId,
        clientRequestId: input.clientRequestId,
      },
    },
  });
  if (prior && prior.payloadHash !== hash)
    productionFail(
      409,
      "IDEMPOTENCY_CONFLICT",
      "같은 요청 키로 다른 내용을 전송할 수 없습니다.",
    );
  return prior;
}
async function remember(
  tx: Tx,
  actorId: string,
  input: { clientRequestId: string; action: string },
  hash: string,
  campaignId: string,
  productionItemId: string | null,
) {
  await tx.productionMutation.create({
    data: {
      actorId,
      clientRequestId: input.clientRequestId,
      action: input.action,
      payloadHash: hash,
      campaignId,
      productionItemId,
    },
  });
}
function assertRevision(row: BaseRow, expected: number) {
  if (row.revision !== expected)
    productionFail(
      409,
      "STALE_PRODUCTION",
      "제작 내역이 변경되었습니다. 새로고침 후 확인해 주세요.",
    );
}
function assertActive(row: BaseRow) {
  const problem = activeProblem(row);
  if (problem) productionFail(409, "PRODUCTION_NOT_ACTIONABLE", problem);
}
async function advance(
  tx: Tx,
  row: BaseRow,
  status: ProductionStatus,
  extra: { supplierOrganizationId?: string; assignedById?: string } = {},
) {
  const changed = await tx.productionItem.updateMany({
    where: { id: row.id, revision: row.revision, status: row.status },
    data: { status, revision: { increment: 1 }, ...extra },
  });
  if (changed.count !== 1)
    productionFail(
      409,
      "STALE_PRODUCTION",
      "다른 담당자가 제작 내역을 변경했습니다.",
    );
}
async function getPrivate(
  tx: Tx,
  id: string,
  scope: { campaignId?: string; supplierOrganizationId?: string } = {},
) {
  const row = await tx.productionItem.findFirst({
    where: { id, ...scope },
    select: privateSelect,
  });
  if (!row) productionFail(404, "NOT_FOUND", "제작 항목을 찾을 수 없습니다.");
  return row;
}
export async function applyAgencyProductionMutation(
  tx: Tx,
  actor: OrganizationActor,
  rawInput: AgencyProductionMutation,
): Promise<{ item: AgencyProductionItem }> {
  await requireProductionMember(tx, actor, "AGENCY", true);
  const parsed = agencyProductionMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "콘텐츠 제목과 공개 HTTPS 링크를 확인해 주세요.",
    );
  const input = parsed.data,
    hash = hashMutation(input);
  const row = await getPrivate(tx, input.productionItemId, {
    supplierOrganizationId: actor.organizationId,
  });
  if (await replay(tx, actor.userId, input, hash))
    return { item: agencyDto(row, true) };
  assertRevision(row, input.expectedRevision);
  assertActive(row);
  const dto = agencyDto(row, true);
  if (!dto.canSubmit)
    productionFail(409, "PRODUCTION_NOT_ACTIONABLE", dto.submitDisabledReason!);
  const version = (row.submissions[0]?.version ?? 0) + 1;
  await advance(tx, row, "ADMIN_REVIEW");
  await tx.productionSubmission.create({
    data: {
      productionItemId: row.id,
      version,
      sourceTitle: input.title,
      sourceUrl: new URL(input.url).href,
      sourceNote: input.note,
      submittedById: actor.userId,
    },
  });
  await audit(tx, actor.userId, "production.agency_submitted", row.id, {
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
export async function applyAdminProductionMutation(
  tx: Tx,
  actorId: string,
  rawInput: AdminProductionMutation,
): Promise<AdminProductionResponse> {
  await requireAdmin(tx, actorId);
  const parsed = adminProductionMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "제작 검토 내용과 공개 HTTPS 링크를 확인해 주세요.",
    );
  const input = parsed.data,
    hash = hashMutation(input);
  await getCampaign(tx, input.campaignId);
  if (await replay(tx, actorId, input, hash))
    return listAdminProduction(tx, actorId, input.campaignId);
  if (input.action === "prepare") {
    await ensureCampaignProductionItems(tx, input.campaignId, actorId);
    await remember(tx, actorId, input, hash, input.campaignId, null);
  } else {
    const row = await getPrivate(tx, input.productionItemId, {
      campaignId: input.campaignId,
    });
    assertRevision(row, input.expectedRevision);
    assertActive(row);
    if (input.action === "assign") {
      if (!adminDto(row).canAssign)
        productionFail(
          409,
          "PRODUCTION_NOT_ACTIONABLE",
          "첫 제출 전에만 수행 조직을 지정할 수 있습니다.",
        );
      const supplier = await tx.organization.findFirst({
        where: {
          id: input.supplierOrganizationId,
          type: "AGENCY",
          status: "ACTIVE",
        },
        select: { metadata: true },
      });
      if (!supplier || !profileReady("AGENCY", supplier.metadata))
        productionFail(
          409,
          "SUPPLIER_NOT_APPROVED",
          "승인된 수행 조직을 선택해 주세요.",
        );
      await advance(tx, row, "AWAITING_SUBMISSION", {
        supplierOrganizationId: input.supplierOrganizationId,
        assignedById: actorId,
      });
    } else {
      const latest = row.submissions[0];
      if (
        !adminDto(row).canReview ||
        latest?.id !== input.submissionId ||
        latest.releasedAt
      )
        productionFail(
          409,
          "PRODUCTION_NOT_ACTIONABLE",
          "운영 검토 대기 중인 최신 제출본만 검토할 수 있습니다.",
        );
      const release = input.action === "releaseToBrand";
      const status = release ? "BRAND_REVIEW" : "AGENCY_REVISION";
      await advance(tx, row, status);
      const changed = await tx.productionSubmission.updateMany({
        where: {
          id: latest.id,
          productionItemId: row.id,
          status: "ADMIN_REVIEW",
          releasedAt: null,
        },
        data: {
          status,
          adminReviewedById: actorId,
          adminReviewedAt: new Date(),
          internalNote: input.internalNote,
          ...(input.action === "releaseToBrand"
            ? {
                releasedTitle: input.title,
                releasedUrl: new URL(input.url).href,
                releasedNote: input.note,
                releasedAt: new Date(),
              }
            : { agencyFeedback: input.agencyFeedback }),
        },
      });
      if (changed.count !== 1)
        productionFail(
          409,
          "STALE_PRODUCTION",
          "제출본이 이미 검토되었습니다.",
        );
    }
    await audit(tx, actorId, `admin.production.${input.action}`, row.id, {
      campaignId: row.campaignId,
      revision: row.revision + 1,
      ...(input.action === "assign"
        ? { supplierOrganizationId: input.supplierOrganizationId }
        : { submissionId: input.submissionId }),
    });
    await remember(tx, actorId, input, hash, row.campaignId, row.id);
  }
  return listAdminProduction(tx, actorId, input.campaignId);
}
export async function applyBrandProductionMutation(
  tx: Tx,
  actor: OrganizationActor,
  rawInput: BrandProductionMutation,
): Promise<{ item: BrandProductionItem }> {
  await requireProductionMember(tx, actor, "BRAND", true);
  const parsed = brandProductionMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    productionFail(
      400,
      "INVALID_INPUT",
      "검수 결정과 수정 사유를 확인해 주세요.",
    );
  const input = parsed.data,
    hash = hashMutation(input);
  const row = await tx.productionItem.findFirst({
    where: {
      id: input.productionItemId,
      campaign: { brandOrganizationId: actor.organizationId },
    },
    select: publicSelect,
  });
  if (!row) productionFail(404, "NOT_FOUND", "제작 항목을 찾을 수 없습니다.");
  if (await replay(tx, actor.userId, input, hash))
    return { item: brandDto(row, true) };
  assertRevision(row, input.expectedRevision);
  assertActive(row);
  const latest = row.submissions[0];
  if (
    !latest ||
    latest.id !== input.submissionId ||
    !brandDto(row, true).canRespond ||
    latest.status !== "BRAND_REVIEW"
  )
    productionFail(
      409,
      "PRODUCTION_NOT_ACTIONABLE",
      "운영팀이 공개한 최신 검수본만 결정할 수 있습니다.",
    );
  const status = input.action === "approve" ? "APPROVED" : "BRAND_REVISION";
  await advance(tx, row, status);
  const changed = await tx.productionSubmission.updateMany({
    where: {
      id: latest.id,
      productionItemId: row.id,
      status: "BRAND_REVIEW",
      releasedAt: { not: null },
      brandDecision: null,
    },
    data: {
      status,
      brandDecision: input.action === "approve" ? "APPROVE" : "REQUEST_CHANGES",
      brandMessage: input.message,
      brandDecidedById: actor.userId,
      brandDecidedAt: new Date(),
    },
  });
  if (changed.count !== 1)
    productionFail(409, "STALE_PRODUCTION", "이미 검수 결과가 기록되었습니다.");
  if (input.action === "approve")
    await ensureCampaignReportingItems(tx, row.campaignId, actor.userId);
  await audit(tx, actor.userId, `production.brand_${input.action}`, row.id, {
    campaignId: row.campaignId,
    submissionId: latest.id,
    revision: row.revision + 1,
  });
  await remember(tx, actor.userId, input, hash, row.campaignId, row.id);
  const updated = (
    await listBrandProductionItems(
      tx,
      actor.organizationId,
      row.campaignId,
      true,
    )
  ).find((item) => item.id === row.id);
  if (!updated)
    productionFail(404, "NOT_FOUND", "제작 항목을 찾을 수 없습니다.");
  return { item: updated };
}
