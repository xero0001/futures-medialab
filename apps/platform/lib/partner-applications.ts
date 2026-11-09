import "server-only";
import { createHash } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  proposalAmount,
  proposalCents,
  publicChannelUrl,
} from "@futures-medialab/database/proposal-validation";
import {
  supplierRowStatus,
  supplierApplicationStatus,
} from "@futures-medialab/database/application-status";
import { authenticated, liveSession, agencyMember } from "./agency-api-access";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import { canAccessCampaign } from "./campaign-demo";
import {
  fail,
  json,
  rateLimit,
  readBody,
  verifyOrigin,
  workspaceBoundary,
} from "./workspace-api";
import {
  partnerApplicationSchema,
  partnerCreatorSchema,
  platformLabel,
} from "./partner-application-validation";
import { supplierOfferCap } from "./supplier-offer";

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown) => (typeof v === "string" ? v : "");
const applicationInclude = {
  campaign: {
    select: {
      title: true,
      status: true,
      platforms: true,
      applicationDeadline: true,
      requirements: true,
      brandOrganizationId: true,
    },
  },
  rows: {
    orderBy: { createdAt: "asc" },
    include: {
      proposalItems: {
        select: {
          status: true,
          proposal: {
            select: {
              publishedAt: true,
              supersededAt: true,
              expiresAt: true,
              status: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CampaignApplicationInclude;
type Application = Prisma.CampaignApplicationGetPayload<{
  include: typeof applicationInclude;
}>;
function applicationDto(app: Application) {
  const draftRows = record(app.rosterSnapshot).draftRows;
  const lines = app.rows.map((row) => ({
    id: row.id,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    channel: row.channelUrl,
    platform: platformLabel(row.platform),
    format: row.format,
    quantity: row.quantity,
    rate: Number(row.unitAmount.toFixed(2)),
    date: row.availableOn.toISOString().slice(0, 10),
    status: supplierRowStatus(row, app.campaign.status),
  }));
  return {
    id: app.id,
    campaignId: app.campaignId,
    title: app.campaign.title,
    currency: app.currency,
    note: app.proposal,
    updated: app.updatedAt.toISOString(),
    lines:
      app.status === "DRAFT" && Array.isArray(draftRows)
        ? draftRows.map((raw, index) => {
            const r = record(raw);
            return {
              id: `draft-${index}`,
              creatorId: text(r.creatorId),
              platform: platformLabel(text(r.platform)),
              format: text(r.format),
              quantity: Number(r.quantity),
              rate: Number(r.unitAmount),
              date: text(r.date),
              status: "draft",
            };
          })
        : lines,
    canEdit:
      app.campaign.status === "RECRUITING" &&
      Boolean(
        app.campaign.applicationDeadline &&
        app.campaign.applicationDeadline > new Date(),
      ) &&
      ["DRAFT", "SUBMITTED", "WITHDRAWN", "REJECTED"].includes(app.status) &&
      !app.rows.some((r) => r.proposalItems.length),
    status:
      app.status === "DRAFT"
        ? "draft"
        : app.status === "WITHDRAWN"
          ? "withdrawn"
          : supplierApplicationStatus(lines.map((l) => l.status)),
    platforms: app.campaign.platforms,
    supplierRateCap: supplierOfferCap(app.campaign.requirements),
    canWithdraw:
      ["DRAFT", "SUBMITTED", "SHORTLISTED"].includes(app.status) &&
      !app.rows.some((row) =>
        row.proposalItems.some((item) => item.proposal.publishedAt),
      ),
  };
}
function creatorDto(row: {
  id: string;
  displayName: string;
  channels: unknown;
  categories: string[];
  partnerProfile: unknown;
  updatedAt: Date;
}) {
  const profile = record(row.partnerProfile),
    channel = record(Array.isArray(row.channels) ? row.channels[0] : null);
  return {
    id: row.id,
    name: row.displayName,
    channels: (Array.isArray(row.channels) ? row.channels : [])
      .map(record)
      .map((c) => ({
        platform: platformLabel(text(c.platform)),
        channel: text(c.url) || text(c.channelUrl),
      })),
    channel: text(channel.url) || text(channel.channelUrl),
    platform: platformLabel(text(channel.platform)),
    genre: row.categories.join(" · "),
    followers: typeof channel.followers === "number" ? channel.followers : 0,
    format: text(profile.format) || "VOD",
    rate: typeof profile.rate === "number" ? profile.rate : 0,
    available: text(profile.available),
    acceptance: text(profile.acceptance) || "검토 가능",
    bio: text(profile.bio),
    updated: row.updatedAt.toISOString(),
    color: "#e9e3ff",
  };
}

export function partnerWorkspace(request: Request) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "partner-workspace-read", 120);
    return json(
      await getDatabase().$transaction(
        async (tx) => {
          await liveSession(tx, session);
          const member = await agencyMember(tx, session.user.id);
          const testAccess = hasApprovedTestWorkspaceAccess(
            member.organization,
          );
          const [creators, applications] = await Promise.all([
            tx.creatorProfile.findMany({
              where: {
                agencyOrganizationId: member.organizationId,
                isActive: true,
              },
              orderBy: { displayName: "asc" },
            }),
            tx.campaignApplication.findMany({
              where: {
                agencyOrganizationId: member.organizationId,
                OR: [{ rows: { some: {} } }, { status: "DRAFT" }],
              },
              include: applicationInclude,
              orderBy: { createdAt: "desc" },
            }),
          ]);
          return {
            creators: creators.map(creatorDto),
            applications: applications
              .filter((a) => canAccessCampaign(a.campaign, testAccess))
              .map(applicationDto),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 15000,
        },
      ),
    );
  });
}

export function partnerCreatorMutation(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await authenticated(request);
    await agencyMember(getDatabase(), session.user.id, true);
    await rateLimit(session.user.id, "partner-creator-write", 60);
    const input = await readBody(request, partnerCreatorSchema);
    return json(
      await getDatabase().$transaction(
        async (tx) => {
          await liveSession(tx, session);
          const member = await agencyMember(tx, session.user.id, true);
          const previous = input.id
            ? await tx.creatorProfile.findFirst({
                where: {
                  id: input.id,
                  agencyOrganizationId: member.organizationId,
                  isActive: true,
                },
              })
            : null;
          if (
            input.id &&
            (!previous ||
              previous.updatedAt.toISOString() !== input.expectedUpdatedAt)
          )
            fail(
              409,
              "CONFLICT",
              "크리에이터 정보를 새로고침한 뒤 다시 저장해 주세요.",
            );
          const channels = Array.isArray(previous?.channels)
            ? previous.channels.map(record)
            : [];
          const primary = {
            ...channels.find((c) => c.platform === input.platform),
            platform: input.platform,
            name: input.name,
            url: input.channel,
            followers: input.followers,
          };
          const values = {
            displayName: input.name,
            categories: [input.genre],
            channels: [
              primary,
              ...channels.filter((c) => c.platform !== input.platform),
            ] as Prisma.InputJsonValue,
            partnerProfile: {
              format: input.format,
              rate: input.rate,
              available: input.available,
              acceptance: input.acceptance,
              bio: input.bio,
            },
          };
          const creator = previous
            ? await tx.creatorProfile.update({
                where: { id: previous.id },
                data: values,
              })
            : await tx.creatorProfile.create({
                data: {
                  ...values,
                  agencyOrganizationId: member.organizationId,
                },
              });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "partner.creator.saved",
              entityType: "CreatorProfile",
              entityId: creator.id,
            },
          });
          return { creator: creatorDto(creator) };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      ),
    );
  });
}

