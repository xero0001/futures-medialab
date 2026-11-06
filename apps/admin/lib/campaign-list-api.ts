import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { z } from "zod";
import {
  boundary,
  fail,
  json,
  rateLimit,
  recheckAdmin,
  requireAdmin,
} from "./access";
import { record, reviewReason, text } from "./verification";
const filters = z.object({
  q: z.string().trim().max(160).default(""),
  type: z.enum(["all", "MANAGED", "OPEN_BIDDING"]).default("all"),
  status: z
    .enum([
      "all",
      "DRAFT",
      "REVIEW",
      "RECRUITING",
      "IN_PROGRESS",
      "VERIFYING",
      "SETTLING",
      "COMPLETED",
      "CANCELED",
    ])
    .default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export function listCampaigns(request: Request) {
  return boundary(async () => {
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "read", 120);
    const parsed = filters.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      fail(400, "INVALID_INPUT", "검색 조건을 확인해 주세요.");
    const input = parsed.data,
      pageSize = 25;
    const where: Prisma.CampaignWhereInput = {
      ...(input.type !== "all" ? { type: input.type } : {}),
      ...(input.status !== "all" ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              { title: { contains: input.q, mode: "insensitive" } },
              {
                brandOrganization: {
                  name: { contains: input.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const result = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        const total = await tx.campaign.count({ where });
        const page = Math.min(
          input.page,
          Math.max(1, Math.ceil(total / pageSize)),
        );
        const rows = await tx.campaign.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            type: true,
            title: true,
            summary: true,
            status: true,
            platforms: true,
            currency: true,
            budgetAmount: true,
            applicationDeadline: true,
            createdAt: true,
            requirements: true,
            brandOrganizationId: true,
            brandOrganization: { select: { name: true, status: true } },
            _count: { select: { applications: true } },
          },
        });
        const ids = rows
          .map((row) =>
            text(record(record(row.requirements).brandIntake).requestId),
          )
          .filter(Boolean);
        const intakes = ids.length
          ? await tx.workspaceToolRequest.findMany({
              where: { id: { in: ids } },
              select: {
                id: true,
                campaignId: true,
                organizationId: true,
                dueAt: true,
                assignedTo: { select: { name: true } },
              },
            })
          : [];
        return {
          total,
          page,
          pageSize,
          campaigns: rows.map((row) => {
            const requestId = text(
              record(record(row.requirements).brandIntake).requestId,
            );
            const intake = intakes.find(
              (item) =>
                item.id === requestId &&
                item.campaignId === row.id &&
                item.organizationId === row.brandOrganizationId,
            );
            return {
              id: row.id,
              type: row.type,
              title: row.title,
              summary: row.summary.slice(0, 500),
              status: row.status,
              brandName: row.brandOrganization.name,
              brandStatus: row.brandOrganization.status,
              platforms: row.platforms,
              currency: row.currency,
              budgetAmount: row.budgetAmount?.toFixed(2) ?? null,
              applicationDeadline:
                row.applicationDeadline?.toISOString() ?? null,
              createdAt: row.createdAt.toISOString(),
              applicationCount: row._count.applications,
              reviewReason: reviewReason(row.requirements),
              assigneeName: intake?.assignedTo?.name ?? null,
              dueAt: intake?.dueAt?.toISOString() ?? null,
              requestId: intake?.id ?? null,
            };
          }),
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
