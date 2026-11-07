import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import {
  canAccessCampaign,
  DEMO_CAMPAIGN_BRAND_ID,
  getDemoCampaignArtwork,
  isDemoCampaign,
} from "./campaign-demo";
import { campaignArtwork } from "./campaign-artwork";
import { fail, json, rateLimit, workspaceBoundary } from "./workspace-api";
import type {
  AgencyAssignedCampaign,
  AgencyProjectsResponse,
  AgencyProjectStage,
} from "./agency-projects-types";

const limits = { projects: 100 };
const publicProposal = {
  publishedAt: { not: null },
  status: { in: ["PUBLISHED", "APPROVED", "CHANGES_REQUESTED", "REJECTED"] },
  supersededAt: null,
} satisfies Prisma.CampaignProposalWhereInput;
const publishedHistory = {
  publishedAt: { not: null },
  status: { not: "DRAFT" },
} satisfies Prisma.CampaignProposalWhereInput;

function assignedProposalItem(
  organizationId: string,
): Prisma.ProposalItemWhereInput {
  return {
    OR: [
      { productionItem: { supplierOrganizationId: organizationId } },
      { productionItem: { is: null }, supplierOrganizationId: organizationId },
    ],
  };
}

function assignedCampaignSelect(organizationId: string) {
  return {
    id: true,
    title: true,
    type: true,
    status: true,
    platforms: true,
    contentDeadline: true,
    createdAt: true,
    updatedAt: true,
    requirements: true,
    brandOrganizationId: true,
    coverImageUrl: true,
    applications: {
      where: { agencyOrganizationId: organizationId, status: "ACCEPTED", rows: { none: {} } },
      select: { agencyOrganizationId: true, status: true },
    },
    // A new private draft never shadows the last published version.
    proposals: {
      where: publicProposal,
      orderBy: [{ version: "desc" }, { id: "asc" }],
      take: 1,
      select: {
        id: true,
        status: true,
        publishedAt: true,
        supersededAt: true,
        items: {
          where: assignedProposalItem(organizationId),
          select: {
            supplierOrganizationId: true,
            productionItem: { select: { supplierOrganizationId: true } },
          },
        },
      },
    },
    productionItems: {
      where: {
        supplierOrganizationId: organizationId,
        proposalItem: { proposal: publishedHistory },
      },
      select: {
        supplierOrganizationId: true,
        status: true,
        proposalItem: {
          select: {
            status: true,
            proposal: {
              select: {
                id: true,
                campaignId: true,
                status: true,
                publishedAt: true,
              },
            },
          },
        },
        reportingItem: {
          select: {
            campaignId: true,
            status: true,
            _count: {
              select: { submissions: { where: { releasedAt: { not: null } } } },
            },
          },
        },
      },
    },
    agencyPayouts: {
      where: {
        supplierOrganizationId: organizationId,
        issuedAt: { not: null },
        status: { in: ["ISSUED", "PAID"] },
      },
      select: { supplierOrganizationId: true, status: true, issuedAt: true },
    },
  } satisfies Prisma.CampaignSelect;
}

type CampaignRow = Prisma.CampaignGetPayload<{
  select: ReturnType<typeof assignedCampaignSelect>;
}>;

function projectDto(
  row: CampaignRow,
  organizationId: string,
  testAccess: boolean,
): AgencyAssignedCampaign | null {
  if (!canAccessCampaign(row, testAccess)) return null;
  const currentProposal = row.proposals.find(
    (proposal) =>
      proposal.publishedAt !== null &&
      proposal.supersededAt === null &&
      ["PUBLISHED", "APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
        proposal.status,
      ),
  );
  const acceptedApplication = row.applications.some(
    (application) =>
      application.agencyOrganizationId === organizationId &&
      application.status === "ACCEPTED",
  );
  const officialProposalItems =
    currentProposal?.items.filter(
      // Once prepared, the final production assignment replaces the proposal's
      // initial supplier. Reassignment must not leave access with the old agency.
      (item) =>
        (item.productionItem
          ? item.productionItem.supplierOrganizationId
          : item.supplierOrganizationId) === organizationId,
    ).length ?? 0;
  const production = row.productionItems.filter(
    (item) =>
      item.supplierOrganizationId === organizationId &&
      item.proposalItem.proposal.campaignId === row.id &&
      item.proposalItem.proposal.publishedAt !== null &&
      item.proposalItem.proposal.status !== "DRAFT",
  );
  if (
    !acceptedApplication &&
    officialProposalItems === 0 &&
    production.length === 0
  )
    return null;
  const currentProduction = production.filter(
    (item) =>
      currentProposal?.status === "APPROVED" &&
      item.proposalItem.proposal.id === currentProposal.id &&
      item.proposalItem.status === "APPROVED",
  );
  const reports = production.flatMap((item) =>
    item.reportingItem?.campaignId === row.id ? [item.reportingItem] : [],
  );
  const currentReports = currentProduction.flatMap((item) =>
    item.status === "APPROVED" && item.reportingItem?.campaignId === row.id
      ? [item.reportingItem]
      : [],
  );
  const payouts = row.agencyPayouts.filter(
    (payout) =>
      payout.supplierOrganizationId === organizationId &&
      payout.issuedAt !== null &&
      ["ISSUED", "PAID"].includes(payout.status),
  );
  const availableStages: AgencyProjectStage[] = [];
  if (production.length) availableStages.push("production");
  if (reports.length) availableStages.push("reporting");
  if (payouts.length) availableStages.push("settlement");
  if (acceptedApplication) availableStages.push("records");
  const artwork = campaignArtwork(row.coverImageUrl, row.requirements);
  return {
    campaignId: row.id,
    campaignTitle: row.title.slice(0, 160),
    campaignStatus: row.status,
    campaignType: row.type,
    platforms: row.platforms.slice(0, 6),
    contentDeadline: row.contentDeadline?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isDemo: isDemoCampaign(row),
    isClosed: row.status === "COMPLETED" || row.status === "CANCELED",
    ...artwork,
    coverImageUrl: artwork.coverImageUrl ?? getDemoCampaignArtwork(row),
    assignment: {
      acceptedApplication,
      officialProposalItems,
      production: production.length > 0,
    },
    production: {
      total: production.length,
      current: currentProduction.length,
      awaitingSubmission: currentProduction.filter(
        (item) => item.status === "AWAITING_SUBMISSION",
      ).length,
      underReview: currentProduction.filter((item) =>
        ["ADMIN_REVIEW", "BRAND_REVIEW"].includes(item.status),
      ).length,
      changesRequested: currentProduction.filter((item) =>
        ["AGENCY_REVISION", "BRAND_REVISION"].includes(item.status),
      ).length,
      approved: currentProduction.filter((item) => item.status === "APPROVED")
        .length,
    },
    reporting: {
      total: reports.length,
      current: currentReports.length,
      awaitingSubmission: currentReports.filter(
        (item) => item.status === "AWAITING_SUBMISSION",
      ).length,
      underReview: currentReports.filter(
        (item) => item.status === "ADMIN_REVIEW",
      ).length,
      changesRequested: currentReports.filter(
        (item) => item.status === "AGENCY_REVISION",
      ).length,
      published: currentReports.filter((item) => item.status === "PUBLISHED")
        .length,
      publicReports: currentReports.filter(
        (item) => item._count.submissions > 0,
      ).length,
    },
    settlement: {
      issued: payouts.filter((payout) => payout.status === "ISSUED").length,
      paid: payouts.filter((payout) => payout.status === "PAID").length,
    },
    availableStages,
  };
}