export function agencyApplications(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await authenticated(request);
    await agencyMember(getDatabase(), session.user.id, true);
    await rateLimit(session.user.id, "agency-apply", 30);
    const input = await readBody(request, partnerApplicationSchema);
    const result = await getDatabase().$transaction(
      async (tx) => {
        await liveSession(tx, session);
        const member = await agencyMember(tx, session.user.id, true);
        const testAccess = hasApprovedTestWorkspaceAccess(member.organization);
        if (input.action === "withdraw") {
          const app = await tx.campaignApplication.findFirst({
            where: {
              id: input.applicationId,
              agencyOrganizationId: member.organizationId,
            },
            include: applicationInclude,
          });
          if (
            !app ||
            !canAccessCampaign(app.campaign, testAccess) ||
            !applicationDto(app).canWithdraw
          )
            fail(
              409,
              "INVALID_STATE",
              "현재 신청은 철회할 수 없습니다. 공개 제안에 포함된 경우 운영팀에 문의해 주세요.",
            );
          // Also preserve older applications linked through their creator records.
          const linked = await tx.proposalItem.count({
            where: {
              proposal: {
                campaignId: app.campaignId,
                publishedAt: { not: null },
              },
              creator: { applications: { some: { applicationId: app.id } } },
            },
          });
          if (linked)
            fail(
              409,
              "LOCKED",
              "공개 제안에 포함된 신청입니다. 운영팀에 문의해 주세요.",
            );
          await tx.campaignApplication.update({
            where: { id: app.id },
            data: {
              status: "WITHDRAWN",
              rows: {
                updateMany: { where: {}, data: { status: "WITHDRAWN" } },
              },
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "application.withdrawn",
              entityType: "CampaignApplication",
              entityId: app.id,
            },
          });
          return { id: app.id };
        }
        const campaign = await tx.campaign.findFirst({
          where: {
            id: input.campaignId,
            type: "OPEN_BIDDING",
            brandOrganization: { type: "BRAND", status: "ACTIVE" },
          },
        });
        if (!campaign || !canAccessCampaign(campaign, testAccess))
          fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
        const hash = createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex");
        const existing = await tx.campaignApplication.findUnique({
          where: {
            campaignId_agencyOrganizationId: {
              campaignId: campaign.id,
              agencyOrganizationId: member.organizationId,
            },
          },
        });
        if (existing?.submissionKey === input.clientRequestId) {
          if (existing.submissionHash !== hash)
            fail(409, "CONFLICT", "이미 다른 내용으로 처리한 요청입니다.");
          return { id: existing.id };
        }
        const now = new Date();
        if (
          campaign.status !== "RECRUITING" ||
          !campaign.publishedAt ||
          !campaign.applicationDeadline ||
          campaign.applicationDeadline <= now
        )
          fail(409, "CAMPAIGN_CLOSED", "모집이 마감된 캠페인입니다.");
        if (
          existing &&
          (!["DRAFT", "SUBMITTED", "WITHDRAWN", "REJECTED"].includes(
            existing.status,
          ) ||
            existing.id !== input.applicationId ||
            existing.updatedAt.toISOString() !== input.expectedUpdatedAt)
        )
          fail(
            409,
            "ALREADY_APPLIED",
            "이미 접수했거나 신청서가 변경되었습니다. 새로고침해 주세요.",
          );
        if (
          existing &&
          (await tx.proposalItem.count({
            where: { applicationRow: { applicationId: existing.id } },
          }))
        )
          fail(
            409,
            "LOCKED",
            "제안에 연결된 신청입니다. 운영팀에 변경을 요청해 주세요.",
          );
        if (!existing && input.applicationId)
          fail(409, "CONFLICT", "신청서를 새로고침해 주세요.");
        if (
          !existing &&
          (await tx.campaignApplication.count({
            where: { agencyOrganizationId: member.organizationId },
          })) >= 1000
        )
          fail(
            409,
            "LIMIT_REACHED",
            "신청 한도에 도달했습니다. 운영팀에 문의해 주세요.",
          );
        if (input.action === "saveDraft") {
          const ids = [
            ...new Set(input.rows.map((r) => r.creatorId).filter(Boolean)),
          ];
          const owned = await tx.creatorProfile.findMany({
            where: {
              id: { in: ids },
              agencyOrganizationId: member.organizationId,
              isActive: true,
            },
          });
          if (owned.length !== ids.length)
            fail(
              403,
              "INVALID_CREATOR",
              "소속 크리에이터만 저장할 수 있습니다.",
            );
          const values = {
            status: "DRAFT" as const,
            proposal: input.note,
            proposedAmount: "0",
            currency: campaign.currency,
            submissionKey: input.clientRequestId,
            submissionHash: hash,
            rosterSnapshot: { draftRows: input.rows },
          };
          const draft = existing
            ? await tx.campaignApplication.update({
                where: { id: existing.id },
                data: values,
              })
            : await tx.campaignApplication.create({
                data: {
                  ...values,
                  campaignId: campaign.id,
                  agencyOrganizationId: member.organizationId,
                  submittedById: session.user.id,
                },
              });
          if (existing) {
            await tx.applicationRow.deleteMany({
              where: { applicationId: draft.id },
            });
            await tx.applicationCreator.deleteMany({
              where: { applicationId: draft.id },
            });
          }
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "application.draft_saved",
              entityType: "CampaignApplication",
              entityId: draft.id,
              payload: {
                previousStatus: existing?.status ?? null,
                previousSnapshot: existing?.rosterSnapshot ?? null,
              },
            },
          });
          return { id: draft.id };
        }
        const creatorIds = [...new Set(input.rows.map((r) => r.creatorId))];
        const creators = await tx.creatorProfile.findMany({
          where: {
            id: { in: creatorIds },
            agencyOrganizationId: member.organizationId,
            isActive: true,
          },
        });
        if (creators.length !== creatorIds.length)
          fail(
            403,
            "INVALID_CREATOR",
            "소속된 활성 크리에이터만 신청할 수 있습니다.",
          );
        const cap = supplierOfferCap(campaign.requirements);
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
        const rows = input.rows.map((row) => {
          const creator = creators.find((c) => c.id === row.creatorId)!;
          const profile = record(creator.partnerProfile);
          const channel = (
            Array.isArray(creator.channels) ? creator.channels : []
          )
            .map(record)
            .find((c) => c.platform === row.platform);
          if (
            !channel ||
            !publicChannelUrl(
              text(channel.url) || text(channel.channelUrl),
              row.platform,
            ) ||
            !campaign.platforms.includes(row.platform)
          )
            fail(
              400,
              "INVALID_CHANNEL",
              "캠페인에서 모집하는 매체와 등록 채널을 확인해 주세요.",
            );
          if (
            input.action === "apply" &&
            (row.date < today ||
              (text(profile.available) && row.date < text(profile.available)) ||
              (campaign.contentDeadline &&
                row.date > campaign.contentDeadline.toISOString().slice(0, 10)))
          )
            fail(
              400,
              "INVALID_DATE",
              "가능 일정과 캠페인 제작 마감일을 확인해 주세요.",
            );
          if (input.action === "apply" && profile.acceptance === "진행 불가")
            fail(
              409,
              "UNAVAILABLE_CREATOR",
              "참여 불가로 등록된 크리에이터입니다.",
            );
          if (cap && proposalCents(row.unitAmount) > proposalCents(cap))
            fail(400, "RATE_CAP", "공고의 건별 공급 단가 상한을 초과했습니다.");
          if (
            campaign.currency === "KRW" &&
            proposalCents(row.unitAmount) % 100n !== 0n
          )
            fail(
              400,
              "INVALID_AMOUNT",
              "원화 공급 단가는 정수로 입력해 주세요.",
            );
          return {
            creatorId: row.creatorId,
            creatorName: creator.displayName,
            platform: row.platform,
            channelUrl: text(channel.url) || text(channel.channelUrl),
            format: row.format,
            quantity: row.quantity,
            unitAmount: row.unitAmount,
            availableOn: new Date(`${row.date}T00:00:00Z`),
            status:
              input.action === "apply"
                ? ("SUBMITTED" as const)
                : ("DRAFT" as const),
          };
        });
        const total = proposalAmount(
          rows.reduce(
            (sum, r) => sum + proposalCents(r.unitAmount) * BigInt(r.quantity),
            0n,
          ),
        );
        const values = {
          status:
            input.action === "apply"
              ? ("SUBMITTED" as const)
              : ("DRAFT" as const),
          proposal: input.note,
          proposedAmount: total,
          currency: campaign.currency,
          submissionKey: input.clientRequestId,
          submissionHash: hash,
          rosterSnapshot: rows.map((r) => ({
            ...r,
            availableOn: r.availableOn.toISOString(),
          })),
        };
        const app = existing
          ? await tx.campaignApplication.update({
              where: { id: existing.id },
              data: values,
            })
          : await tx.campaignApplication.create({
              data: {
                ...values,
                campaignId: campaign.id,
                agencyOrganizationId: member.organizationId,
                submittedById: session.user.id,
              },
            });
        if (existing) {
          await tx.applicationRow.deleteMany({
            where: { applicationId: app.id },
          });
          await tx.applicationCreator.deleteMany({
            where: { applicationId: app.id },
          });
        }
        await tx.applicationRow.createMany({
          data: rows.map((r) => ({ ...r, applicationId: app.id })),
        });
        await tx.applicationCreator.createMany({
          data: creatorIds.map((creatorId) => ({
            applicationId: app.id,
            creatorId,
            deliverables: rows
              .filter((r) => r.creatorId === creatorId)
              .map((r) => ({
                platform: r.platform,
                format: r.format,
                quantity: r.quantity,
                unitAmount: r.unitAmount,
                date: r.availableOn.toISOString().slice(0, 10),
              })),
          })),
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action:
              input.action === "apply"
                ? "application.submitted"
                : "application.draft_saved",
            entityType: "CampaignApplication",
            entityId: app.id,
            payload: {
              previousStatus: existing?.status ?? null,
              previousSnapshot: existing?.rosterSnapshot ?? null,
            },
          },
        });
        return { id: app.id };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    return json({ success: true, ...result });
  });
}
