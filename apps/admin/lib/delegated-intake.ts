import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  brandCampaignCreateSchema,
  campaignFieldsFromBrief,
  createInitialIntake,
  isFutureBrandDate,
  isValidRecruitmentDeadline,
} from "@futures-medialab/database/brand-intake";
import {
  boundary,
  fail,
  json,
  rateLimit,
  readBody,
  recheckAdmin,
  requireAdmin,
  verifyOrigin,
  type Admin,
} from "./access";
import { record, submittedProfile } from "./verification";

const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const lookupSchema = z.strictObject({
  q: z.string().trim().max(140).default(""),
  organizationId: id.optional(),
});
const submissionSchema = z.strictObject({
  organizationId: id,
  requesterId: id,
  assignToMe: z.boolean(),
  channel: z.enum(["email", "meeting", "phone", "messenger", "other"]),
  reason: z.string().trim().min(2).max(1000),
  finalAdvertiserName: z.string().trim().max(160).default(""),
  brief: brandCampaignCreateSchema,
});
type Submission = z.output<typeof submissionSchema>;
const managerRoles: ("OWNER" | "ADMIN")[] = ["OWNER", "ADMIN"];
const organizationScope = { type: "BRAND", status: "ACTIVE" } as const;
const lookupLimit = 30;

export function lookupDelegatedIntake(request: Request) {
  return boundary(async () => {
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "delegated-intake-read", 120);
    const query = lookupSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success)
      fail(400, "INVALID_INPUT", "검색 조건을 확인해 주세요.");
    const { organizationId, q } = query.data;
    const result = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        if (organizationId) {
          const org = await tx.organization.findFirst({
            where: { id: organizationId, ...organizationScope },
            select: { id: true, metadata: true },
          });
          if (!org)
            fail(404, "NOT_FOUND", "접수할 수 있는 브랜드를 찾지 못했습니다.");
          const members = await tx.organizationMember.findMany({
            where: {
              organizationId,
              role: { in: managerRoles },
              ...(q
                ? {
                    user: {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  }
                : {}),
            },
            orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
            take: lookupLimit + 1,
            select: {
              userId: true,
              role: true,
              user: { select: { name: true, email: true } },
            },
          });
          return {
            items: members.slice(0, lookupLimit).map((m) => ({
              id: m.userId,
              name: m.user.name || m.user.email,
              email: m.user.email,
              role: m.role,
            })),
            hasMore: members.length > lookupLimit,
          };
        }
        const organizations = await tx.organization.findMany({
          where: {
            ...organizationScope,
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
          select: { id: true, name: true, metadata: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: lookupLimit + 1,
        });
        return {
          items: organizations.slice(0, lookupLimit).map((org) => ({
            id: org.id,
            name: org.name,
            agencyBuyer:
              record(org.metadata).organizationType === "client_agency",
          })),
          hasMore: organizations.length > lookupLimit,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
    return json(result);
  });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function submit(
  tx: Prisma.TransactionClient,
  admin: Admin,
  input: Submission,
  now: Date,
) {
  await recheckAdmin(tx, admin);
  const { organizationId, requesterId, brief } = input;
  const member = await tx.organizationMember.findFirst({
    where: {
      organizationId,
      userId: requesterId,
      role: { in: managerRoles },
      organization: organizationScope,
    },
    select: {
      user: { select: { name: true, email: true } },
      organization: { select: { name: true, metadata: true } },
    },
  });
  if (!member)
    fail(
      409,
      "INVALID_REQUESTER",
      "승인된 브랜드의 소유자 또는 관리자를 의뢰자로 선택해 주세요.",
    );
  const metadata = record(member.organization.metadata);
  if (
    !submittedProfile("BRAND", metadata) &&
    metadata.testWorkspaceAccess !== true
  )
    fail(
      409,
      "INCOMPLETE_PROFILE",
      "브랜드의 회사 정보 제출을 먼저 완료해 주세요.",
    );
  if (
    metadata.organizationType === "client_agency" &&
    !input.finalAdvertiserName
  )
    fail(
      400,
      "MISSING_ADVERTISER",
      "광고 대행사가 의뢰하는 최종 광고주를 입력해 주세요.",
    );
  // A database primary key makes simultaneous retries harmless without a second campaign table.
  const campaignId = `delegated-${digest(`${admin.userId}:${brief.clientRequestId}`)}`;
  const payloadHash = digest(JSON.stringify(input));
  const prior = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, brandOrganizationId: true, requirements: true },
  });
  if (prior) {
    const delegation = record(record(prior.requirements).delegatedIntake);
    if (
      prior.brandOrganizationId !== organizationId ||
      delegation.payloadHash !== payloadHash ||
      typeof delegation.requestId !== "string"
    )
      fail(
        409,
        "IDEMPOTENCY_CONFLICT",
        "이 접수 번호로 다른 내용이 등록되어 있습니다. 캠페인 목록에서 기존 접수를 확인해 주세요.",
      );
    return { id: prior.id, requestId: delegation.requestId };
  }
  if (!isFutureBrandDate(brief.desiredDate, now))
    fail(400, "INVALID_DATE", "희망 게시일은 내일 이후로 선택해 주세요.");
  if (
    brief.route === "open" &&
    (!brief.applicationDeadline ||
      !isValidRecruitmentDeadline(
        brief.applicationDeadline,
        brief.desiredDate,
        now,
      ))
  )
    fail(
      400,
      "INVALID_DEADLINE",
      "모집 마감은 현재 이후, 희망 게시일 이전으로 설정해 주세요.",
    );
  if (brief.route === "managed" && brief.applicationDeadline)
    fail(
      400,
      "INVALID_DEADLINE",
      "맞춤 의뢰에는 모집 마감일을 입력할 수 없습니다.",
    );
  if (
    (await tx.campaign.count({
      where: { brandOrganizationId: organizationId },
    })) >= 100
  )
    fail(
      409,
      "LIMIT_REACHED",
      "해당 브랜드의 캠페인 등록 한도에 도달했습니다.",
    );
  const fields = campaignFieldsFromBrief(brief);
  const campaign = await tx.campaign.create({
    data: {
      id: campaignId,
      ...fields.values,
      brandOrganizationId: organizationId,
      createdById: admin.userId,
      status: "REVIEW",
    },
    select: { id: true, type: true, title: true, summary: true },
  });
  const assignedToId = input.assignToMe ? admin.userId : null;
  const intake = await createInitialIntake(tx, {
    organizationId,
    requesterId,
    actorId: admin.userId,
    assignedToId,
    delegated: true,
    campaign,
    now,
  });
  const requesterName = member.user.name?.trim() || member.user.email;
  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      requirements: {
        brandBrief: fields.brief,
        brandIntake: { schemaVersion: 1, ...intake },
        delegatedIntake: {
          requestId: intake.requestId,
          payloadHash,
          requesterName,
          registeredByName: admin.name,
          finalAdvertiserName:
            input.finalAdvertiserName || member.organization.name,
          channel: input.channel,
        },
      },
    },
  });
  await tx.auditLog.create({
    data: {
      actorId: admin.userId,
      action: "admin.campaign.delegated_intake",
      entityType: "Campaign",
      entityId: campaignId,
      payload: {
        reason: input.reason,
        organizationId,
        requesterId,
        requesterName,
        registeredById: admin.userId,
        assignedToId,
        channel: input.channel,
        finalAdvertiserName:
          input.finalAdvertiserName || member.organization.name,
        requestId: intake.requestId,
        route: brief.route,
        submittedAt: intake.submittedAt,
        proposalDueAt: intake.proposalDueAt,
      },
    },
  });
  return { id: campaignId, requestId: intake.requestId };
}

export function submitDelegatedIntake(request: Request) {
  return boundary(async () => {
    verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "delegated-intake-write", 30);
    const input = await readBody(request, submissionSchema);
    const save = () =>
      getDatabase().$transaction((tx) => submit(tx, admin, input, new Date()), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    // The pg adapter and the route can load distinct Prisma constructors.
    // Error codes remain stable across those module boundaries.
    for (let attempt = 0; ; attempt++) {
      try {
        return json(await save());
      } catch (error) {
        const code = record(error).code;
        if (code !== "P2034" && code !== "P2002") throw error;
        if (attempt >= 2)
          fail(
            409,
            "CONFLICT",
            "접수 상태가 변경되었습니다. 같은 내용으로 다시 시도해 주세요.",
          );
      }
    }
  });
}
