import "server-only";
import { ProductionError, applyAdminProductionMutation, listAdminProduction, productionTransaction } from "@futures-medialab/database/production";
import { adminProductionMutationSchema, productionIdSchema } from "@futures-medialab/database/production-validation";
import { readProductionBody } from "@futures-medialab/database/production-http";
import { boundary, fail, json, rateLimit, requireAdmin, verifyOrigin } from "./access";

export function adminProductionApi(request: Request) {
  return boundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const admin = await requireAdmin(request.headers);
      await rateLimit(admin, `production-${request.method === "GET" ? "read" : "write"}`, request.method === "GET" ? 120 : 30);
      const actor = { userId: admin.userId, sessionId: admin.sessionId, kind: "admin" as const };
      if (request.method === "GET") {
        const campaignId = productionIdSchema.safeParse(new URL(request.url).searchParams.get("campaignId"));
        if (!campaignId.success) fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
        return json(await productionTransaction(actor, tx => listAdminProduction(tx, admin.userId, campaignId.data)));
      }
      if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 요청입니다." }, 405);
      const input = await readProductionBody(request, adminProductionMutationSchema, 32768);
      return json(await productionTransaction(actor, tx => applyAdminProductionMutation(tx, admin.userId, input)));
    } catch (error) {
      if (error instanceof ProductionError) return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
