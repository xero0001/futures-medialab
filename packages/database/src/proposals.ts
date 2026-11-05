import { createHash } from "node:crypto";
import { ensureCampaignProductionItems } from "@futures-medialab/database/production";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  adminProposalMutationSchema,
  brandProposalMutationSchema,
  proposalAmount,
  proposalCents,
  publicChannelUrl,
} from "@futures-medialab/database/proposal-validation";
import type {
  AdminProposal,
  AdminProposalMutation,
  AdminProposalsResponse,
  BrandProposal,
  BrandProposalMutation,
  BrandProposalSummary,
  ProposalDraftInput,
  ProposalItemStatus,
} from "@futures-medialab/database/proposal-types";

export class ProposalError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function proposalFail(
  status: number,
  code: string,
  message: string,
): never {
  throw new ProposalError(status, code, message);
}
type Tx = Prisma.TransactionClient;
export type ProposalActor = {
  userId: string;
  sessionId: string;
  kind: "admin" | "brand";
  organizationId?: string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const activeCampaignStatuses = ["REVIEW", "RECRUITING", "IN_PROGRESS"];
const publicSelect = {
  id: true,
  campaignId: true,
  version: true,
  revision: true,
  status: true,
  title: true,
  summary: true,
  changeSummary: true,
  terms: true,
  currency: true,
  expiresAt: true,
  publishedAt: true,
  supersededAt: true,
  campaign: {
    select: { id: true, title: true, status: true, brandOrganizationId: true },
  },
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      creatorName: true,
      platform: true,
      channelLabel: true,
      channelUrl: true,
      followers: true,
      averageViews: true,
      deliverables: true,
      quantity: true,
      unitAmount: true,
      scheduledAt: true,
      rights: true,
      status: true,
    },
  },
  decisions: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      decision: true,
      itemIds: true,
      message: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CampaignProposalSelect;
const adminInclude = {
  campaign: {
    include: {
      brandOrganization: { select: { id: true, status: true, metadata: true } },
    },
  },
  items: { orderBy: { position: "asc" } },
  decisions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.CampaignProposalInclude;
type PublicRow = Prisma.CampaignProposalGetPayload<{
  select: typeof publicSelect;
}>;
type AdminRow = Prisma.CampaignProposalGetPayload<{
  include: typeof adminInclude;
}>;

export async function requireProposalAdmin(tx: Tx, userId: string) {
  const member = await tx.organizationMember.findFirst({
    where: {
      userId,
      role: { in: ["OWNER", "ADMIN"] },
      organization: { type: "PLATFORM", status: "ACTIVE" },
    },
    select: { organizationId: true, role: true },
  });
  if (!member)
    proposalFail(403, "FORBIDDEN", "플랫폼 관리자 권한이 필요합니다.");
  return member;
}
export async function requireProposalBrand(
  tx: Tx,
  userId: string,
  organizationId: string,
  write = false,
) {
  const member = await tx.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      organization: { type: "BRAND", status: "ACTIVE" },
    },
    select: { role: true, organization: { select: { metadata: true } } },
  });
  if (!member)
    proposalFail(403, "FORBIDDEN", "승인된 브랜드 조직의 권한이 필요합니다.");
  const metadata = object(member.organization.metadata),
    completed = text(metadata.profileCompletedAt);
  if (
    metadata.testWorkspaceAccess !== true &&
    (!completed || !Number.isFinite(Date.parse(completed)))
  )
    proposalFail(403, "PROFILE_REQUIRED", "브랜드 정보를 먼저 등록해 주세요.");
  if (write && member.role === "MEMBER")
    proposalFail(
      403,
      "FORBIDDEN",
      "제안 결정은 소유자 또는 관리자만 할 수 있습니다.",
    );
  return member;
}
export function proposalTransaction<T>(
  actor: ProposalActor,
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
        proposalFail(401, "UNAUTHORIZED", "로그인이 만료되었습니다.");
      if (actor.kind === "admin") await requireProposalAdmin(tx, actor.userId);
      else
        await requireProposalBrand(
          tx,
          actor.userId,
          actor.organizationId || "",
        );
      return run(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 20000,
    },
  );
}
const itemCents = (item: {
  quantity: number;
  unitAmount: { toFixed(n: number): string } | null;
}) =>
  item.unitAmount
    ? proposalCents(item.unitAmount.toFixed(2)) * BigInt(item.quantity)
    : 0n;
