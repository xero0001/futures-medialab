import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  boundary,
  fail,
  json,
  rateLimit,
  readBody,
  recheckAdmin,
  requireAdmin,
  verifyOrigin,
} from "./access";
import {
  canReviewSourcing,
  sourcingLockReason,
  sourcingMutationSchema,
} from "./sourcing-validation";
import { safeOperationUrl } from "./campaign-operations-validation";
import type { AdminSourcingData } from "./sourcing-types";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const include = {
  rows: {
    include: {
      proposalItems: {
        select: { proposal: { select: { publishedAt: true } } },
      },
    },
  },
  agencyOrganization: { select: { name: true, status: true } },
  campaign: {
    select: { status: true, brandOrganization: { select: { status: true } } },
  },
  creators: {
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          agencyOrganizationId: true,
          isActive: true,
          categories: true,
          channels: true,
        },
      },
    },
  },
  _count: { select: { submissions: true } },
  contract: { select: { id: true } },
  settlement: { select: { id: true } },
} satisfies Prisma.CampaignApplicationInclude;
type Application = Prisma.CampaignApplicationGetPayload<{
  include: typeof include;
}>;
async function lockReason(
  tx: Prisma.TransactionClient,
  application: Application,
  knownWork?: boolean,
) {
  const creatorIds = application.creators.map(({ creator }) => creator.id);
  const linked =
    knownWork !== undefined
      ? knownWork
      : creatorIds.length
        ? await tx.proposalItem.count({
            where: {
              creatorId: { in: creatorIds },
              proposal: {
                campaignId: application.campaignId,
                publishedAt: { not: null },
              },
            },
          })
        : 0;
  const assigned =
    knownWork !== undefined
      ? false
      : await tx.productionItem.count({
          where: {
            campaignId: application.campaignId,
            supplierOrganizationId: application.agencyOrganizationId,
          },
        });
  return sourcingLockReason({
    campaignStatus: application.campaign.status,
    brandActive: application.campaign.brandOrganization.status === "ACTIVE",
    applicationStatus: application.status,
    hasWork: Boolean(
      linked ||
      assigned ||
      application._count.submissions ||
      application.contract ||
      application.settlement,
    ),
  });
}
export function adminSourcingApi(request: Request) {
  return boundary(async () => {
    if (request.method === "POST") verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(
      admin,
      request.method === "GET" ? "sourcing-read" : "sourcing-write",
      request.method === "GET" ? 120 : 30,
    );
    if (request.method === "POST") {
      const input = await readBody(request, sourcingMutationSchema);
      await getDatabase().$transaction(
        async (tx) => {
          await recheckAdmin(tx, admin);
          const application = await tx.campaignApplication.findFirst({
            where: { id: input.applicationId, campaignId: input.campaignId },
            include,
          });
          if (!application)
            fail(404, "NOT_FOUND", "신청 내역을 찾을 수 없습니다.");
          if (application.updatedAt.toISOString() !== input.expectedUpdatedAt)
            fail(
              409,
              "CONFLICT",
              "신청이 변경되었습니다. 새로고침 후 검토해 주세요.",
            );
          const row = input.rowId
            ? application.rows.find((r) => r.id === input.rowId)
            : null;
          if (input.rowId && !row)
            fail(404, "NOT_FOUND", "신청 항목을 찾을 수 없습니다.");
          if (application.rows?.length && !row)
            fail(
              400,
              "ROW_REQUIRED",
              "크리에이터별 신청 항목을 선택해 주세요.",
            );
          const locked = row
            ? sourcingLockReason({
                campaignStatus: application.campaign.status,
                brandActive:
                  application.campaign.brandOrganization.status === "ACTIVE",
                applicationStatus: application.status,
                hasWork: row.proposalItems.some(
                  (i) => i.proposal.publishedAt !== null,
                ),
              })
            : await lockReason(tx, application);
          if (locked) fail(409, "LOCKED", locked);
          if (
            !canReviewSourcing(row?.status ?? application.status, input.status)
          )
            fail(
              409,
              "INVALID_STATE",
              "현재 신청 상태에서 수행할 수 없는 검토입니다.",
            );
          if (
            input.status !== "REJECTED" &&
            (application.agencyOrganization.status !== "ACTIVE" ||
              !application.creators.some(
                ({ creator }) =>
                  creator.isActive &&
                  (!row || row.creatorId === creator.id) &&
                  creator.agencyOrganizationId ===
                    application.agencyOrganizationId,
              ))
          )
            fail(
              409,
              "INACTIVE_CANDIDATE",
              "승인된 에이전시의 활성 크리에이터가 포함된 신청을 선택해 주세요.",
            );
          const beforeStatus = row?.status ?? application.status;
          if (row)
            await tx.applicationRow.update({
              where: { id: row.id },
              data: { status: input.status },
            });
          const states = (application.rows ?? []).map((r) =>
            r.id === row?.id ? input.status : r.status,
          );
          const aggregate = row
            ? states.every((s) => s === "REJECTED")
              ? "REJECTED"
              : states.every((s) => s === "ACCEPTED")
                ? "ACCEPTED"
                : states.some((s) => ["SHORTLISTED", "ACCEPTED"].includes(s))
                  ? "SHORTLISTED"
                  : "SUBMITTED"
            : input.status;
          const changed = await tx.campaignApplication.updateMany({
            where: {
              id: application.id,
              status: application.status,
              updatedAt: new Date(input.expectedUpdatedAt),
            },
            data: { status: aggregate },
          });
          if (changed.count !== 1)
            fail(409, "CONFLICT", "다른 담당자가 신청을 변경했습니다.");
          await tx.auditLog.create({
            data: {
              actorId: admin.userId,
              action: "admin.sourcing.reviewed",
              entityType: "CampaignApplication",
              entityId: application.id,
              payload: {
                campaignId: application.campaignId,
                rowId: row?.id ?? null,
                before: beforeStatus,
                after: input.status,
                reason: input.reason,
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
      return json({ success: true });
    }
    const campaignId =
      new URL(request.url).searchParams.get("campaignId") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(campaignId))
      fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
    const result = await getDatabase().$transaction(
      async (tx): Promise<AdminSourcingData> => {
        await recheckAdmin(tx, admin);
        if (
          !(await tx.campaign.findUnique({
            where: { id: campaignId },
            select: { id: true },
          }))
        )
          fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
        const applications = await tx.campaignApplication.findMany({
          where: { campaignId, status: { not: "DRAFT" } },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 100,
          include,
        });
        const total = await tx.campaignApplication.count({
          where: { campaignId, status: { not: "DRAFT" } },
        });
        const audits = await tx.auditLog.findMany({
          where: {
            action: "admin.sourcing.reviewed",
            entityId: { in: applications.map((a) => a.id) },
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
          select: { entityId: true, payload: true },
        });
        const linkedItems = await tx.proposalItem.findMany({
          where: {
            proposal: { campaignId, publishedAt: { not: null } },
            creatorId: { not: null },
          },
          select: { creatorId: true },
        });
        const assignedItems = await tx.productionItem.findMany({
          where: { campaignId, supplierOrganizationId: { not: null } },
          select: { supplierOrganizationId: true },
        });
        const linkedCreators = new Set(
          linkedItems.map((item) => item.creatorId),
        );
        const assignedAgencies = new Set(
          assignedItems.map((item) => item.supplierOrganizationId),
        );
        const rows: AdminSourcingData["applications"] = [];
        for (const application of applications) {
          rows.push({
            id: application.id,
            agencyName: application.agencyOrganization.name,
            agencyActive: application.agencyOrganization.status === "ACTIVE",
            status: application.status,
            proposal: application.proposal,
            amount: application.proposedAmount?.toFixed(2) ?? null,
            currency: application.currency,
            updatedAt: application.updatedAt.toISOString(),
            lockReason: await lockReason(
              tx,
              application,
              assignedAgencies.has(application.agencyOrganizationId) ||
                application.creators.some(({ creator }) =>
                  linkedCreators.has(creator.id),
                ),
            ),
            reviewReason: text(
              record(audits.find((a) => a.entityId === application.id)?.payload)
                .reason,
            ),
            creators: application.creators
              .filter(
                ({ creator }) =>
                  creator.agencyOrganizationId ===
                  application.agencyOrganizationId,
              )
              .map(({ creator, deliverables }) => ({
                id: creator.id,
                name: creator.displayName,
                active: creator.isActive,
                categories: creator.categories,
                channels: (Array.isArray(creator.channels)
                  ? creator.channels
                  : []
                ).map((value) => {
                  const channel = record(value);
                  return {
                    platform: text(channel.platform),
                    label:
                      text(channel.name) ||
                      text(channel.handle) ||
                      creator.displayName,
                    url: safeOperationUrl(
                      text(channel.url) || text(channel.channelUrl),
                    ),
                    followers:
                      typeof channel.followers === "number" &&
                      Number.isSafeInteger(channel.followers) &&
                      channel.followers >= 0
                        ? channel.followers
                        : null,
                  };
                }),
                deliverables: Array.isArray(deliverables)
                  ? deliverables
                      .map((value) =>
                        typeof value === "string"
                          ? value
                          : Object.values(record(value))
                              .filter(
                                (v) =>
                                  typeof v === "string" ||
                                  typeof v === "number",
                              )
                              .join(" · "),
                      )
                      .join(" / ")
                  : text(deliverables),
              })),
          });
        }
        const expanded: AdminSourcingData["applications"] = [];
        for (const summary of rows) {
          const application = applications.find((a) => a.id === summary.id)!;
          if (!application.rows?.length) {
            expanded.push(summary);
            continue;
          }
          for (const row of application.rows)
            expanded.push({
              ...summary,
              rowId: row.id,
              status: row.status,
              amount: row.unitAmount.mul(row.quantity).toFixed(2),
              creators: summary.creators
                .filter((c) => c.id === row.creatorId)
                .map((c) => ({
                  ...c,
                  deliverables: `${row.platform} · ${row.format} ${row.quantity}건 · 건당 ${row.unitAmount.toFixed(2)} ${application.currency} · ${row.availableOn.toISOString().slice(0, 10)}`,
                })),
              lockReason: sourcingLockReason({
                campaignStatus: application.campaign.status,
                brandActive:
                  application.campaign.brandOrganization.status === "ACTIVE",
                applicationStatus: application.status,
                hasWork: row.proposalItems.some(
                  (item) => item.proposal.publishedAt !== null,
                ),
              }),
            });
        }
        return { campaignId, total, applications: expanded };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
    return json(result);
  });
}
