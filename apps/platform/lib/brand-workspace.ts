import {
  campaignFieldsFromBrief,
  createInitialIntake,
  isValidRecruitmentDeadline,
} from "@futures-medialab/database/brand-intake";
import {
  originalProposalDeadline,
  requestWaitingFor,
} from "@futures-medialab/database/request-workflow";
import "server-only";
import { gameCatalogSelect, localizedGame, normalizeGameTitle, resolveCampaignGame } from "@futures-medialab/database/game-catalog";
import { createHash } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import {
  listBrandCampaignProposals,
  listBrandLatestProposals,
  summarizeBrandProposal,
} from "@futures-medialab/database/proposals";
import type { BrandProposalSummary } from "@futures-medialab/database/proposal-types";
import { getAuth } from "./auth";
import { campaignIdSchema } from "./campaign-validation";
import { campaignArtwork } from "./campaign-artwork";
import { listBrandProductionItems } from "@futures-medialab/database/production";
import type { BrandProductionItem } from "@futures-medialab/database/production-types";
import { listBrandReportingItems } from "@futures-medialab/database/reporting";
import type { BrandReportingItem } from "@futures-medialab/database/reporting-types";
import { listBrandInvoices } from "@futures-medialab/database/settlement";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import {
  brandBriefSchema,
  brandDraftBriefSchema,
  brandCampaignMutationSchema,
  isFutureBrandDate,
} from "./brand-workspace-validation";
import {
  fail,
  json,
  membership,
  rateLimit,
  readBody,
  requireManager,
  verifyOrigin,
  workspaceBoundary,
} from "./workspace-api";
import type {
  BrandCampaign,
  BrandCampaignCreated,
  BrandCampaignDetail,
  BrandRequestSummary,
  BrandWorkspace,
  BrandWorkspaceCapabilities,
} from "./brand-workspace-types";

type Tx = Prisma.TransactionClient;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === "string" ? value : "");
const iso = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;

