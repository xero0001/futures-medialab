import "server-only";
import { createHash } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  proposalIdSchema,
  publicChannelUrl,
} from "@futures-medialab/database/proposal-validation";
import { z } from "zod";
import {
  boundary,
  fail,
  json,
  readBody,
  requireAdmin,
  recheckAdmin,
  verifyOrigin,
  rateLimit,
} from "./access";
import {
  catalogAgeMs,
  catalogMutation,
  catalogQuery,
  channelSchema,
  rateSchema,
  blankChannel,
  type CatalogRecord,
  type CatalogProfile,
  type CatalogOptions,
  type CatalogDetail,
} from "./creator-catalog-model";

type Tx = Prisma.TransactionClient;
const relations = {
  owner: { select: { name: true } },
  partnerOrganization: { select: { name: true } },
  rateCards: { orderBy: { version: "desc" }, take: 1 },
} satisfies Prisma.InternalCreatorInclude;
type Row = Prisma.InternalCreatorGetPayload<{ include: typeof relations }>;
const isoDay = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
function normalizedRates(value: unknown) {
  const result = z.array(rateSchema).safeParse(value);
  return result.success ? result.data : [];
}
function creatorDto(row: Row, now: Date): CatalogRecord {
  const channelData = z.array(channelSchema).safeParse(row.channels);
  return {
    id: row.id,
    displayName: row.displayName,
    affiliation: row.affiliation as CatalogProfile["affiliation"],
    partnerOrganizationId: row.partnerOrganizationId,
    rosterCreatorId: row.rosterCreatorId,
    ownerId: row.ownerId,
    channels: channelData.success ? channelData.data : [],
    genres: row.genres,
    languages: row.languages,
    formats: row.formats,
    audienceNotes: row.audienceNotes,
    availability: row.availability as CatalogProfile["availability"],
    availableFrom: isoDay(row.availableFrom),
    availableThrough: isoDay(row.availableThrough),
    availabilityNote: row.availabilityNote,
    acceptsChinaGames:
      row.acceptsChinaGames as CatalogProfile["acceptsChinaGames"],
    conflicts: row.conflicts,
    riskNotes: row.riskNotes,
    isActive: row.isActive,
    revision: row.revision,
    ownerName: row.owner.name ?? "이름 미등록",
    partnerName: row.partnerOrganization?.name ?? null,
    priceCheckedAt: row.priceCheckedAt?.toISOString() ?? null,
    availabilityCheckedAt: row.availabilityCheckedAt?.toISOString() ?? null,
    stalePrice:
      !row.priceCheckedAt ||
      now.getTime() - row.priceCheckedAt.getTime() >= catalogAgeMs,
    staleAvailability:
      !row.availabilityCheckedAt ||
      now.getTime() - row.availabilityCheckedAt.getTime() >= catalogAgeMs,
    rateVersion: row.rateCards[0]?.version ?? null,
    rates: normalizedRates(row.rateCards[0]?.rates),
  };
}
async function getDetail(tx: Tx, id: string): Promise<CatalogDetail> {
  const row = await tx.internalCreator.findUnique({
    where: { id },
    include: relations,
  });
  if (!row) fail(404, "NOT_FOUND", "크리에이터를 찾을 수 없습니다.");
  const history = await tx.internalCreatorRateCard.findMany({
    where: { creatorId: id },
    orderBy: { version: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  const proposals = await tx.proposalItem.findMany({
    where: { catalogCreatorId: id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      creatorName: true,
      proposal: {
        select: {
          version: true,
          status: true,
          publishedAt: true,
          campaign: { select: { id: true, title: true } },
        },
      },
    },
  });
  return {
    creator: creatorDto(row, new Date()),
    history: history.map((h) => ({
      version: h.version,
      rates: normalizedRates(h.rates),
      reason: h.reason,
      author: h.createdBy.name ?? "이름 미등록",
      at: h.createdAt.toISOString(),
    })),
    campaigns: proposals.map((i) => ({
      ...i.proposal.campaign,
      version: i.proposal.version,
      status: i.proposal.status,
      publishedAt: i.proposal.publishedAt?.toISOString() ?? null,
      creatorName: i.creatorName,
    })),
  };
}
const eligibleOwner = {
  role: { in: ["OWNER", "ADMIN"] },
  organization: { type: "PLATFORM", status: "ACTIVE" },
} satisfies Prisma.OrganizationMemberWhereInput;
async function validateLinks(tx: Tx, p: CatalogProfile) {
  if (
    !(await tx.organizationMember.findFirst({
      where: { ...eligibleOwner, userId: p.ownerId },
      select: { userId: true },
    }))
  )
    fail(409, "INVALID_OWNER", "활성 운영 담당자를 선택해 주세요.");
  if (
    p.partnerOrganizationId &&
    !(await tx.organization.findFirst({
      where: { id: p.partnerOrganizationId, type: "AGENCY", status: "ACTIVE" },
      select: { id: true },
    }))
  )
    fail(409, "INVALID_PARTNER", "승인된 파트너 조직을 선택해 주세요.");
  if (
    p.rosterCreatorId &&
    !(await tx.creatorProfile.findFirst({
      where: {
        id: p.rosterCreatorId,
        agencyOrganizationId: p.partnerOrganizationId!,
        isActive: true,
      },
      select: { id: true },
    }))
  )
    fail(
      409,
      "INVALID_ROSTER",
      "선택한 파트너의 활성 로스터 인물을 확인해 주세요.",
    );
}
function profileData(p: CatalogProfile) {
  return {
    ...p,
    availableFrom: p.availableFrom ? new Date(p.availableFrom) : null,
    availableThrough: p.availableThrough ? new Date(p.availableThrough) : null,
  };
}
function rosterChannels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const url = raw.url ?? raw.channelUrl,
      name = raw.name ?? raw.handle ?? raw.channelName;
    if (
      typeof url !== "string" ||
      typeof raw.platform !== "string" ||
      !publicChannelUrl(url, raw.platform)
    )
      return [];
    const parsed = channelSchema.safeParse({
      ...blankChannel(),
      platform: raw.platform,
      name: typeof name === "string" && name ? name : raw.platform,
      url,
      followers: raw.followers ?? null,
      averageViews: raw.averageViews ?? null,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
export function creatorCatalogApi(request: Request) {
  return boundary(async () => {
    if (request.method === "POST") verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(
      admin,
      request.method === "POST" ? "creator-write" : "creator-read",
      request.method === "POST" ? 40 : 160,
    );
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      return json(
        await getDatabase().$transaction(
          async (tx) => {
            await recheckAdmin(tx, admin);
            if (params.has("id")) {
              const id = proposalIdSchema.safeParse(params.get("id"));
              if (!id.success)
                fail(404, "NOT_FOUND", "크리에이터를 찾을 수 없습니다.");
              return getDetail(tx, id.data);
            }
            if (params.get("view") === "options") {
              const agencyId = params.get("agency") || undefined,
                agencySearch = (params.get("agencySearch") || "")
                  .trim()
                  .slice(0, 120);
              const owners = await tx.user.findMany({
                where: { memberships: { some: eligibleOwner } },
                orderBy: { name: "asc" },
                select: { id: true, name: true },
              });
              const agencies = await tx.organization.findMany({
                where: {
                  type: "AGENCY",
                  status: "ACTIVE",
                  ...(agencySearch
                    ? { name: { contains: agencySearch, mode: "insensitive" } }
                    : {}),
                },
                take: 200,
                orderBy: { name: "asc" },
                select: { id: true, name: true },
              });
              const roster = agencyId
                ? await tx.creatorProfile.findMany({
                    where: {
                      agencyOrganizationId: agencyId,
                      agencyOrganization: { status: "ACTIVE", type: "AGENCY" },
                      isActive: true,
                    },
                    orderBy: { displayName: "asc" },
                    select: {
                      id: true,
                      displayName: true,
                      channels: true,
                      categories: true,
                      primaryLanguage: true,
                    },
                    take: 500,
                  })
                : [];
              return {
                selfId: admin.userId,
                owners: owners.map((o) => ({
                  ...o,
                  name: o.name ?? "이름 미등록",
                })),
                agencies,
                roster: roster.map((r) => ({
                  id: r.id,
                  displayName: r.displayName,
                  channels: rosterChannels(r.channels),
                  genres: r.categories,
                  language: r.primaryLanguage,
                })),
              } satisfies CatalogOptions;
            }
            const f = catalogQuery.safeParse(Object.fromEntries(params));
            if (!f.success)
              fail(400, "INVALID_FILTER", "검색 조건을 확인해 주세요.");
            const { q, active, stale, affiliation } = f.data,
              now = new Date(),
              cutoff = new Date(now.getTime() - catalogAgeMs),
              pageSize = 20;
            const where: Prisma.InternalCreatorWhereInput = {
              AND: [
                ...(params.get("purpose") === "proposal"
                  ? [
                      {
                        isActive: true,
                        OR: [
                          { partnerOrganizationId: null },
                          {
                            partnerOrganization: {
                              type: "AGENCY" as const,
                              status: "ACTIVE" as const,
                            },
                          },
                        ],
                      },
                    ]
                  : []),
                ...(q
                  ? [
                      {
                        OR: [
                          {
                            displayName: {
                              contains: q,
                              mode: "insensitive" as const,
                            },
                          },
                          { genres: { has: q } },
                          {
                            partnerOrganization: {
                              name: {
                                contains: q,
                                mode: "insensitive" as const,
                              },
                            },
                          },
                        ],
                      },
                    ]
                  : []),
                ...(stale === "yes"
                  ? [
                      {
                        OR: [
                          { priceCheckedAt: null },
                          { priceCheckedAt: { lte: cutoff } },
                          { availabilityCheckedAt: null },
                          { availabilityCheckedAt: { lte: cutoff } },
                        ],
                      },
                    ]
                  : []),
              ],
              ...(affiliation !== "all" ? { affiliation } : {}),
              ...(active !== "all" ? { isActive: active === "yes" } : {}),
            };
            const total = await tx.internalCreator.count({ where }),
              page = Math.min(
                f.data.page,
                Math.max(1, Math.ceil(total / pageSize)),
              );
            const rows = await tx.internalCreator.findMany({
              where,
              orderBy: [{ displayName: "asc" }, { id: "asc" }],
              skip: (page - 1) * pageSize,
              take: pageSize,
              include: relations,
            });
            return {
              items: rows.map((r) => creatorDto(r, now)),
              page,
              pageSize,
              total,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        ),
      );
    }
    if (request.method !== "POST")
      fail(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");
    const input = await readBody(request, catalogMutation),
      hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const id = await getDatabase().$transaction(
      async (tx) => {
        // Serialize retries of one user action before looking up its result.
        // READ COMMITTED sees the first transaction's committed response after the lock.
        const key = "internal-creator:" + admin.userId + ":" + input.requestId;
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        await recheckAdmin(tx, admin);
        const prior = await tx.internalCreatorMutation.findUnique({
          where: {
            actorId_requestId: {
              actorId: admin.userId,
              requestId: input.requestId,
            },
          },
        });
        if (prior) {
          if (prior.payloadHash !== hash)
            fail(409, "REQUEST_REUSED", "다른 작업에 사용된 요청입니다.");
          return prior.creatorId;
        }
        const now = new Date();
        let creatorId: string;
        if (input.action === "create") {
          await validateLinks(tx, input.profile);
          const row = await tx.internalCreator.create({
            data: {
              ...profileData(input.profile),
              availabilityCheckedAt: input.confirmAvailability ? now : null,
            },
            select: { id: true },
          });
          creatorId = row.id;
        } else {
          const row = await tx.internalCreator.findUnique({
            where: { id: input.id },
            select: { id: true, revision: true, availabilityCheckedAt: true },
          });
          if (!row) fail(404, "NOT_FOUND", "크리에이터를 찾을 수 없습니다.");
          if (row.revision !== input.revision)
            fail(
              409,
              "STALE_RECORD",
              "다른 담당자가 먼저 변경했습니다. 다시 열어 확인해 주세요.",
            );
          if (input.action === "update") await validateLinks(tx, input.profile);
          const result = await tx.internalCreator.updateMany({
            where: { id: row.id, revision: input.revision },
            data: {
              revision: { increment: 1 },
              ...(input.action === "rates"
                ? { priceCheckedAt: now }
                : {
                    ...profileData(input.profile),
                    availabilityCheckedAt: input.confirmAvailability
                      ? now
                      : row.availabilityCheckedAt,
                  }),
            },
          });
          if (result.count !== 1)
            fail(409, "STALE_RECORD", "다른 담당자가 먼저 변경했습니다.");
          creatorId = row.id;
          if (input.action === "rates") {
            const latest = await tx.internalCreatorRateCard.findFirst({
              where: { creatorId },
              orderBy: { version: "desc" },
              select: { version: true },
            });
            await tx.internalCreatorRateCard.create({
              data: {
                creatorId,
                version: (latest?.version ?? 0) + 1,
                rates: input.rates,
                reason: input.reason,
                createdById: admin.userId,
              },
            });
          }
        }
        await tx.internalCreatorMutation.create({
          data: {
            actorId: admin.userId,
            requestId: input.requestId,
            creatorId,
            payloadHash: hash,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.userId,
            entityType: "InternalCreator",
            entityId: creatorId,
            action: "admin.creator." + input.action,
            payload: {
              reason:
                input.action === "create"
                  ? "내부 크리에이터 등록"
                  : input.reason,
            },
          },
        });
        return creatorId;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
    return json({ id });
  });
}
