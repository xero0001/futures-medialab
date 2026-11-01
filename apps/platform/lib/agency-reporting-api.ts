import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { ProductionError } from "@futures-medialab/database/production";
import {
  ReportingError,
  applyAgencyReportingMutation,
  listAgencyReporting,
  reportingTransaction,
} from "@futures-medialab/database/reporting";
import { readReportingBody } from "@futures-medialab/database/reporting-http";
import {
  agencyReportingMutationSchema,
  reportingIdSchema,
} from "@futures-medialab/database/reporting-validation";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import {
  fail,
  json,
  rateLimit,
  verifyOrigin,
  workspaceBoundary,
} from "./workspace-api";

export function agencyReportingApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const session = await getAuth().api.getSession({
        headers: request.headers,
      });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await getDatabase().organizationMember.findFirst({
        where: { userId: session.user.id, organization: { type: "AGENCY" } },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        select: {
          organizationId: true,
          organization: { select: { status: true, metadata: true } },
        },
      });
      if (!member || member.organization.status !== "ACTIVE")
        fail(403, "FORBIDDEN", "승인된 에이전시 계정이 필요합니다.");
      if (
        !hasSubmittedAgencyProfile(member.organization.metadata) &&
        !hasApprovedTestWorkspaceAccess(member.organization)
      )
        fail(403, "APPROVAL_REQUIRED", "조직 승인이 필요합니다.");
      await rateLimit(
        session.user.id,
        `agency-reporting-${request.method === "GET" ? "read" : "write"}`,
        request.method === "GET" ? 120 : 30,
      );
      const actor = {
        userId: session.user.id,
        sessionId: session.session.id,
        kind: "agency" as const,
        organizationId: member.organizationId,
      };
      if (request.method === "GET") {
        const value = new URL(request.url).searchParams.get("campaignId");
        const campaignId =
          value === null ? undefined : reportingIdSchema.safeParse(value);
        if (campaignId && !campaignId.success)
          fail(400, "INVALID_INPUT", "캠페인을 확인해 주세요.");
        return json(
          await reportingTransaction(actor, (tx) =>
            listAgencyReporting(tx, actor, campaignId?.data),
          ),
        );
      }
      if (request.method !== "POST")
        return json(
          { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 요청입니다." },
          405,
        );
      const input = await readReportingBody(
        request,
        agencyReportingMutationSchema,
        32768,
      );
      return json(
        await reportingTransaction(actor, (tx) =>
          applyAgencyReportingMutation(tx, actor, input),
        ),
      );
    } catch (error) {
      if (error instanceof ReportingError || error instanceof ProductionError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