// Brand artifacts require explicit operator publication. Supplier applications,
// contracts, submissions and settlements are never substituted for those artifacts.
const capabilities: BrandWorkspaceCapabilities = {
  anonymousPreview: false,
  officialProposals: true,
  productionReview: true,
  campaignPerformance: true,
  campaignDocuments: true,
};
const campaignSelect = {
  game: { select: gameCatalogSelect },
  id: true,
  title: true,
  summary: true,
  coverImageUrl: true,
  type: true,
  status: true,
  budgetAmount: true,
  currency: true,
  platforms: true,
  regions: true,
  categories: true,
  applicationDeadline: true,
  contentDeadline: true,
  requirements: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CampaignSelect;
type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>;
const requestSelect = {
  id: true,
  title: true,
  tool: true,
  status: true,
  inputJson: true,
  campaignId: true,
  campaign: { select: { title: true } },
  assignedTo: { select: { name: true } },
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.WorkspaceToolRequestSelect;
type RequestRow = Prisma.WorkspaceToolRequestGetPayload<{
  select: typeof requestSelect;
}>;
function requestDto(row: RequestRow): BrandRequestSummary {
  return {
    id: row.id,
    title: row.title,
    tool: row.tool,
    status: row.status,
    waitingFor: ["proposal-decision", "brief", "reply"].includes(
      string(object(row.inputJson).waitingFor),
    )
      ? (string(
          object(row.inputJson).waitingFor,
        ) as BrandRequestSummary["waitingFor"])
      : null,
    campaignId: row.campaignId,
    campaignTitle: row.campaign?.title ?? null,
    assigneeName: row.assignedTo
      ? row.assignedTo.name?.trim() || "운영팀"
      : null,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
function campaignDto(
  row: CampaignRow,
  requests: RequestRow[],
  latestProposal: BrandProposalSummary | null = null,
  production: BrandProductionItem[] = [],
  reporting: BrandReportingItem[] = [],
  invoices: BrandInvoice[] = [],
): BrandCampaign {
  const currentProduction =
    latestProposal?.status === "APPROVED"
      ? production.filter((item) => item.proposalId === latestProposal.id)
      : [];
  const currentReports = reporting.filter(
    (item) => item.isCurrent && item.proposalId === latestProposal?.id,
  );
  const requirements = object(row.requirements);
  const brief = brandDraftBriefSchema.safeParse(requirements.brandBrief);
  const intake = object(requirements.brandIntake);
  const game = row.game ? localizedGame(row.game, brief.success ? brief.data.gameLocale : "ko") : null;
  const intakeRequest = requests.find(
    (request) =>
      request.id === intake.requestId && request.campaignId === row.id,
  );
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    ...campaignArtwork(row.coverImageUrl, row.requirements),
    ...(game && { gameName: game.title, gameIconUrl: game.thumbnailUrl, gameSourceUrl: game.officialUrl }),
    type: row.type,
    status: row.status,
    budgetAmount: row.budgetAmount?.toFixed(2) ?? null,
    currency: row.currency,
    platforms: row.platforms,
    regions: row.regions,
    categories: row.categories,
    applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
    contentDeadline: row.contentDeadline?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    brief: brief.success ? brief.data : null,
    submittedAt: row.status === "DRAFT" ? null : iso(intake.submittedAt),
    proposalDueAt:
      !["DRAFT", "CANCELED", "COMPLETED"].includes(row.status) &&
      row.type === "MANAGED" &&
      !latestProposal &&
      intakeRequest?.status !== "WAITING_BRAND"
        ? (intakeRequest?.dueAt?.toISOString() ?? null)
        : null,
    requestId: row.status === "DRAFT" ? null : (intakeRequest?.id ?? null),
    intakeStatus:
      row.status === "DRAFT" ? null : (intakeRequest?.status ?? null),
    intakeWaitingFor: intakeRequest
      ? requestWaitingFor(
          intakeRequest.inputJson,
          intakeRequest.status,
          Boolean(latestProposal),
        )
      : null,
    originalProposalDueAt:
      iso(intake.originalProposalDueAt) ??
      (intakeRequest
        ? originalProposalDeadline(intakeRequest.inputJson)
        : null),
    intakeAssigneeName:
      row.status !== "DRAFT" && intakeRequest?.assignedTo
        ? intakeRequest.assignedTo.name?.trim() || "운영팀"
        : null,
    intakeDueAt:
      row.status === "DRAFT"
        ? null
        : (intakeRequest?.dueAt?.toISOString() ?? null),
    reviewNote: string(object(requirements.adminReview).reason) || null,
    latestProposal,
    productionSummary: {
      total: currentProduction.length,
      awaitingSubmission: currentProduction.filter(
        (item) => item.status === "AWAITING_SUBMISSION",
      ).length,
      underReview: currentProduction.filter(
        (item) => item.status === "ADMIN_REVIEW",
      ).length,
      awaitingBrand: currentProduction.filter(
        (item) => item.status === "BRAND_REVIEW",
      ).length,
      changesRequested: currentProduction.filter((item) =>
        ["BRAND_REVISION", "AGENCY_REVISION"].includes(item.status),
      ).length,
      approved: currentProduction.filter((item) => item.status === "APPROVED")
        .length,
    },
    reportingSummary: {
      total: currentReports.length,
      published: currentReports.filter((item) => item.latestSubmission).length,
      pending: currentReports.filter((item) => item.status !== "PUBLISHED")
        .length,
      allMetricsPending: currentReports.filter(
        (item) =>
          item.latestSubmission &&
          Object.values(item.latestSubmission.metrics).every(
            (value) => value === null,
          ),
      ).length,
    },
    invoiceSummary: {
      issued: invoices.filter((invoice) => invoice.status === "ISSUED").length,
      paid: invoices.filter((invoice) => invoice.status === "PAID").length,
    },
  };
}
async function authenticated(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  return session;
}
async function authorize(
  tx: Tx,
  session: Awaited<ReturnType<typeof authenticated>>,
) {
  const live = await tx.session.findFirst({
    where: {
      id: session.session.id,
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!live) fail(401, "UNAUTHORIZED", "로그인이 만료되었습니다.");
  return membership(tx, session.user.id);
}

export function brandGameCatalog(request: Request) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "brand-game-search", 120);
    const params = new URL(request.url).searchParams;
    const query = params.get("q") ?? "";
    const language = params.get("lang") ?? "ko";
    if (query.length > 120 || !["ko", "en", "zh"].includes(language)) fail(400, "INVALID_QUERY", "검색 조건을 확인해 주세요.");
    const locale = language as "ko" | "en" | "zh";
    const games = await getDatabase().$transaction(async (tx) => {
      const member = await authorize(tx, session);
      return tx.gameCatalog.findMany({
        where: { OR: [{ verified: true }, { organizationId: member.organizationId }],
          ...(query.trim() && { searchText: { contains: normalizeGameTitle(query), mode: "insensitive" } }),
        },
        orderBy: [{ verified: "desc" }, { title: "asc" }], take: 8, select: gameCatalogSelect,
      });
    });
    return json({ games: games.map(game => ({ ...localizedGame(game, locale), exactMatch: game.aliases.includes(normalizeGameTitle(query)) })) });
  });
}

export function brandWorkspace(request: Request) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "brand-read", 120);
    const result = await getDatabase().$transaction(
      async (tx): Promise<BrandWorkspace> => {
        const member = await authorize(tx, session);
        const organizationId = member.organizationId;
        const [
          campaigns,
          requests,
          links,
          groupedCampaigns,
          groupedRequests,
          waitingContentReviews,
        ] = await Promise.all([
          tx.campaign.findMany({
            where: { brandOrganizationId: organizationId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 101,
            select: campaignSelect,
          }),
          tx.workspaceToolRequest.findMany({
            where: { organizationId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 101,
            select: requestSelect,
          }),
          tx.shortLink.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              code: true,
              title: true,
              targetUrl: true,
              active: true,
              clickCount: true,
              createdAt: true,
            },
          }),
          tx.campaign.groupBy({
            by: ["status"],
            where: { brandOrganizationId: organizationId },
            _count: { _all: true },
          }),
          tx.workspaceToolRequest.groupBy({
            by: ["status"],
            where: { organizationId },
            _count: { _all: true },
          }),
          tx.productionItem.count({
            where: {
              status: "BRAND_REVIEW",
              campaign: {
                brandOrganizationId: organizationId,
                status: { in: ["IN_PROGRESS", "VERIFYING"] },
              },
              proposalItem: {
                status: "APPROVED",
                proposal: {
                  status: "APPROVED",
                  publishedAt: { not: null },
                  supersededAt: null,
                },
              },
            },
          }),
        ]);
        // Intake threads can be older than the inbox's latest 100 requests.
        const intakeIds = campaigns
          .slice(0, 100)
          .map((campaign) =>
            string(object(object(campaign.requirements).brandIntake).requestId),
          )
          .filter(Boolean);
        const intakeRequests = intakeIds.length
          ? await tx.workspaceToolRequest.findMany({
              where: { organizationId, id: { in: intakeIds } },
              select: requestSelect,
            })
          : [];
        const [proposals, production, reporting, invoices] = await Promise.all([
          listBrandLatestProposals(
            tx,
            organizationId,
            campaigns.slice(0, 100).map((campaign) => campaign.id),
            member.role !== "MEMBER",
          ),
          listBrandProductionItems(
            tx,
            organizationId,
            undefined,
            member.role !== "MEMBER",
          ),
          listBrandReportingItems(tx, organizationId),
          listBrandInvoices(tx, { userId: session.user.id, organizationId }),
        ]);
        const proposalSummaries = new Map(
          proposals.map((proposal) => [
            proposal.campaignId,
            summarizeBrandProposal(proposal),
          ]),
        );
        const pendingProposals = proposals
          .filter(
            (proposal) =>
              proposal.items.some((item) => item.status === "PENDING") &&
              proposal.expiresAt &&
              Date.parse(proposal.expiresAt) > Date.now() &&
              ["PUBLISHED", "CHANGES_REQUESTED", "REJECTED"].includes(
                proposal.status,
              ) &&
              campaigns.some(
                (campaign) =>
                  campaign.id === proposal.campaignId &&
                  ["REVIEW", "RECRUITING", "IN_PROGRESS"].includes(
                    campaign.status,
                  ),
              ),
          )
          .map(summarizeBrandProposal);
        const pendingProposalCount = await tx.campaignProposal.count({
          where: {
            publishedAt: { not: null },
            supersededAt: null,
            status: { in: ["PUBLISHED", "CHANGES_REQUESTED", "REJECTED"] },
            expiresAt: { gt: new Date() },
            campaign: {
              brandOrganizationId: organizationId,
              status: { in: ["REVIEW", "RECRUITING", "IN_PROGRESS"] },
            },
            items: { some: { status: "PENDING" } },
          },
        });
        const metadata = object(member.organization.metadata);
        return {
          account: {
            name: member.organization.name,
            email: member.user.email,
            countryCode: member.organization.countryCode,
            websiteUrl: member.organization.websiteUrl,
            contactName: string(metadata.contactName),
            industry: string(metadata.industry),
            companySize: string(metadata.companySize),
            role: member.role,
            status: "ACTIVE",
          },
          permissions: {
            canManageCampaigns: member.role !== "MEMBER",
            canEditAccount: member.role === "OWNER",
          },
          campaigns: campaigns.slice(0, 100).map((campaign) =>
            campaignDto(
              campaign,
              intakeRequests,
              proposalSummaries.get(campaign.id) ?? null,
              production.filter((item) => item.campaignId === campaign.id),
              reporting.filter((item) => item.campaignId === campaign.id),
              invoices.filter((invoice) => invoice.campaignId === campaign.id),
            ),
          ),
          requests: requests.slice(0, 100).map(requestDto),
          invoices,
          pendingProposals,
          links: links.map((link) => ({
            ...link,
            createdAt: link.createdAt.toISOString(),
          })),
          counts: {
            waitingContentReviews,
            pendingProposals: pendingProposalCount,
            campaigns: groupedCampaigns.reduce(
              (sum, group) => sum + group._count._all,
              0,
            ),
            activeCampaigns: groupedCampaigns
              .filter(
                (group) =>
                  !["DRAFT", "COMPLETED", "CANCELED"].includes(group.status),
              )
              .reduce((sum, group) => sum + group._count._all, 0),
            completedCampaigns:
              groupedCampaigns.find((group) => group.status === "COMPLETED")
                ?._count._all ?? 0,
            openRequests: groupedRequests
              .filter((group) =>
                ["REQUESTED", "IN_PROGRESS", "WAITING_BRAND"].includes(
                  group.status,
                ),
              )
              .reduce((sum, group) => sum + group._count._all, 0),
            waitingBrandRequests:
              groupedRequests.find((group) => group.status === "WAITING_BRAND")
                ?._count._all ?? 0,
          },
          hasMoreCampaigns: campaigns.length > 100,
          hasMoreRequests: requests.length > 100,
          capabilities,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
    return json(result);
  });
}

