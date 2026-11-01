import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { ProductionError } from "@futures-medialab/database/production";
import { SettlementError, listAgencyPayouts, settlementTransaction } from "@futures-medialab/database/settlement";
import { settlementIdSchema } from "@futures-medialab/database/settlement-validation";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import { fail, json, rateLimit, workspaceBoundary } from "./workspace-api";

export function agencySettlementApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (request.method !== "GET") return json({ code: "METHOD_NOT_ALLOWED", message: "지급 정산 내역은 조회만 가능합니다." }, 405);
      const session = await getAuth().api.getSession({ headers: request.headers });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await getDatabase().organizationMember.findFirst({ where: { userId: session.user.id, organization: { type: "AGENCY" } }, orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }], select: { organizationId: true, organization: { select: { status: true, metadata: true } } } });
      if (!member || member.organization.status !== "ACTIVE") fail(403, "FORBIDDEN", "승인된 에이전시 계정이 필요합니다.");
      if (!hasSubmittedAgencyProfile(member.organization.metadata) && !hasApprovedTestWorkspaceAccess(member.organization)) fail(403, "APPROVAL_REQUIRED", "조직 승인이 필요합니다.");
      await rateLimit(session.user.id, "agency-settlement-read", 120);
      const rawId = new URL(request.url).searchParams.get("campaignId");
      const campaign = rawId === null ? undefined : settlementIdSchema.safeParse(rawId);
      if (campaign && !campaign.success) fail(400, "INVALID_INPUT", "캠페인을 확인해 주세요.");
      const actor = { userId: session.user.id, sessionId: session.session.id, kind: "agency" as const, organizationId: member.organizationId };
      return json(await settlementTransaction(actor, async tx => ({ payouts: await listAgencyPayouts(tx, actor, campaign?.data) })));
    } catch (error) {
      if (error instanceof SettlementError || error instanceof ProductionError) return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