/** Read model only. Call inside the caller's authenticated, consistent transaction. */
export async function readAgencyAssignedCampaigns(
  tx: Prisma.TransactionClient,
  organizationId: string,
  testAccess: boolean,
  campaignId?: string,
): Promise<Pick<AgencyProjectsResponse, "projects" | "limits" | "hasMore">> {
  const where: Prisma.CampaignWhereInput = {
    ...(campaignId ? { id: campaignId } : {}),
    ...(!testAccess
      ? { brandOrganizationId: { not: DEMO_CAMPAIGN_BRAND_ID } }
      : {}),
    OR: [
      {
        applications: {
          some: { agencyOrganizationId: organizationId, status: "ACCEPTED", rows: { none: {} } },
        },
      },
      {
        productionItems: {
          some: {
            supplierOrganizationId: organizationId,
            proposalItem: { proposal: publishedHistory },
          },
        },
      },
      {
        proposals: {
          some: {
            ...publicProposal,
            items: { some: assignedProposalItem(organizationId) },
          },
        },
      },
    ],
  };
  const projects: AgencyAssignedCampaign[] = [];
  let cursor: string | undefined;
  // Filtering demo metadata in application code must not let a page of demo
  // rows obscure later real assignments. Continue until the visible page fills.
  while (projects.length <= limits.projects) {
    const rows = await tx.campaign.findMany({
      where,
      select: assignedCampaignSelect(organizationId),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limits.projects + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) {
      const project = projectDto(row, organizationId, testAccess);
      if (project) projects.push(project);
      if (projects.length > limits.projects) break;
    }
    if (rows.length <= limits.projects || campaignId) break;
    cursor = rows.at(-1)?.id;
  }
  return {
    projects: projects.slice(0, limits.projects),
    limits,
    hasMore: projects.length > limits.projects,
  };
}

export function agencyProjects(request: Request) {
  return workspaceBoundary(async () => {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    const params = new URL(request.url).searchParams;
    const campaignId = params.get("campaignId") ?? undefined;
    if (
      campaignId !== undefined &&
      (!/^[A-Za-z0-9_-]{1,120}$/.test(campaignId) ||
        params.getAll("campaignId").length > 1)
    )
      fail(400, "INVALID_INPUT", "캠페인을 확인해 주세요.");
    await rateLimit(session.user.id, "agency-projects-read", 120);
    const result = await getDatabase().$transaction(
      async (tx): Promise<AgencyProjectsResponse> => {
        if (
          !(await tx.session.findFirst({
            where: {
              id: session.session.id,
              userId: session.user.id,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          }))
        )
          fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
        // Match all agency entry points: never choose the most permissive tenant
        // or accept organizationId from a request, including multi-org accounts.
        const member = await tx.organizationMember.findFirst({
          where: { userId: session.user.id, organization: { type: "AGENCY" } },
          orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
          select: {
            role: true,
            organizationId: true,
            organization: {
              select: { name: true, status: true, metadata: true },
            },
          },
        });
        if (!member || member.organization.status !== "ACTIVE")
          fail(403, "FORBIDDEN", "승인된 에이전시 계정이 필요합니다.");
        const testAccess = hasApprovedTestWorkspaceAccess(member.organization);
        if (
          !hasSubmittedAgencyProfile(member.organization.metadata) &&
          !testAccess
        )
          fail(403, "APPROVAL_REQUIRED", "조직 승인이 필요합니다.");
        const data = await readAgencyAssignedCampaigns(
          tx,
          member.organizationId,
          testAccess,
          campaignId,
        );
        if (campaignId && data.projects.length === 0)
          fail(404, "NOT_FOUND", "담당 캠페인을 찾을 수 없습니다.");
        return {
          organization: {
            name: member.organization.name.slice(0, 120),
            role: member.role,
            isTestWorkspace: testAccess,
          },
          ...data,
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
