import { fail } from "./access";
import type { Prisma } from "@futures-medialab/database";
import {
  originalProposalDeadline,
  requestWaitingFor,
} from "@futures-medialab/database/request-workflow";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Run inside the same authorized, serializable transaction as the campaign change. */
export async function syncCampaignIntake(
  tx: Prisma.TransactionClient,
  actorId: string,
  campaign: { id: string; brandOrganizationId: string; requirements: unknown },
  action:
    "publishCampaign" | "returnCampaign" | "closeCampaign" | "cancelCampaign",
  reason: string,
  now = new Date(),
) {
  const requirements = record(campaign.requirements);
  const intake = record(requirements.brandIntake);
  if (typeof intake.requestId !== "string") return requirements;
  const request = await tx.workspaceToolRequest.findFirst({
    where: {
      id: intake.requestId,
      campaignId: campaign.id,
      organizationId: campaign.brandOrganizationId,
    },
    select: {
      id: true,
      status: true,
      version: true,
      inputJson: true,
      dueAt: true,
      campaign: {
        select: {
          proposals: {
            where: { publishedAt: { not: null } },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!request || request.status === "CLOSED") return requirements;
  const input = record(request.inputJson);
  const originalProposalDueAt =
    typeof intake.originalProposalDueAt === "string"
      ? intake.originalProposalDueAt
      : originalProposalDeadline(input);
  const returning = action === "returnCampaign";
  const waitingFor = requestWaitingFor(
    input,
    request.status,
    Boolean(request.campaign?.proposals?.length),
  );
  const preserveWait = !returning && request.status === "WAITING_BRAND";
  const status =
    action === "cancelCampaign"
      ? "CLOSED"
      : returning || preserveWait
        ? "WAITING_BRAND"
        : "IN_PROGRESS";
  const changed = await tx.workspaceToolRequest.updateMany({
    where: { id: request.id, version: request.version },
    data: {
      status,
      dueAt: returning || action === "cancelCampaign" ? null : request.dueAt,
      version: { increment: 1 },
      inputJson: {
        ...input,
        originalProposalDueAt,
        operatorReplyPending: false,
        waitingFor: returning ? "brief" : preserveWait ? waitingFor : null,
        ...(returning ? { proposalPausedAt: now.toISOString() } : {}),
      } as Prisma.InputJsonObject,
    },
  });
  if (changed.count !== 1)
    fail(
      409,
      "CONFLICT",
      "연결된 접수 요청이 변경되었습니다. 새로고침 후 다시 처리해 주세요.",
    );
  const body =
    action === "cancelCampaign"
      ? `운영팀이 캠페인을 취소했습니다. 제작·성과 등록을 중단하며 기존 기록은 보관됩니다.\n사유: ${reason}`
      : returning
        ? `브리프 보완이 필요합니다. 캠페인에서 내용을 수정한 후 다시 제출해 주세요. 기존 운영 기한은 중단되며 재접수 시 새 기한이 안내됩니다.\n사유: ${reason}`
        : action === "publishCampaign"
          ? `운영팀이 캠페인 검토를 마치고 소싱·모집을 시작했습니다.\n안내: ${reason}`
          : `운영팀이 소싱·모집 단계를 마감했습니다. 공식 제안과 브랜드 승인 상태는 캠페인에서 확인해 주세요.\n안내: ${reason}`;
  await tx.requestMessage.create({
    data: {
      requestId: request.id,
      authorId: actorId,
      authorRole: "ADMIN",
      internal: false,
      body,
    },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      action: "request.campaign_transition",
      entityType: "WorkspaceToolRequest",
      entityId: request.id,
      payload: {
        public: true,
        publicDetail: body,
        detail: body,
        previousStatus: request.status,
        status,
        previousDueAt: request.dueAt?.toISOString() ?? null,
        originalProposalDueAt,
      },
    },
  });
  return {
    ...requirements,
    brandIntake: {
      ...intake,
      originalProposalDueAt,
      ...(returning ? { proposalPausedAt: now.toISOString() } : {}),
    },
  };
}
