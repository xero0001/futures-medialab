import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { authenticated, liveSession, agencyMember } from "./agency-api-access";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import {
  canAccessCampaign,
  DEMO_CAMPAIGN_BRAND_ID,
  getDemoCampaignArtwork,
  isDemoCampaign,
} from "./campaign-demo";
import {
  brandApplicationSchema,
  campaignIdSchema,
} from "./campaign-validation";
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
import { supplierOfferCap } from "./supplier-offer";
import type {
  AgencyApplication,
  AgencyCampaignBootstrap,
  BrandCampaignApplication,
} from "./campaign-marketplace-types";

const applicationSelect = {
  id: true,
  _count: { select: { rows: true } },
  campaignId: true,
  status: true,
  proposal: true,
  proposedAmount: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  campaign: {
    select: {
      title: true,
      status: true,
      requirements: true,
      brandOrganizationId: true,
    },
  },
} satisfies Prisma.CampaignApplicationSelect;
type ApplicationRow = Prisma.CampaignApplicationGetPayload<{
  select: typeof applicationSelect;
}>;
function applicationDto(row: ApplicationRow): AgencyApplication {
  return {
    id: row.id,
    hasCreatorRows: row._count.rows > 0,
    campaignId: row.campaignId,
    status: row.status,
    proposal: row.proposal,
    proposedAmount: row.proposedAmount?.toFixed(2) ?? null,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    campaignTitle: row.campaign.title,
    campaignStatus: row.campaign.status,
    isDemo: isDemoCampaign(row.campaign),
  };
}

export async function agencyCampaigns(request: Request) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "agency-read", 120);
    const result = await getDatabase().$transaction(
      async (tx): Promise<AgencyCampaignBootstrap> => {
        await liveSession(tx, session);
        const member = await agencyMember(tx, session.user.id);
        const testAccess = hasApprovedTestWorkspaceAccess(member.organization);
        const demoScope = testAccess
          ? {}
          : { brandOrganizationId: { not: DEMO_CAMPAIGN_BRAND_ID } };
        const [campaigns, applications] = await Promise.all([
          tx.campaign.findMany({
            where: {
              ...demoScope,
              type: "OPEN_BIDDING",
              status: "RECRUITING",
              publishedAt: { not: null },
              applicationDeadline: { gt: new Date() },
              brandOrganization: { type: "BRAND", status: "ACTIVE" },
            },
            orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
            take: 500,
            // Internal demo gates need the owner/requirements, but the response
            // below strips them along with all private brand information.
            select: {
              id: true,
              title: true,
              summary: true,
              platforms: true,
              regions: true,
              categories: true,
              followerMin: true,
              followerMax: true,
              currency: true,
              applicationDeadline: true,
              publishedAt: true,
              status: true,
              requirements: true,
              brandOrganizationId: true,
            },
          }),
          tx.campaignApplication.findMany({
            where: {
              agencyOrganizationId: member.organizationId,
              campaign: demoScope,
            },
            orderBy: { createdAt: "desc" },
            take: 1000,
            select: applicationSelect,
          }),
        ]);
        const own = applications
          .filter((application) =>
            canAccessCampaign(application.campaign, testAccess),
          )
          .map(applicationDto);
        return {
          account: { role: member.role, status: "ACTIVE" },
          applications: own,
          campaigns: campaigns
            .filter((campaign) => canAccessCampaign(campaign, testAccess))
            .map(({ requirements, brandOrganizationId, ...campaign }) => ({
              id: campaign.id,
              title: campaign.title,
              summary: campaign.summary,
              platforms: campaign.platforms,
              regions: campaign.regions,
              categories: campaign.categories,
              followerMin: campaign.followerMin,
              followerMax: campaign.followerMax,
              currency: campaign.currency,
              status: campaign.status,
              isDemo: isDemoCampaign({ requirements, brandOrganizationId }),
              artworkUrl: getDemoCampaignArtwork({
                id: campaign.id,
                requirements,
                brandOrganizationId,
              }),
              supplierRateCap: supplierOfferCap(requirements),
              applicationDeadline:
                campaign.applicationDeadline?.toISOString() ?? null,
              publishedAt: campaign.publishedAt?.toISOString() ?? null,
              application:
                own.find(
                  (application) => application.campaignId === campaign.id,
                ) ?? null,
            })),
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

export { agencyApplications } from "./partner-applications";

export async function brandApplications(request: Request) {
  return workspaceBoundary(async () => {
    const session = await authenticated(request);
    await rateLimit(session.user.id, "campaign-applications-read", 120);
    const parsed = campaignIdSchema.safeParse(
      new URL(request.url).searchParams.get("campaignId"),
    );
    if (!parsed.success)
      fail(400, "INVALID_INPUT", "A campaign ID is required.");
    const result = await getDatabase().$transaction(
      async (tx) => {
        await liveSession(tx, session);
        const member = await membership(tx, session.user.id);
        const campaign = await tx.campaign.findFirst({
          where: {
            id: parsed.data,
            brandOrganizationId: member.organizationId,
          },
          select: { id: true },
        });
        if (!campaign) fail(404, "NOT_FOUND", "Campaign not found.");
        const rows = await tx.campaignApplication.findMany({
          where: { campaignId: campaign.id },
          orderBy: { createdAt: "desc" },
          take: 1000,
          select: { ...applicationSelect, agencyOrganizationId: true },
        });
        const applications: BrandCampaignApplication[] = rows.map((row) => ({
          id: row.id,
          campaignId: row.campaignId,
          status: row.status,
          proposal: row.proposal,
          proposedAmount: row.proposedAmount?.toFixed(2) ?? null,
          currency: row.currency,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          agencyLabel: `Partner ${row.agencyOrganizationId.slice(-8).toUpperCase()}`,
        }));
        return { applications };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
    return json(result);
  });
}

export async function reviewBrandApplication(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await authenticated(request);
    await rateLimit(session.user.id, "application-review", 60);
    const input = await readBody(request, brandApplicationSchema);
    await getDatabase().$transaction(
      async (tx) => {
        await liveSession(tx, session);
        const member = await membership(tx, session.user.id);
        requireManager(member);
        if (member.organization.status !== "ACTIVE")
          fail(403, "APPROVAL_REQUIRED", "Organization approval is required.");
        const status = {
          shortlist: "SHORTLISTED",
          accept: "ACCEPTED",
          reject: "REJECTED",
        } as const;
        const result = await tx.campaignApplication.updateMany({
          where: {
            id: input.applicationId,
            status:
              input.action === "shortlist"
                ? "SUBMITTED"
                : { in: ["SUBMITTED", "SHORTLISTED"] },
            agencyOrganization: { status: "ACTIVE" },
            campaign: {
              brandOrganizationId: member.organizationId,
              status: { in: ["RECRUITING", "IN_PROGRESS"] },
            },
          },
          data: { status: status[input.action] },
        });
        if (!result.count)
          fail(
            409,
            "INVALID_STATE",
            "This application cannot be changed in its current state.",
          );
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: `application.${input.action}`,
            entityType: "CampaignApplication",
            entityId: input.applicationId,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    return json({ success: true });
  });
}
