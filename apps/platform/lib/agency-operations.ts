import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "./auth";
import { getAgencyProfileValues, hasSubmittedAgencyProfile, metadataRecord } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import { canAccessCampaign, DEMO_CAMPAIGN_BRAND_ID, isDemoCampaign } from "./campaign-demo";
import { fail, json, rateLimit, workspaceBoundary } from "./workspace-api";
import type { AgencyActivity, AgencyOperationsBootstrap } from "./agency-operations-types";

const limits = { projects: 100, settlements: 100, activity: 100 };
const campaignSelect = {
  title: true,
  status: true,
  platforms: true,
  contentDeadline: true,
  requirements: true,
  brandOrganizationId: true,
} satisfies Prisma.CampaignSelect;
const submissionSelect = {
  id: true,
  version: true,
  status: true,
  draftUrl: true,
  publishedUrl: true,
  reviewNotes: true,
  submittedAt: true,
  reviewedAt: true,
  verifiedAt: true,
  updatedAt: true,
} satisfies Prisma.ContentSubmissionSelect;

const text = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
const date = (value: Date | null) => value?.toISOString() ?? null;
function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
function safeLink(value: string | null): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Read-only business data. Shared rateLimit only updates its security counter. */
export async function agencyOperations(request: Request) {
  return workspaceBoundary(async () => {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
    await rateLimit(session.user.id, "agency-operations-read", 120);
    const result = await getDatabase().$transaction(async (tx): Promise<AgencyOperationsBootstrap> => {
      if (!await tx.session.findFirst({
        where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } },
        select: { id: true },
      })) fail(401, "UNAUTHORIZED", "Log in to continue.");

      // Never accept an organization ID from the request. Match marketplace's
      // deterministic membership selection and repeat authorization in this snapshot.
      const member = await tx.organizationMember.findFirst({
        where: { userId: session.user.id, organization: { type: "AGENCY" } },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        select: {
          role: true,
          organizationId: true,
          organization: { select: { name: true, status: true, countryCode: true, metadata: true } },
        },
      });
      if (!member || member.organization.status === "SUSPENDED")
        fail(403, "FORBIDDEN", "This agency workspace is unavailable.");
      const org = member.organization;
      const testAccess = hasApprovedTestWorkspaceAccess(org);
      if (org.status !== "ACTIVE" || (!hasSubmittedAgencyProfile(org.metadata) && !testAccess))
        fail(403, "APPROVAL_REQUIRED", "Your organization must be approved before viewing live records.");
      const organizationId = member.organizationId;
      const demoScope = testAccess ? {} : { brandOrganizationId: { not: DEMO_CAMPAIGN_BRAND_ID } };
      const applicationScope = { agencyOrganizationId: organizationId, campaign: demoScope };
      // An interactive transaction shares one PostgreSQL connection. Read in
      // sequence while retaining the same repeatable-read snapshot.
      const projects = await tx.campaignApplication.findMany({
          where: { ...applicationScope, status: "ACCEPTED" },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: limits.projects,
          select: {
            id: true, campaignId: true, agencyOrganizationId: true, status: true,
            proposedAmount: true, currency: true, createdAt: true, updatedAt: true,
            campaign: { select: campaignSelect },
            creators: {
              where: { creator: { agencyOrganizationId: organizationId } },
              orderBy: { creatorId: "asc" }, take: 25,
              select: { creator: { select: { id: true, agencyOrganizationId: true, displayName: true, countryCode: true, isActive: true } } },
            },
            submissions: { orderBy: [{ version: "desc" }, { id: "asc" }], take: 5, select: submissionSelect },
          },
        });
      const applications = await tx.campaignApplication.findMany({
          where: applicationScope,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: limits.activity,
          select: { id: true, agencyOrganizationId: true, status: true, createdAt: true, updatedAt: true, campaign: { select: campaignSelect } },
        });
      const submissions = await tx.contentSubmission.findMany({
          where: { application: applicationScope },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: limits.activity,
          select: { id: true, status: true, updatedAt: true, application: { select: { agencyOrganizationId: true, campaign: { select: campaignSelect } } } },
        });
      const settlements = await tx.settlement.findMany({
          // Both relations must belong to this organization, even if a malformed
          // imported settlement points at another organization's application.
          where: { agencyOrganizationId: organizationId, application: applicationScope },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: limits.settlements,
          select: {
            id: true, applicationId: true, agencyOrganizationId: true, status: true, currency: true,
            grossAmount: true, platformFeeAmount: true, withholdingAmount: true, netAmount: true,
            createdAt: true, updatedAt: true, requestedAt: true, approvedAt: true, paidAt: true,
            application: { select: { agencyOrganizationId: true, campaign: { select: campaignSelect } } },
          },
        });

      const accessible = (row: { agencyOrganizationId: string; campaign: { brandOrganizationId: string; requirements: unknown } }) =>
        row.agencyOrganizationId === organizationId && canAccessCampaign(row.campaign, testAccess);
      const ownProjects = projects.filter((row) => row.status === "ACCEPTED" && accessible(row));
      const ownApplications = applications.filter(accessible);
      const ownSubmissions = submissions.filter((row) => accessible(row.application));
      const ownSettlements = settlements.filter((row) => row.agencyOrganizationId === organizationId && accessible(row.application));
      const activity: AgencyActivity[] = [];
      for (const row of ownApplications) {
        activity.push({
          id: `application-created:${row.id}`, kind: "application_created", entityId: row.id,
          // The model stores no status-at-creation history. Do not invent one
          // for imported/test records that may have been created as ACCEPTED.
          campaignTitle: text(row.campaign.title, 160), status: "",
          occurredAt: row.createdAt.toISOString(), isDemo: isDemoCampaign(row.campaign),
        });
        // updatedAt is the current record's update time, not an invented history
        // of every shortlist/accept transition.
        if (row.status !== "SUBMITTED" && row.updatedAt.getTime() > row.createdAt.getTime()) activity.push({
          id: `application-status:${row.id}`, kind: "application_status", entityId: row.id,
          campaignTitle: text(row.campaign.title, 160), status: row.status,
          occurredAt: row.updatedAt.toISOString(), isDemo: isDemoCampaign(row.campaign),
        });
      }
      for (const row of ownSubmissions) activity.push({
        id: `submission-status:${row.id}`, kind: "submission_status", entityId: row.id,
        campaignTitle: text(row.application.campaign.title, 160), status: row.status,
        occurredAt: row.updatedAt.toISOString(), isDemo: isDemoCampaign(row.application.campaign),
      });
      for (const row of ownSettlements) activity.push({
        id: `settlement-status:${row.id}`, kind: "settlement_status", entityId: row.id,
        campaignTitle: text(row.application.campaign.title, 160), status: row.status,
        occurredAt: row.updatedAt.toISOString(), isDemo: isDemoCampaign(row.application.campaign),
      });
      const metadata = metadataRecord(org.metadata);
      const review = metadataRecord(metadata.adminReview);
      const reviewedAt = timestamp(review.reviewedAt);
      if (review.status === "APPROVED" && reviewedAt) activity.push({
        id: `organization-review:${reviewedAt}`, kind: "organization_review", entityId: organizationId,
        campaignTitle: null, status: "APPROVED", occurredAt: reviewedAt, isDemo: false,
      });
      const profile = getAgencyProfileValues(org.name, org.metadata);
      const privateProfile = member.role !== "MEMBER";
      return {
        organization: {
          name: text(org.name, 120), agencyType: profile.agencyType, status: "ACTIVE", role: member.role,
          countryCode: org.countryCode,
          submittedAt: hasSubmittedAgencyProfile(org.metadata) ? timestamp(metadata.agencyProfileSubmittedAt) : null,
          isTestWorkspace: testAccess,
          profile: {
            address: text(profile.address, 500), establishedOn: text(profile.establishedOn, 10),
            contactName: privateProfile ? text(profile.contactName, 100) : "",
            contactMethod: profile.contactMethod,
            contactValue: privateProfile ? text(profile.contactValue, 254) : "",
            businessLicenseId: privateProfile ? text(profile.businessLicenseId, 100) : "",
            scopeOfBusiness: text(profile.scopeOfBusiness, 2000),
            platformContact: privateProfile ? text(profile.platformContact, 254) : "",
          },
        },
        projects: ownProjects.map((row) => ({
          id: row.id, campaignId: row.campaignId, campaignTitle: text(row.campaign.title, 160),
          campaignStatus: row.campaign.status, platforms: row.campaign.platforms.slice(0, 6), contentDeadline: date(row.campaign.contentDeadline),
          proposedAmount: row.proposedAmount?.toFixed(2) ?? null, currency: row.currency,
          createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), isDemo: isDemoCampaign(row.campaign),
          creators: row.creators.filter(({ creator }) => creator.agencyOrganizationId === organizationId).map(({ creator }) => ({
            id: creator.id, displayName: text(creator.displayName, 120), countryCode: creator.countryCode, isActive: creator.isActive,
          })),
          submissions: row.submissions.map((submission) => ({
            id: submission.id, version: submission.version, status: submission.status,
            draftUrl: safeLink(submission.draftUrl), publishedUrl: safeLink(submission.publishedUrl),
            reviewNotes: text(submission.reviewNotes, 1000), submittedAt: date(submission.submittedAt),
            reviewedAt: date(submission.reviewedAt), verifiedAt: date(submission.verifiedAt), updatedAt: submission.updatedAt.toISOString(),
          })),
        })),
        settlements: ownSettlements.map((row) => ({
          id: row.id, applicationId: row.applicationId, campaignTitle: text(row.application.campaign.title, 160),
          status: row.status, currency: row.currency, grossAmount: row.grossAmount.toFixed(2),
          platformFeeAmount: row.platformFeeAmount.toFixed(2), withholdingAmount: row.withholdingAmount.toFixed(2), netAmount: row.netAmount.toFixed(2),
          createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
          requestedAt: date(row.requestedAt), approvedAt: date(row.approvedAt), paidAt: date(row.paidAt), isDemo: isDemoCampaign(row.application.campaign),
        })),
        activity: activity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, limits.activity),
        capabilities: { invitations: false, payouts: false, contentSubmission: member.role !== "MEMBER", activityHistory: false },
        limits,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
    return json(result);
  });
}
