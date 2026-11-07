import { z } from "zod";
import type { Prisma } from "@prisma/client";

const unique = (values: string[]) => new Set(values).size === values.length;
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
export const brandBriefSchema = z.object({
  // Older briefs and delegated intakes may not have a separate game name.
  gameId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(120).nullable().default(null),
  gameLocale: z.enum(["ko", "en", "zh"]).default("ko"),
  gameName: z.string().trim().max(120).default(""),
  genre: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(1000),
  contentFormat: z.string().trim().min(1).max(160),
  creatorCount: z.number().int().min(1).max(100),
  desiredDate: dateOnly,
  note: z.string().trim().max(2000).default(""),
  compositionPreference: z
    .enum(["balanced", "reach", "efficient"])
    .nullable()
    .default(null),
});
export const brandCampaignCreateSchema = brandBriefSchema
  .extend({
    title: z.string().trim().min(2).max(160),
    budgetAmount: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0 && Number(value) <= 10_000_000),
    currency: z.enum(["USD", "KRW", "CNY"]),
    platforms: z
      .array(
        z.enum([
          "youtube",
          "chzzk",
          "soop",
          "tiktok",
          "instagram",
          "twitch",
          "x",
          "facebook",
          "recommend",
        ]),
      )
      .min(1)
      .max(9)
      .refine(unique)
      .refine((values) => !values.includes("recommend") || values.length === 1),
    regions: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(40)
      .refine(unique)
      .default([]),
    route: z.enum(["managed", "open"]),
    clientRequestId: z.uuid(),
    applicationDeadline: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export function isFutureBrandDate(value: string, now = new Date()) {
  // Date-only requests are interpreted in the workspace's Korean business timezone.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return value > today;
}

export type BrandIntakeBrief = z.output<typeof brandCampaignCreateSchema>;

export function campaignFieldsFromBrief(input: BrandIntakeBrief) {
  const {
    gameId,
    gameLocale,
    gameName,
    genre,
    goal,
    contentFormat,
    creatorCount,
    desiredDate,
    note,
    compositionPreference,
  } = input;
  const brief = {
    gameId,
    gameLocale,
    gameName,
    genre,
    goal,
    contentFormat,
    creatorCount,
    desiredDate,
    note,
    compositionPreference,
  };
  const summary = [
    goal,
    [gameName, genre, contentFormat, creatorCount > 0 ? `희망 ${creatorCount}명` : ""]
      .filter(Boolean)
      .join(" · "),
    note,
  ]
    .filter(Boolean)
    .join("\n\n");
  const values = {
    gameId,
    title: input.title,
    summary,
    type:
      input.route === "managed"
        ? ("MANAGED" as const)
        : ("OPEN_BIDDING" as const),
    currency: input.currency,
    budgetAmount: input.budgetAmount || null,
    platforms: input.platforms,
    regions: input.regions,
    contentDeadline: desiredDate
      ? new Date(`${desiredDate}T00:00:00.000Z`)
      : null,
    applicationDeadline:
      input.route === "open" && input.applicationDeadline
        ? new Date(input.applicationDeadline)
        : null,
  };
  return { brief, values };
}

export function isValidRecruitmentDeadline(
  deadline: string,
  desiredDate?: string,
  now = new Date(),
) {
  const time = Date.parse(deadline);
  return (
    time > now.getTime() &&
    (!desiredDate || time < Date.parse(`${desiredDate}T00:00:00.000+09:00`))
  );
}

export async function createInitialIntake(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    requesterId: string;
    actorId: string;
    assignedToId?: string | null;
    delegated?: boolean;
    campaign: { id: string; title: string; summary: string; type: string };
    now: Date;
  },
) {
  const { campaign, now } = input;
  const dueAt =
    campaign.type === "MANAGED"
      ? new Date(now.getTime() + 48 * 60 * 60 * 1000)
      : null;
  const submittedAt = now.toISOString(),
    proposalDueAt = dueAt?.toISOString() ?? null;
  const request = await tx.workspaceToolRequest.create({
    data: {
      organizationId: input.organizationId,
      userId: input.requesterId,
      campaignId: campaign.id,
      ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
      tool: "campaign",
      title: `${campaign.title} · 캠페인 의뢰`.slice(0, 160),
      inputJson: {
        input: campaign.summary,
        kind: "campaign-intake",
        waitingFor: null,
        operatorReplyPending: false,
        originalProposalDueAt: proposalDueAt,
        firstSubmittedAt: submittedAt,
        submittedAt,
        route: campaign.type === "MANAGED" ? "managed" : "open",
      },
      status: "REQUESTED",
      dueAt,
    },
    select: { id: true },
  });
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "request.created",
      entityType: "WorkspaceToolRequest",
      entityId: request.id,
      payload: {
        public: true,
        publicDetail: input.delegated
          ? "운영팀이 브랜드의 캠페인 의뢰를 대리 접수했습니다."
          : "캠페인 의뢰가 접수되었습니다.",
        detail: input.delegated
          ? "운영팀 대리 접수"
          : "브랜드 캠페인 의뢰 접수",
      },
    },
  });
  return {
    requestId: request.id,
    submittedAt,
    proposalDueAt,
    originalProposalDueAt: proposalDueAt,
  };
}