export function brandCampaignDetail(request: Request, id: string) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "brand-read", 120);
    const parsed = campaignIdSchema.safeParse(id);
    if (!parsed.success) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
    const result = await getDatabase().$transaction(
      async (tx): Promise<BrandCampaignDetail> => {
        const member = await authorize(tx, session);
        const campaign = await tx.campaign.findFirst({
          where: {
            id: parsed.data,
            brandOrganizationId: member.organizationId,
          },
          select: campaignSelect,
        });
        if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
        const requests = await tx.workspaceToolRequest.findMany({
          where: {
            organizationId: member.organizationId,
            campaignId: campaign.id,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1000,
          select: requestSelect,
        });
        const [proposals, production, reporting, invoices] = await Promise.all([
          listBrandCampaignProposals(
            tx,
            member.organizationId,
            campaign.id,
            member.role !== "MEMBER",
          ),
          listBrandProductionItems(
            tx,
            member.organizationId,
            campaign.id,
            member.role !== "MEMBER",
          ),
          listBrandReportingItems(tx, member.organizationId, campaign.id),
          listBrandInvoices(
            tx,
            { userId: session.user.id, organizationId: member.organizationId },
            campaign.id,
          ),
        ]);
        return {
          campaign: campaignDto(
            campaign,
            requests,
            proposals[0] ? summarizeBrandProposal(proposals[0]) : null,
            production,
            reporting,
            invoices,
          ),
          requests: requests.map(requestDto),
          proposals,
          deliverables: production,
          performance: { items: reporting },
          invoices,
          capabilities,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
    return json(result);
  });
}

function assertFutureDeadline(
  value: string | null | undefined,
  desiredDate?: string,
) {
  if (value && !isValidRecruitmentDeadline(value, desiredDate))
    fail(
      400,
      "INVALID_DEADLINE",
      "모집 마감은 현재 이후, 희망 게시일 이전으로 지정해 주세요.",
    );
}
async function createIntake(
  tx: Tx,
  userId: string,
  organizationId: string,
  campaign: { id: string; title: string; summary: string; type: string },
  now: Date,
  previousRequestId?: string,
) {
  const dueAt =
    campaign.type === "MANAGED"
      ? new Date(now.getTime() + 48 * 60 * 60 * 1000)
      : null;
  const prior = previousRequestId
    ? await tx.workspaceToolRequest.findFirst({
        where: {
          id: previousRequestId,
          organizationId,
          campaignId: campaign.id,
        },
        select: { id: true, status: true, version: true, inputJson: true },
      })
    : null;
  if (prior) {
    const previousInput = object(prior.inputJson);
    const originalDueAt =
      originalProposalDeadline(previousInput) ?? dueAt?.toISOString() ?? null;
    const updated = await tx.workspaceToolRequest.updateMany({
      where: {
        id: prior.id,
        organizationId,
        campaignId: campaign.id,
        status: prior.status,
        version: prior.version,
      },
      data: {
        title: `${campaign.title} · 캠페인 의뢰`.slice(0, 160),
        inputJson: {
          ...previousInput,
          input: campaign.summary,
          kind: "campaign-intake",
          waitingFor: null,
          operatorReplyPending: false,
          originalProposalDueAt: originalDueAt,
          proposalPausedAt: null,
          firstSubmittedAt:
            string(previousInput.firstSubmittedAt) ||
            string(previousInput.submittedAt) ||
            now.toISOString(),
          submittedAt: now.toISOString(),
          route: campaign.type === "MANAGED" ? "managed" : "open",
        } as Prisma.InputJsonObject,
        status: "REQUESTED",
        dueAt,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      fail(
        409,
        "CONFLICT",
        "연결된 의뢰가 변경되었습니다. 새로고침 후 다시 제출해 주세요.",
      );
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "request.resubmitted",
        entityType: "WorkspaceToolRequest",
        entityId: prior.id,
        payload: {
          public: true,
          publicDetail:
            campaign.type === "MANAGED"
              ? "보완한 브리프가 다시 접수되었습니다. 제안 예정 시각은 재접수부터 48시간으로 갱신되었습니다."
              : "보완한 브리프가 다시 접수되었습니다. 변경된 모집 조건을 운영팀이 확인합니다.",
          detail: "캠페인 보완 후 기존 의뢰 재접수",
          previousStatus: prior.status,
        },
      },
    });
    return {
      requestId: prior.id,
      submittedAt: now.toISOString(),
      proposalDueAt: dueAt?.toISOString() ?? null,
      originalProposalDueAt: originalDueAt,
    };
  }
  return createInitialIntake(tx, {
    organizationId,
    requesterId: userId,
    actorId: userId,
    campaign,
    now,
  });
}

export function mutateBrandCampaign(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await authenticated(request);
    await membership(getDatabase(), session.user.id);
    await rateLimit(session.user.id, "brand-write", 60);
    const input = await readBody(request, brandCampaignMutationSchema);
    const result = await getDatabase().$transaction(
      async (tx) => {
        const member = await authorize(tx, session);
        requireManager(member);
        const organizationId = member.organizationId;
        const now = new Date();
        if ("action" in input && input.action === "cancel") {
          const campaign = await tx.campaign.findFirst({
            where: { id: input.id, brandOrganizationId: organizationId },
            select: campaignSelect,
          });
          if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
          if (
            !["DRAFT", "REVIEW"].includes(campaign.status) ||
            campaign.updatedAt.toISOString() !== input.expectedUpdatedAt
          )
            fail(
              409,
              "INVALID_STATE",
              "캠페인이 변경되었거나 직접 취소할 수 없는 단계입니다.",
            );
          const intakeId = string(
            object(object(campaign.requirements).brandIntake).requestId,
          );
          const intake = intakeId
            ? await tx.workspaceToolRequest.findFirst({
                where: {
                  id: intakeId,
                  organizationId,
                  campaignId: campaign.id,
                },
                select: { id: true, status: true, version: true },
              })
            : null;
          if (
            intake &&
            ["IN_PROGRESS", "WAITING_BRAND"].includes(intake.status)
          )
            fail(
              409,
              "CANCEL_REVIEW_REQUIRED",
              "운영팀이 의뢰를 처리 중입니다. 캠페인 문의에서 취소를 요청해 주세요.",
            );
          if (intake?.status === "REQUESTED") {
            const closed = await tx.workspaceToolRequest.updateMany({
              where: {
                id: intake.id,
                organizationId,
                campaignId: campaign.id,
                status: "REQUESTED",
                version: intake.version,
              },
              data: {
                status: "CLOSED",
                dueAt: null,
                version: { increment: 1 },
              },
            });
            if (closed.count !== 1)
              fail(
                409,
                "CONFLICT",
                "의뢰 상태가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
              );
            await tx.auditLog.create({
              data: {
                actorId: session.user.id,
                action: "request.closed",
                entityType: "WorkspaceToolRequest",
                entityId: intake.id,
                payload: {
                  public: true,
                  publicDetail:
                    "브랜드가 캠페인을 취소하여 의뢰를 종료했습니다.",
                  detail: "캠페인 취소로 접수 상태의 연결 의뢰 종료",
                },
              },
            });
          }
          const canceled = await tx.campaign.update({
            where: { id: campaign.id },
            data: { status: "CANCELED" },
            select: { updatedAt: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "campaign.cancel",
              entityType: "Campaign",
              entityId: campaign.id,
            },
          });
          return {
            id: campaign.id,
            status: "CANCELED",
            updatedAt: canceled.updatedAt.toISOString(),
          };
        }
        const isDraft = "action" in input && input.action === "saveDraft";
        if ("action" in input && input.action === "submitDraft") {
          const campaign = await tx.campaign.findFirst({
            where: { id: input.id, brandOrganizationId: organizationId },
            select: campaignSelect,
          });
          if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
          const requirements = object(campaign.requirements);
          const previous = object(requirements.brandIntake);
          if (
            previous.clientRequestId === input.clientRequestId &&
            campaign.status !== "DRAFT" &&
            string(previous.requestId)
          ) {
            const existing = await tx.workspaceToolRequest.findFirst({
              where: {
                id: string(previous.requestId),
                campaignId: campaign.id,
                organizationId,
              },
              select: { id: true, dueAt: true },
            });
            if (existing)
              return {
                id: campaign.id,
                requestId: existing.id,
                submittedAt: iso(previous.submittedAt)!,
                originalProposalDueAt: iso(previous.originalProposalDueAt),
                proposalDueAt:
                  campaign.type === "MANAGED"
                    ? (existing.dueAt?.toISOString() ?? null)
                    : null,
              } satisfies BrandCampaignCreated;
          }
          if (
            campaign.status !== "DRAFT" ||
            campaign.updatedAt.toISOString() !== input.expectedUpdatedAt
          )
            fail(
              409,
              "INVALID_STATE",
              "캠페인이 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
            );
          if (
            (requirements.brandBrief !== undefined &&
              !brandBriefSchema.safeParse(requirements.brandBrief).success) ||
            !campaign.summary.trim() ||
            !campaign.platforms.length ||
            !campaign.budgetAmount ||
            Number(campaign.budgetAmount) <= 0 ||
            !campaign.contentDeadline ||
            (campaign.type === "OPEN_BIDDING" &&
              !campaign.applicationDeadline) ||
            !isFutureBrandDate(
              campaign.contentDeadline.toISOString().slice(0, 10),
              now,
            )
          )
            fail(
              400,
              "INCOMPLETE_BRIEF",
              "브리프, 예산, 플랫폼, 희망 게시일을 저장한 뒤 제출해 주세요.",
            );
          assertFutureDeadline(
            campaign.applicationDeadline?.toISOString(),
            campaign.contentDeadline.toISOString().slice(0, 10),
          );
          const intake = await createIntake(
            tx,
            session.user.id,
            organizationId,
            campaign,
            now,
            string(previous.requestId) || undefined,
          );
          await tx.campaign.update({
            where: { id: campaign.id },
            data: {
              status: "REVIEW",
              requirements: {
                ...requirements,
                brandIntake: {
                  schemaVersion: 1,
                  clientRequestId: input.clientRequestId,
                  ...intake,
                },
              } as Prisma.InputJsonObject,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "campaign.submit",
              entityType: "Campaign",
              entityId: campaign.id,
            },
          });
          return { id: campaign.id, ...intake };
        }
        if (
          (!isDraft || input.desiredDate) &&
          !isFutureBrandDate(input.desiredDate, now)
        )
          fail(400, "INVALID_DATE", "희망 게시일은 내일 이후로 선택해 주세요.");
        if (input.route === "open")
          assertFutureDeadline(input.applicationDeadline, input.desiredDate);
        if (!isDraft && input.route === "open" && !input.applicationDeadline)
          fail(
            400,
            "INVALID_DEADLINE",
            "오픈 캠페인의 모집 마감일을 입력해 주세요.",
          );
        const game = await resolveCampaignGame(tx, organizationId, input);
        if (input.gameId && !game) fail(400, "INVALID_GAME", "선택한 게임을 찾을 수 없습니다. 다시 선택해 주세요.");
        const { brief, values } = campaignFieldsFromBrief({ ...input,
          gameId: game?.id ?? null, gameName: game ? localizedGame(game, input.gameLocale).title : input.gameName,
        });
        const payloadHash = createHash("sha256")
          .update(JSON.stringify({ ...input, clientRequestId: undefined }))
          .digest("hex");
        if (!("id" in input && input.id)) {
          const duplicate = await tx.campaign.findFirst({
            where: {
              brandOrganizationId: organizationId,
              requirements: {
                path: ["brandIntake", "clientRequestId"],
                equals: input.clientRequestId,
              },
            },
            select: campaignSelect,
          });
          if (duplicate) {
            const prior = object(object(duplicate.requirements).brandIntake);
            if (prior.payloadHash !== payloadHash)
              fail(
                409,
                "DUPLICATE_REQUEST",
                "이미 처리한 요청입니다. 새 요청으로 다시 작성해 주세요.",
              );
            if (isDraft && duplicate.status !== "DRAFT")
              fail(
                409,
                "INVALID_STATE",
                "이미 제출한 캠페인은 초안으로 저장할 수 없습니다.",
              );
            if (isDraft)
              return {
                id: duplicate.id,
                draft: true,
                updatedAt: duplicate.updatedAt.toISOString(),
              };
            const existing = await tx.workspaceToolRequest.findFirst({
              where: {
                id: string(prior.requestId),
                organizationId,
                campaignId: duplicate.id,
              },
              select: { id: true, dueAt: true },
            });
            if (!existing)
              fail(409, "INVALID_STATE", "캠페인 의뢰 상태를 확인해 주세요.");
            return {
              id: duplicate.id,
              requestId: existing.id,
              submittedAt: iso(prior.submittedAt)!,
              originalProposalDueAt: iso(prior.originalProposalDueAt),
              proposalDueAt:
                duplicate.type === "MANAGED"
                  ? (existing.dueAt?.toISOString() ?? null)
                  : null,
            } satisfies BrandCampaignCreated;
          }
        }
        if ("id" in input && input.id) {
          const campaign = await tx.campaign.findFirst({
            where: { id: input.id, brandOrganizationId: organizationId },
            select: campaignSelect,
          });
          if (!campaign) fail(404, "NOT_FOUND", "캠페인을 찾을 수 없습니다.");
          if (
            campaign.status !== "DRAFT" ||
            campaign.updatedAt.toISOString() !== input.expectedUpdatedAt
          )
            fail(
              409,
              "INVALID_STATE",
              "수정 가능한 최신 초안인지 확인해 주세요.",
            );
          const updated = await tx.campaign.update({
            where: { id: campaign.id },
            data: {
              ...values,
              requirements: {
                ...object(campaign.requirements),
                brandBrief: brief,
              } as Prisma.InputJsonObject,
            },
            select: { updatedAt: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "campaign.updated",
              entityType: "Campaign",
              entityId: campaign.id,
            },
          });
          return {
            id: campaign.id,
            draft: true,
            updatedAt: updated.updatedAt.toISOString(),
          };
        }
        if (
          (await tx.campaign.count({
            where: { brandOrganizationId: organizationId },
          })) >= 100
        )
          fail(
            409,
            "LIMIT_REACHED",
            "캠페인 등록 한도에 도달했습니다. 운영팀에 문의해 주세요.",
          );
        const campaign = await tx.campaign.create({
          data: {
            ...values,
            brandOrganizationId: organizationId,
            createdById: session.user.id,
            status: isDraft ? "DRAFT" : "REVIEW",
            requirements: {
              brandBrief: brief,
              brandIntake: {
                schemaVersion: 1,
                clientRequestId: input.clientRequestId,
                payloadHash,
              },
            },
          },
          select: campaignSelect,
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: isDraft ? "campaign.created" : "campaign.submit",
            entityType: "Campaign",
            entityId: campaign.id,
          },
        });
        if (isDraft)
          return {
            id: campaign.id,
            draft: true,
            updatedAt: campaign.updatedAt.toISOString(),
          };
        const intake = await createIntake(
          tx,
          session.user.id,
          organizationId,
          campaign,
          now,
        );
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            requirements: {
              brandBrief: brief,
              brandIntake: {
                schemaVersion: 1,
                clientRequestId: input.clientRequestId,
                payloadHash,
                ...intake,
              },
            },
          },
        });
        return { id: campaign.id, ...intake } satisfies BrandCampaignCreated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    );
    return json(result);
  });
}
