import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import { canAccessCampaign } from "./campaign-demo";
import { agencyContentSchema, canSubmitContent } from "./agency-content-validation";
import { fail, json, rateLimit, readBody, verifyOrigin, workspaceBoundary } from "./workspace-api";

/** Submission links only. The server never fetches user-provided URLs. */
export function submitAgencyContent(request: Request) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
    await rateLimit(session.user.id, "agency-content-write", 30);
    const input = await readBody(request, agencyContentSchema);
    const result = await getDatabase().$transaction(async (tx) => {
      if (!await tx.session.findFirst({ where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } }, select: { id: true } }))
        fail(401, "UNAUTHORIZED", "Log in to continue.");
      const member = await tx.organizationMember.findFirst({ where: { userId: session.user.id, organization: { type: "AGENCY" } },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        select: { organizationId: true, role: true, organization: { select: { status: true, metadata: true } } } });
      if (!member || member.role === "MEMBER" || member.organization.status !== "ACTIVE")
        fail(403, "FORBIDDEN", "Only an approved agency owner or administrator can submit content.");
      const testAccess = hasApprovedTestWorkspaceAccess(member.organization);
      if (!hasSubmittedAgencyProfile(member.organization.metadata) && !testAccess)
        fail(403, "APPROVAL_REQUIRED", "Organization approval is required.");
      const application = await tx.campaignApplication.findFirst({ where: { id: input.applicationId, agencyOrganizationId: member.organizationId },
        select: { id: true, status: true, campaignId: true, campaign: { select: { status: true, requirements: true, brandOrganizationId: true, brandOrganization: { select: { status: true } } } },
          submissions: { orderBy: { version: "desc" }, take: 1 }, settlement: { select: { status: true } } } });
      if (!application || !canAccessCampaign(application.campaign, testAccess)) fail(404, "NOT_FOUND", "Project not found.");
      if (application.status !== "ACCEPTED" || !["RECRUITING", "IN_PROGRESS", "VERIFYING", "SETTLING"].includes(application.campaign.status) || application.campaign.brandOrganization.status !== "ACTIVE")
        fail(409, "INVALID_STATE", "Content can only be submitted to active selected projects.");
      if (application.settlement && ["APPROVED", "PROCESSING", "PAID"].includes(application.settlement.status))
        fail(409, "LOCKED", "Content is locked after settlement approval.");
      const latest = application.submissions[0];
      if ((latest?.id ?? null) !== input.expectedSubmissionId || (latest?.updatedAt.toISOString() ?? null) !== input.expectedUpdatedAt)
        fail(409, "CONFLICT", "This submission has changed. Refresh the project and try again.");
      if (!canSubmitContent(input.action, latest?.status ?? null))
        fail(409, "INVALID_STATE", "Wait for review before submitting another version. Published links require draft approval.");
      const now = new Date();
      const url = new URL(input.url).href;
      let saved;
      if (input.action === "submitDraft") {
        if ((latest?.version ?? 0) >= 100) fail(409, "LIMIT_REACHED", "The version limit has been reached. Contact the operations team.");
        saved = await tx.contentSubmission.create({ data: { applicationId: application.id, version: (latest?.version ?? 0) + 1,
          draftUrl: url, status: "SUBMITTED", submittedAt: now } });
      } else {
        if (!latest) fail(409, "INVALID_STATE", "An approved draft is required.");
        saved = await tx.contentSubmission.update({ where: { id: latest.id }, data: { publishedUrl: url, status: "PUBLISHED", verifiedAt: null } });
      }
      await tx.auditLog.create({ data: { actorId: session.user.id, action: `content.${input.action}`, entityType: "ContentSubmission", entityId: saved.id,
        payload: { campaignId: application.campaignId, applicationId: application.id, organizationId: member.organizationId,
          previousStatus: latest?.status ?? null, status: saved.status, version: saved.version } } });
      return { success: true, id: saved.id, status: saved.status, version: saved.version };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return json(result);
  });
}
