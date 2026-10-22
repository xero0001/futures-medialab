import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import {
  canAccessCampaign,
  DEMO_CAMPAIGN_BRAND_ID,
  isDemoCampaign,
} from "./campaign-demo";
import {
  agencyApplicationSchema,
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
import type {
  AgencyApplication,
  AgencyCampaignBootstrap,
  BrandCampaignApplication,
} from "./campaign-marketplace-types";

type Tx = Prisma.TransactionClient;
type Db = Tx | ReturnType<typeof getDatabase>;

async function authenticated(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
  return session;
}

async function liveSession(
  tx: Tx,
  session: Awaited<ReturnType<typeof authenticated>>,
) {
  if (
    !(await tx.session.findFirst({
      where: {
        id: session.session.id,
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }))
  ) {
    fail(401, "UNAUTHORIZED", "Log in to continue.");
  }
}

async function agencyMember(db: Db, userId: string, write = false) {
  const member = await db.organizationMember.findFirst({
    where: { userId, organization: { type: "AGENCY" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: {
      role: true,
      organizationId: true,
      organization: { select: { status: true, metadata: true } },
    },
  });
  if (!member || member.organization.status === "SUSPENDED")
    fail(403, "FORBIDDEN", "This agency workspace is unavailable.");
  if (
    member.organization.status !== "ACTIVE" ||
    (!hasSubmittedAgencyProfile(member.organization.metadata) &&
      !hasApprovedTestWorkspaceAccess(member.organization))
  ) {
    fail(
      403,
      "APPROVAL_REQUIRED",
      "Your organization must be approved before viewing live campaigns.",
    );
  }
  if (write && member.role === "MEMBER")
    fail(
      403,
      "FORBIDDEN",
      "Only an owner or administrator can manage applications.",
    );
  return member;
}

const applicationSelect = {
  id: true,
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
              budgetAmount: true,
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
              ...campaign,
              isDemo: isDemoCampaign({ requirements, brandOrganizationId }),
              budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
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

export async function agencyApplications(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await authenticated(request);
    await agencyMember(getDatabase(), session.user.id, true);
    await rateLimit(session.user.id, "agency-apply", 30);
    const input = await readBody(request, agencyApplicationSchema);
    await getDatabase().$transaction(
      async (tx) => {
        await liveSession(tx, session);
        const member = await agencyMember(tx, session.user.id, true);
        const testAccess = hasApprovedTestWorkspaceAccess(member.organization);
        if (input.action === "withdraw") {
          const application = await tx.campaignApplication.findFirst({
            where: {
              id: input.applicationId,
              agencyOrganizationId: member.organizationId,
            },
            select: {
              campaign: {
                select: { requirements: true, brandOrganizationId: true },
              },
            },
          });
          if (
            !application ||
            !canAccessCampaign(application.campaign, testAccess)
          )
            fail(409, "INVALID_STATE", "This application cannot be withdrawn.");
          const result = await tx.campaignApplication.updateMany({
            where: {
              id: input.applicationId,
              agencyOrganizationId: member.organizationId,
              status: { in: ["SUBMITTED", "SHORTLISTED"] },
            },
            data: { status: "WITHDRAWN" },
          });
          if (!result.count)
            fail(409, "INVALID_STATE", "This application cannot be withdrawn.");
          await tx.auditLog.create({
            data: {
              actorId: session.user.id,
              action: "application.withdrawn",
              entityType: "CampaignApplication",
              entityId: input.applicationId,
            },
          });
          return;
        }
        const campaign = await tx.campaign.findFirst({
          where: {
            id: input.campaignId,
            status: "RECRUITING",
            publishedAt: { not: null },
            applicationDeadline: { gt: new Date() },
            brandOrganization: { type: "BRAND", status: "ACTIVE" },
          },
          select: {
            id: true,
            currency: true,
            requirements: true,
            brandOrganizationId: true,
          },
        });
        if (!campaign || !canAccessCampaign(campaign, testAccess))
          fail(
            409,
            "CAMPAIGN_CLOSED",
            "This campaign is not accepting applications.",
          );
        const existing = await tx.campaignApplication.findUnique({
          where: {
            campaignId_agencyOrganizationId: {
              campaignId: campaign.id,
              agencyOrganizationId: member.organizationId,
            },
          },
          select: { id: true },
        });
        if (existing)
          fail(
            409,
            "ALREADY_APPLIED",
            "Your organization has already applied to this campaign.",
          );
        if (
          (await tx.campaignApplication.count({
            where: { agencyOrganizationId: member.organizationId },
          })) >= 1000
        )
          fail(
            409,
            "LIMIT_REACHED",
            "The application limit for this organization has been reached.",
          );
        const application = await tx.campaignApplication.create({
          data: {
            campaignId: campaign.id,
            agencyOrganizationId: member.organizationId,
            submittedById: session.user.id,
            proposal: input.proposal,
            proposedAmount: input.proposedAmount ?? null,
            currency: campaign.currency,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "application.submitted",
            entityType: "CampaignApplication",
            entityId: application.id,
            payload: { campaignId: campaign.id },
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
