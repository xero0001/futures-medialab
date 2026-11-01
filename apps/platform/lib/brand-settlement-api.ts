import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { ProductionError } from "@futures-medialab/database/production";
import { SettlementError, listBrandInvoices, settlementTransaction } from "@futures-medialab/database/settlement";
import { settlementIdSchema } from "@futures-medialab/database/settlement-validation";
import { getAuth } from "./auth";
import { fail, json, membership, rateLimit, workspaceBoundary } from "./workspace-api";

export function brandSettlementApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (request.method !== "GET") return json({ code: "METHOD_NOT_ALLOWED", message: "청구 내역은 조회만 가능합니다." }, 405);
      const session = await getAuth().api.getSession({ headers: request.headers });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await membership(getDatabase(), session.user.id);
      await rateLimit(session.user.id, "brand-settlement-read", 120);
      const rawId = new URL(request.url).searchParams.get("campaignId");
      const campaign = rawId === null ? undefined : settlementIdSchema.safeParse(rawId);
      if (campaign && !campaign.success) fail(400, "INVALID_INPUT", "캠페인을 확인해 주세요.");
      const actor = { userId: session.user.id, sessionId: session.session.id, kind: "brand" as const, organizationId: member.organizationId };
      return json(await settlementTransaction(actor, async tx => ({ invoices: await listBrandInvoices(tx, actor, campaign?.data) })));
    } catch (error) {
      if (error instanceof SettlementError || error instanceof ProductionError) return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