function responseProblem(
  row: PublicRow,
  isLatest: boolean,
  canManage: boolean,
  now = new Date(),
): string | null {
  if (!row.publishedAt || row.status === "DRAFT")
    return "아직 발행되지 않은 제안입니다.";
  if (!isLatest || row.status === "SUPERSEDED" || row.supersededAt)
    return "새 버전으로 대체된 제안입니다. 최신 제안을 확인해 주세요.";
  if (!activeCampaignStatuses.includes(row.campaign.status))
    return "현재 캠페인 단계에서는 제안을 결정할 수 없습니다.";
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime())
    return "제안 유효기간이 지났습니다. 운영팀에 새 제안을 요청해 주세요.";
  if (!row.items.some((item) => item.status === "PENDING"))
    return "모든 항목에 대한 결정이 기록되었습니다.";
  if (!canManage) return "소유자 또는 관리자만 제안을 결정할 수 있습니다.";
  return null;
}
function publicDto(
  row: PublicRow,
  isLatest: boolean,
  canManage: boolean,
): BrandProposal {
  if (!row.publishedAt || row.status === "DRAFT")
    proposalFail(404, "NOT_FOUND", "공개된 제안을 찾을 수 없습니다.");
  const responseDisabledReason = responseProblem(row, isLatest, canManage);
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    version: row.version,
    revision: row.revision,
    status: row.status,
    title: row.title,
    summary: row.summary,
    changeSummary: row.changeSummary,
    terms: row.terms,
    currency: row.currency,
    totalAmount: proposalAmount(
      row.items.reduce((total, item) => total + itemCents(item), 0n),
    ),
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isLatest,
    canRespond: responseDisabledReason === null,
    responseDisabledReason,
    items: row.items.map((item) => ({
      id: item.id,
      creatorName: item.creatorName,
      platform: item.platform,
      channelLabel: item.channelLabel,
      channelUrl: item.channelUrl,
      followers: item.followers,
      averageViews: item.averageViews,
      deliverables: item.deliverables,
      quantity: item.quantity,
      unitAmount: item.unitAmount?.toFixed(2) ?? "",
      totalAmount: proposalAmount(itemCents(item)),
      scheduledAt: item.scheduledAt?.toISOString() ?? null,
      rights: item.rights,
      status: item.status,
    })),
    decisions: row.decisions.map((decision) => ({
      id: decision.id,
      decision: decision.decision,
      itemIds: decision.itemIds,
      message: decision.message,
      createdAt: decision.createdAt.toISOString(),
    })),
  };
}
export function summarizeBrandProposal(
  proposal: BrandProposal,
): BrandProposalSummary {
  return {
    id: proposal.id,
    campaignId: proposal.campaignId,
    campaignTitle: proposal.campaignTitle,
    version: proposal.version,
    revision: proposal.revision,
    status: proposal.status,
    title: proposal.title,
    publishedAt: proposal.publishedAt,
    expiresAt: proposal.expiresAt,
    totalAmount: proposal.totalAmount,
    currency: proposal.currency,
    canRespond: proposal.canRespond,
    pendingItemCount: proposal.items.filter((item) => item.status === "PENDING")
      .length,
  };
}
export async function listBrandCampaignProposals(
  tx: Tx,
  organizationId: string,
  campaignId: string,
  canManage: boolean,
): Promise<BrandProposal[]> {
  const rows = await tx.campaignProposal.findMany({
    where: {
      campaignId,
      publishedAt: { not: null },
      campaign: { brandOrganizationId: organizationId },
    },
    orderBy: { version: "desc" },
    take: 100,
    select: publicSelect,
  });
  const latestId = rows[0]?.id;
  return rows.map((row) => publicDto(row, row.id === latestId, canManage));
}
export async function listBrandLatestProposals(
  tx: Tx,
  organizationId: string,
  campaignIds: string[],
  canManage: boolean,
): Promise<BrandProposal[]> {
  if (!campaignIds.length) return [];
  const rows = await tx.campaignProposal.findMany({
    where: {
      campaignId: { in: campaignIds },
      publishedAt: { not: null },
      supersededAt: null,
      status: { not: "SUPERSEDED" },
      campaign: { brandOrganizationId: organizationId },
    },
    orderBy: [{ campaignId: "asc" }, { version: "desc" }],
    distinct: ["campaignId"],
    select: publicSelect,
  });
  return rows.map((row) => publicDto(row, true, canManage));
}
/** Published versions for the brand document library; never enables decisions. */
export async function listBrandDocumentProposals(
  tx: Tx,
  organizationId: string,
  campaignId?: string,
  limit = 101,
): Promise<BrandProposal[]> {
  const rows = await tx.campaignProposal.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      publishedAt: { not: null },
      status: { not: "DRAFT" },
      campaign: { brandOrganizationId: organizationId },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: Math.min(501, Math.max(1, limit)),
    select: publicSelect,
  });
  return rows.map((row) => publicDto(row, !row.supersededAt && row.status !== "SUPERSEDED", false));
}

