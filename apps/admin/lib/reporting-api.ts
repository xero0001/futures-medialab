import "server-only";
import { ProductionError } from "@futures-medialab/database/production";
import {
  ReportingError,
  applyAdminReportingMutation,
  listAdminReporting,
  reportingTransaction,
} from "@futures-medialab/database/reporting";
import {
  adminReportingMutationSchema,
  reportingIdSchema,
} from "@futures-medialab/database/reporting-validation";
import { readReportingBody } from "@futures-medialab/database/reporting-http";
import {
  boundary,
  fail,
  json,
  rateLimit,
  requireAdmin,
  verifyOrigin,
} from "./access";

export function adminReportingApi(request: Request) {
  return boundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const admin = await requireAdmin(request.headers);
      await rateLimit(
        admin,
        `reporting-${request.method === "GET" ? "read" : "write"}`,
        request.method === "GET" ? 120 : 30,
      );
      const actor = {
        userId: admin.userId,
        sessionId: admin.sessionId,
        kind: "admin" as const,
      };
      if (request.method === "GET") {
        const campaignId = reportingIdSchema.safeParse(
          new URL(request.url).searchParams.get("campaignId"),
        );
        if (!campaignId.success)
          fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
        return json(
          await reportingTransaction(actor, (tx) =>
            listAdminReporting(tx, admin.userId, campaignId.data),
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
        adminReportingMutationSchema,
        32768,
      );
      return json(
        await reportingTransaction(actor, (tx) =>
          applyAdminReportingMutation(tx, admin.userId, input),
        ),
      );
    } catch (error) {
      if (error instanceof ReportingError || error instanceof ProductionError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
