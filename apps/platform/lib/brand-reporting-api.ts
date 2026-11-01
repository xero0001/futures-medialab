import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { ProductionError } from "@futures-medialab/database/production";
import {
  ReportingError,
  listBrandReportingItems,
  reportingTransaction,
} from "@futures-medialab/database/reporting";
import { reportingIdSchema } from "@futures-medialab/database/reporting-validation";
import { getAuth } from "./auth";
import {
  fail,
  json,
  membership,
  rateLimit,
  workspaceBoundary,
} from "./workspace-api";

export function brandReportingApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (request.method !== "GET")
        return json(
          {
            code: "METHOD_NOT_ALLOWED",
            message: "조회만 가능한 보고서입니다.",
          },
          405,
        );
      const session = await getAuth().api.getSession({
        headers: request.headers,
      });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await membership(getDatabase(), session.user.id);
      await rateLimit(session.user.id, "brand-reporting-read", 120);
      const campaignId = reportingIdSchema.safeParse(
        new URL(request.url).searchParams.get("campaignId"),
      );
      if (!campaignId.success)
        fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
      const actor = {
        userId: session.user.id,
        sessionId: session.session.id,
        kind: "brand" as const,
        organizationId: member.organizationId,
      };
      return json(
        await reportingTransaction(actor, async (tx) => ({
          items: await listBrandReportingItems(
            tx,
            actor.organizationId,
            campaignId.data,
          ),
        })),
      );
    } catch (error) {
      if (error instanceof ReportingError || error instanceof ProductionError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