export async function getBrandProposal(
  tx: Tx,
  organizationId: string,
  proposalId: string,
  canManage: boolean,
): Promise<BrandProposal> {
  const row = await tx.campaignProposal.findFirst({
    where: {
      id: proposalId,
      publishedAt: { not: null },
      campaign: { brandOrganizationId: organizationId },
    },
    select: publicSelect,
  });
  if (!row) proposalFail(404, "NOT_FOUND", "공개된 제안을 찾을 수 없습니다.");
  const latest = await tx.campaignProposal.findFirst({
    where: {
      campaignId: row.campaignId,
      publishedAt: { not: null },
      campaign: { brandOrganizationId: organizationId },
    },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return publicDto(row, latest?.id === row.id, canManage);
}
function demoChannelAllowed(row: AdminRow, value: string): boolean {
  const requirements = object(row.campaign.requirements);
  return (
    requirements.demo === true &&
    requirements.seed === "official-proposals-nte-v1" &&
    object(row.campaign.brandOrganization.metadata).testWorkspaceAccess ===
      true &&
    /^https:\/\/example\.invalid\/nte-demo\/[a-z0-9-]+$/.test(value)
  );
}
export function proposalPublicationProblems(
  row: AdminRow,
  now = new Date(),
): string[] {
  const problems: string[] = [];
  if (row.status !== "DRAFT" || row.publishedAt)
    problems.push("미발행 초안만 발행할 수 있습니다.");
  if (!activeCampaignStatuses.includes(row.campaign.status))
    problems.push("캠페인이 제안 가능한 단계가 아닙니다.");
  if (row.campaign.brandOrganization.status !== "ACTIVE")
    problems.push("브랜드 조직의 승인이 필요합니다.");
  if (row.currency !== row.campaign.currency)
    problems.push("캠페인과 제안의 통화를 일치시켜 주세요.");
  if (!row.title.trim() || !row.summary.trim() || !row.terms.trim())
    problems.push("제목, 제안 설명, 공통 조건을 작성해 주세요.");
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime())
    problems.push("현재 이후의 제안 유효기간을 지정해 주세요.");
  if (!row.items.length) problems.push("제안 항목을 한 개 이상 추가해 주세요.");
  row.items.forEach((item, index) => {
    const label = `${index + 1}번 항목`;
    if (!item.creatorName.trim() || !item.platform || !item.channelLabel.trim())
      problems.push(`${label}: 크리에이터와 채널 정보를 작성해 주세요.`);
    if (
      !publicChannelUrl(item.channelUrl, item.platform) &&
      !demoChannelAllowed(row, item.channelUrl)
    )
      problems.push(
        `${label}: 해당 플랫폼의 공개 HTTPS 채널 주소가 필요합니다.`,
      );
    if (!item.deliverables.trim() || !item.rights.trim())
      problems.push(`${label}: 제작 범위와 사용권 조건을 작성해 주세요.`);
    if (
      item.quantity < 1 ||
      !item.unitAmount ||
      proposalCents(item.unitAmount.toFixed(2)) <= 0n
    )
      problems.push(`${label}: 수량과 단가는 0보다 커야 합니다.`);
    if (
      !item.scheduledAt ||
      item.scheduledAt.getTime() <= now.getTime() ||
      (row.expiresAt && item.scheduledAt <= row.expiresAt)
    )
      problems.push(
        `${label}: 게시 일정은 현재 및 제안 유효기간 이후로 지정해 주세요.`,
      );
  });
  const total = row.items.reduce((sum, item) => sum + itemCents(item), 0n);
  if (total >= 10n ** 18n)
    problems.push("제안 총액이 허용 범위를 초과했습니다.");
  if (
    row.campaign.budgetAmount &&
    total > proposalCents(row.campaign.budgetAmount.toFixed(2))
  )
    problems.push(
      "제안 총액이 캠페인 예산을 초과합니다. 예산을 먼저 확인해 주세요.",
    );
  return problems;
}
function adminDto(
  row: AdminRow,
  latestPublishedId: string | undefined,
): AdminProposal {
  const problems = proposalPublicationProblems(row);
  const base =
    row.publishedAt && row.status !== "DRAFT"
      ? publicDto(row, row.id === latestPublishedId, true)
      : null;
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    version: row.version,
    revision: row.revision,
    status: row.status,
    title: row.title,
    summary: row.summary,
    changeSummary: row.changeSummary,
    terms: row.terms,
    currency: row.currency,
    totalAmount: proposalAmount(
      row.items.reduce((sum, item) => sum + itemCents(item), 0n),
    ),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isLatest: row.id === latestPublishedId,
    items: row.items.map((item) => ({
      id: item.id,
      creatorName: item.creatorName,
      platform: item.platform,
      channelLabel: item.channelLabel,
      channelUrl: item.channelUrl,
      followers: item.followers,
      averageViews: item.averageViews,
      deliverables: item.deliverables,
      quantity: item.quantity,
      unitAmount: item.unitAmount?.toFixed(2) ?? "",
      totalAmount: proposalAmount(itemCents(item)),
      scheduledAt: item.scheduledAt?.toISOString() ?? null,
      rights: item.rights,
      status: item.status,
      creatorId: item.creatorId,
      supplierOrganizationId: item.supplierOrganizationId,
      supplierCost: item.supplierCost?.toFixed(2) ?? null,
      internalNotes: item.internalNotes,
    })),
    decisions:
      base?.decisions ??
      row.decisions.map((decision) => ({
        id: decision.id,
        decision: decision.decision,
        itemIds: decision.itemIds,
        message: decision.message,
        createdAt: decision.createdAt.toISOString(),
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canEdit:
      row.status === "DRAFT" &&
      !row.publishedAt &&
      !["CANCELED", "COMPLETED"].includes(row.campaign.status),
    canPublish: problems.length === 0,
    publishProblems: problems,
  };
}
async function getAdminProposal(
  tx: Tx,
  campaignId: string,
  proposalId: string,
): Promise<AdminProposal> {
  const row = await tx.campaignProposal.findFirst({
    where: { id: proposalId, campaignId },
    include: adminInclude,
  });
  if (!row) proposalFail(404, "NOT_FOUND", "제안을 찾을 수 없습니다.");
  const latest = await tx.campaignProposal.findFirst({
    where: { campaignId, publishedAt: { not: null } },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return adminDto(row, latest?.id);
}
export async function listAdminProposals(
  tx: Tx,
  actorId: string,
  campaignId: string,
): Promise<AdminProposalsResponse> {
  await requireProposalAdmin(tx, actorId);
  const campaign = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      currency: true,
      budgetAmount: true,
      brandOrganization: { select: { status: true } },
    },
  });
  if (!campaign) proposalFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  const [rows, creators] = await Promise.all([
    tx.campaignProposal.findMany({
      where: { campaignId },
      orderBy: { version: "desc" },
      take: 100,
      include: adminInclude,
    }),
    tx.creatorProfile.findMany({
      where: {
        isActive: true,
        agencyOrganization: { status: "ACTIVE" },
        applications: {
          some: {
            application: {
              campaignId,
              status: { in: ["SHORTLISTED", "ACCEPTED"] },
            },
          },
        },
      },
      orderBy: { displayName: "asc" },
      take: 200,
      select: {
        id: true,
        displayName: true,
        channels: true,
        agencyOrganization: { select: { name: true } },
      },
    }),
  ]);
  const latestPublishedId = rows.find((row) => row.publishedAt)?.id;
  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      type: campaign.type,
      status: campaign.status,
      currency: campaign.currency,
      budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
      brandActive: campaign.brandOrganization.status === "ACTIVE",
    },
    proposals: rows.map((row) => adminDto(row, latestPublishedId)),
    creators: creators.map((creator) => ({
      id: creator.id,
      displayName: creator.displayName,
      agencyName: creator.agencyOrganization.name,
      channels: (Array.isArray(creator.channels) ? creator.channels : [])
        .map((channel) => {
          const entry = object(channel);
          return {
            platform: text(entry.platform),
            name: text(entry.name) || text(entry.handle) || creator.displayName,
            url: text(entry.url) || text(entry.channelUrl),
            followers:
              typeof entry.followers === "number" &&
              Number.isSafeInteger(entry.followers) &&
              entry.followers >= 0
                ? entry.followers
                : null,
          };
        })
        .filter((channel) => Boolean(channel.platform && channel.url)),
    })),
  };
}
async function validateCreator(tx: Tx, campaignId: string, creatorId: string) {
  const creator = await tx.creatorProfile.findFirst({
    where: {
      id: creatorId,
      isActive: true,
      agencyOrganization: { status: "ACTIVE" },
      applications: {
        some: {
          application: {
            campaignId,
            status: { in: ["SHORTLISTED", "ACCEPTED"] },
          },
        },
      },
    },
    select: { agencyOrganizationId: true },
  });
  if (!creator)
    proposalFail(
      409,
      "CREATOR_NOT_SHORTLISTED",
      "해당 캠페인에 검토 후보로 등록된 활성 크리에이터를 선택해 주세요.",
    );
  return creator;
}
async function draftItems(
  tx: Tx,
  campaignId: string,
  data: ProposalDraftInput,
) {
  return Promise.all(
    data.items.map(async (item, position) => {
      const creator = item.creatorId
        ? await validateCreator(tx, campaignId, item.creatorId)
        : null;
      return {
        position,
        creatorId: item.creatorId,
        supplierOrganizationId: creator?.agencyOrganizationId ?? null,
        creatorName: item.creatorName,
        platform: item.platform,
        channelLabel: item.channelLabel,
        channelUrl: item.channelUrl,
        followers: item.followers,
        averageViews: item.averageViews,
        deliverables: item.deliverables,
        quantity: item.quantity,
        unitAmount: item.unitAmount || null,
        scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
        rights: item.rights,
        supplierCost: item.supplierCost,
        internalNotes: item.internalNotes,
      };
    }),
  );
}
const mutationHash = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
async function previousMutation(
  tx: Tx,
  actorId: string,
  clientRequestId: string,
  hash: string,
) {
  const existing = await tx.proposalMutation.findUnique({
    where: { actorId_clientRequestId: { actorId, clientRequestId } },
    select: { proposalId: true, payloadHash: true },
  });
  if (existing && existing.payloadHash !== hash)
    proposalFail(
      409,
      "DUPLICATE_REQUEST",
      "이미 다른 작업에 사용된 요청입니다. 새로고침 후 다시 시도해 주세요.",
    );
  return existing;
}
async function saveMutation(
  tx: Tx,
  actorId: string,
  input: { action: string; clientRequestId: string },
  hash: string,
  proposalId: string,
) {
  await tx.proposalMutation.create({
    data: {
      actorId,
      clientRequestId: input.clientRequestId,
      action: input.action,
      payloadHash: hash,
      proposalId,
    },
  });
}
async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  proposalId: string,
  payload: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "CampaignProposal",
      entityId: proposalId,
      payload,
    },
  });
}
async function updateIntake(
  tx: Tx,
  actorId: string,
  campaign: { id: string; brandOrganizationId: string; requirements: unknown },
  status: string,
  body: string,
  authorRole: "ADMIN" | "BRAND",
) {
  const requestId = text(
    object(object(campaign.requirements).brandIntake).requestId,
  );
  if (!requestId) return;
  const intake = await tx.workspaceToolRequest.findFirst({
    where: {
      id: requestId,
      campaignId: campaign.id,
      organizationId: campaign.brandOrganizationId,
    },
    select: { id: true, status: true, version: true },
  });
  if (!intake) return;
  await tx.requestMessage.create({
    data: { requestId, authorId: actorId, body, authorRole, internal: false },
  });
  if (intake.status !== "CLOSED") {
    const updated = await tx.workspaceToolRequest.updateMany({
      where: {
        id: intake.id,
        organizationId: campaign.brandOrganizationId,
        campaignId: campaign.id,
        version: intake.version,
      },
      data: { status, dueAt: null, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      proposalFail(
        409,
        "CONFLICT",
        "연결된 요청이 변경되었습니다. 다시 확인해 주세요.",
      );
  }
}

// Trusted transaction-level cores are also used by the explicit internal demo seed.
// HTTP adapters always add live-session and same-origin checks before calling them.
export async function applyAdminProposalMutation(
  tx: Tx,
  actorId: string,
  rawInput: AdminProposalMutation,
): Promise<{ proposal: AdminProposal }> {
  await requireProposalAdmin(tx, actorId);
  const parsed = adminProposalMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    proposalFail(400, "INVALID_INPUT", "제안 입력값을 확인해 주세요.");
  const input = parsed.data,
    hash = mutationHash(input);
  const campaign = await tx.campaign.findUnique({
    where: { id: input.campaignId },
    include: { brandOrganization: { select: { status: true } } },
  });
  if (!campaign) proposalFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  const replay = await previousMutation(
    tx,
    actorId,
    input.clientRequestId,
    hash,
  );
  if (replay)
    return {
      proposal: await getAdminProposal(tx, campaign.id, replay.proposalId),
    };
  if (["CANCELED", "COMPLETED"].includes(campaign.status))
    proposalFail(
      409,
      "INVALID_STATE",
      "종료된 캠페인의 제안은 변경할 수 없습니다.",
    );
  let proposalId: string;
  if (input.action === "createDraft") {
    const existing = await tx.campaignProposal.findFirst({
      where: { campaignId: campaign.id, status: "DRAFT" },
      select: { id: true },
    });
    if (existing) proposalId = existing.id;
    else {
      const last = await tx.campaignProposal.findFirst({
        where: { campaignId: campaign.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      if ((last?.version ?? 0) >= 100)
        proposalFail(409, "LIMIT_REACHED", "제안 버전 한도에 도달했습니다.");
      const source = input.sourceProposalId
        ? await tx.campaignProposal.findFirst({
            where: {
              id: input.sourceProposalId,
              campaignId: campaign.id,
              publishedAt: { not: null },
            },
            include: { items: { orderBy: { position: "asc" } } },
          })
        : null;
      if (input.sourceProposalId && !source)
        proposalFail(404, "NOT_FOUND", "복사할 공개 제안을 찾을 수 없습니다.");
      const created = await tx.campaignProposal.create({
        data: {
          campaignId: campaign.id,
          createdById: actorId,
          version: (last?.version ?? 0) + 1,
          currency: campaign.currency,
          title: source?.title ?? `${campaign.title} · 공식 제안`,
          summary: source?.summary ?? "",
          terms: source?.terms ?? "",
          changeSummary: "",
          expiresAt: null,
          ...(source
            ? {
                items: {
                  create: source.items.map((item) => ({
                    position: item.position,
                    creatorName: item.creatorName,
                    platform: item.platform,
                    channelLabel: item.channelLabel,
                    channelUrl: item.channelUrl,
                    followers: item.followers,
                    averageViews: item.averageViews,
                    deliverables: item.deliverables,
                    quantity: item.quantity,
                    unitAmount: item.unitAmount,
                    scheduledAt: item.scheduledAt,
                    rights: item.rights,
                    creatorId: item.creatorId,
                    supplierOrganizationId: item.supplierOrganizationId,
                    supplierCost: item.supplierCost,
                    internalNotes: item.internalNotes,
                  })),
                },
              }
            : {}),
        },
        select: { id: true },
      });
      proposalId = created.id;
      await audit(tx, actorId, "admin.proposal.draft_created", proposalId, {
        campaignId: campaign.id,
        version: (last?.version ?? 0) + 1,
      });
    }
  } else {
    const row = await tx.campaignProposal.findFirst({
      where: { id: input.proposalId, campaignId: campaign.id },
      include: adminInclude,
    });
    if (!row) proposalFail(404, "NOT_FOUND", "제안을 찾을 수 없습니다.");
    if (
      row.status !== "DRAFT" ||
      row.publishedAt ||
      row.revision !== input.expectedRevision
    )
      proposalFail(
        409,
        "STALE_PROPOSAL",
        "최신 미발행 초안만 변경할 수 있습니다. 새로고침해 주세요.",
      );
    proposalId = row.id;
    if (input.action === "saveDraft") {
      const items = await draftItems(tx, campaign.id, input.data);
      const updated = await tx.campaignProposal.updateMany({
        where: {
          id: row.id,
          status: "DRAFT",
          revision: input.expectedRevision,
          publishedAt: null,
        },
        data: {
          title: input.data.title,
          summary: input.data.summary,
          changeSummary: input.data.changeSummary,
          terms: input.data.terms,
          expiresAt: input.data.expiresAt
            ? new Date(input.data.expiresAt)
            : null,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        proposalFail(
          409,
          "STALE_PROPOSAL",
          "다른 담당자가 초안을 변경했습니다.",
        );
      await tx.proposalItem.deleteMany({ where: { proposalId: row.id } });
      if (items.length)
        await tx.proposalItem.createMany({
          data: items.map((item) => ({ ...item, proposalId: row.id })),
        });
      await audit(tx, actorId, "admin.proposal.draft_saved", row.id, {
        campaignId: campaign.id,
        version: row.version,
        revision: input.expectedRevision + 1,
      });
    } else {
      const problems = proposalPublicationProblems(row);
      if (problems.length)
        proposalFail(409, "PUBLICATION_REQUIREMENTS", problems.join(" "));
      for (const item of row.items)
        if (item.creatorId)
          await validateCreator(tx, campaign.id, item.creatorId);
      const now = new Date();
      await tx.campaignProposal.updateMany({
        where: {
          campaignId: campaign.id,
          publishedAt: { not: null },
          supersededAt: null,
        },
        data: {
          status: "SUPERSEDED",
          supersededAt: now,
          revision: { increment: 1 },
        },
      });
      const published = await tx.campaignProposal.updateMany({
        where: {
          id: row.id,
          status: "DRAFT",
          revision: input.expectedRevision,
          publishedAt: null,
        },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          publishedById: actorId,
          revision: { increment: 1 },
        },
      });
      if (published.count !== 1)
        proposalFail(
          409,
          "STALE_PROPOSAL",
          "다른 담당자가 초안을 변경했습니다.",
        );
      await updateIntake(
        tx,
        actorId,
        campaign,
        "WAITING_BRAND",
        `공식 제안 v${row.version}이 발행되었습니다. 캠페인의 제안·승인 화면에서 항목별 조건을 확인해 주세요. 최초 제안 대기 일정은 종료되었습니다.`,
        "ADMIN",
      );
      await audit(tx, actorId, "admin.proposal.published", row.id, {
        campaignId: campaign.id,
        version: row.version,
        revision: input.expectedRevision + 1,
        totalAmount: proposalAmount(
          row.items.reduce((sum, item) => sum + itemCents(item), 0n),
        ),
        currency: row.currency,
      });
    }
  }
  await saveMutation(tx, actorId, input, hash, proposalId);
  return { proposal: await getAdminProposal(tx, campaign.id, proposalId) };
}

export async function applyBrandProposalDecision(
  tx: Tx,
  actor: { userId: string; organizationId: string },
  rawInput: BrandProposalMutation,
): Promise<{ proposal: BrandProposal }> {
  await requireProposalBrand(tx, actor.userId, actor.organizationId, true);
  const parsed = brandProposalMutationSchema.safeParse(rawInput);
  if (!parsed.success)
    proposalFail(400, "INVALID_INPUT", "선택 항목과 사유를 확인해 주세요.");
  const input = parsed.data,
    hash = mutationHash({ ...input, itemIds: [...input.itemIds].sort() });
  const row = await tx.campaignProposal.findFirst({
    where: {
      id: input.proposalId,
      publishedAt: { not: null },
      campaign: { brandOrganizationId: actor.organizationId },
    },
    select: publicSelect,
  });
  if (!row) proposalFail(404, "NOT_FOUND", "공개된 제안을 찾을 수 없습니다.");
  const replay = await previousMutation(
    tx,
    actor.userId,
    input.clientRequestId,
    hash,
  );
  if (replay)
    return {
      proposal: await getBrandProposal(
        tx,
        actor.organizationId,
        replay.proposalId,
        true,
      ),
    };
  const latest = await tx.campaignProposal.findFirst({
    where: {
      campaignId: row.campaignId,
      publishedAt: { not: null },
      campaign: { brandOrganizationId: actor.organizationId },
    },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const problem = responseProblem(row, latest?.id === row.id, true);
  if (problem) proposalFail(409, "PROPOSAL_NOT_ACTIONABLE", problem);
  if (row.revision !== input.expectedRevision)
    proposalFail(
      409,
      "STALE_PROPOSAL",
      "제안 또는 결정 내역이 변경되었습니다. 새로고침 후 확인해 주세요.",
    );
  const selected = row.items.filter((item) => input.itemIds.includes(item.id));
  if (
    selected.length !== input.itemIds.length ||
    selected.some((item) => item.status !== "PENDING")
  )
    proposalFail(
      409,
      "INVALID_ITEMS",
      "현재 제안의 미결정 항목을 선택해 주세요.",
    );
  const status: ProposalItemStatus =
    input.decision === "APPROVE"
      ? "APPROVED"
      : input.decision === "REQUEST_CHANGES"
        ? "CHANGES_REQUESTED"
        : "REJECTED";
  const changed = await tx.proposalItem.updateMany({
    where: { proposalId: row.id, id: { in: input.itemIds }, status: "PENDING" },
    data: { status },
  });
  if (changed.count !== input.itemIds.length)
    proposalFail(409, "STALE_PROPOSAL", "항목 결정이 변경되었습니다.");
  const states = row.items.map((item) =>
    input.itemIds.includes(item.id) ? status : item.status,
  );
  const aggregate = states.every((state) => state === "APPROVED")
    ? "APPROVED"
    : states.includes("CHANGES_REQUESTED")
      ? "CHANGES_REQUESTED"
      : states.includes("REJECTED")
        ? "REJECTED"
        : "PUBLISHED";
  const updated = await tx.campaignProposal.updateMany({
    where: {
      id: row.id,
      revision: input.expectedRevision,
      supersededAt: null,
      publishedAt: { not: null },
    },
    data: { status: aggregate, revision: { increment: 1 } },
  });
  if (updated.count !== 1)
    proposalFail(409, "STALE_PROPOSAL", "제안 결정이 변경되었습니다.");
  await tx.proposalDecision.create({
    data: {
      proposalId: row.id,
      actorId: actor.userId,
      decision: input.decision,
      itemIds: input.itemIds,
      message: input.message,
    },
  });
  const campaign = await tx.campaign.findFirst({
    where: { id: row.campaignId, brandOrganizationId: actor.organizationId },
    select: { id: true, brandOrganizationId: true, requirements: true },
  });
  if (!campaign) proposalFail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
  if (aggregate === "APPROVED") {
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: "IN_PROGRESS" },
    });
    await ensureCampaignProductionItems(tx, campaign.id, actor.userId);
  }
  const label =
    input.decision === "APPROVE"
      ? "승인"
      : input.decision === "REQUEST_CHANGES"
        ? "변경 요청"
        : "반려";
  await updateIntake(
    tx,
    actor.userId,
    campaign,
    aggregate === "APPROVED"
      ? "RESOLVED"
      : aggregate === "PUBLISHED"
        ? "WAITING_BRAND"
        : "IN_PROGRESS",
    `공식 제안 v${row.version} · ${selected.map((item) => item.creatorName).join(", ")} 항목 ${label}${input.message ? `\n\n${input.message}` : ""}${aggregate === "APPROVED" ? "\n\n모든 제안 항목이 승인되어 캠페인을 진행 단계로 변경했습니다. 계약 체결이나 결제·정산을 실행하지 않습니다." : ""}`,
    "BRAND",
  );
  await audit(tx, actor.userId, "proposal.brand_decision", row.id, {
    campaignId: row.campaignId,
    version: row.version,
    revision: input.expectedRevision + 1,
    decision: input.decision,
    itemIds: input.itemIds,
    message: input.message,
    resultingStatus: aggregate,
  });
  await saveMutation(tx, actor.userId, input, hash, row.id);
  return {
    proposal: await getBrandProposal(tx, actor.organizationId, row.id, true),
  };
}
