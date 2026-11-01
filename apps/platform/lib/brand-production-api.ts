import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { ProductionError, applyBrandProductionMutation, listBrandProductionItems, productionTransaction } from "@futures-medialab/database/production";
import { brandProductionMutationSchema, productionIdSchema } from "@futures-medialab/database/production-validation";
import { readProductionBody } from "@futures-medialab/database/production-http";
import { ProposalError, requireProposalBrand } from "@futures-medialab/database/proposals";
import { getAuth } from "./auth";
import { fail, json, membership, rateLimit, verifyOrigin, workspaceBoundary } from "./workspace-api";

export function brandProductionApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const session = await getAuth().api.getSession({ headers: request.headers });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await membership(getDatabase(), session.user.id);
      await rateLimit(session.user.id, `brand-production-${request.method === "GET" ? "read" : "write"}`, request.method === "GET" ? 120 : 30);
      const actor = { userId: session.user.id, sessionId: session.session.id, kind: "brand" as const, organizationId: member.organizationId };
      if (request.method === "GET") {
        const campaignId = productionIdSchema.safeParse(new URL(request.url).searchParams.get("campaignId"));
        if (!campaignId.success) fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
        return json(await productionTransaction(actor, async tx => {
          const live = await requireProposalBrand(tx, actor.userId, actor.organizationId);
          return { items: await listBrandProductionItems(tx, actor.organizationId, campaignId.data, live.role !== "MEMBER") };
        }));
      }
      if (request.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 요청입니다." }, 405);
      const input = await readProductionBody(request, brandProductionMutationSchema, 32768);
      return json(await productionTransaction(actor, tx => applyBrandProductionMutation(tx, actor, input)));
    } catch (error) {
      if (error instanceof ProductionError || error instanceof ProposalError) return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
