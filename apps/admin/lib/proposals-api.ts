import "server-only";
import {
  ProposalError,
  applyAdminProposalMutation,
  listAdminProposals,
  proposalTransaction,
} from "@futures-medialab/database/proposals";
import {
  adminProposalMutationSchema,
  proposalIdSchema,
} from "@futures-medialab/database/proposal-validation";
import { readProposalBody } from "@futures-medialab/database/proposal-http";
import {
  boundary,
  fail,
  json,
  rateLimit,
  requireAdmin,
  verifyOrigin,
} from "./access";

export function adminProposalsApi(request: Request) {
  return boundary(async () => {
    try {
      if (!["GET", "POST"].includes(request.method))
        return json(
          { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 요청입니다." },
          405,
        );
      if (request.method === "POST") verifyOrigin(request);
      const admin = await requireAdmin(request.headers);
      await rateLimit(
        admin,
        request.method === "GET" ? "proposals-read" : "proposals-write",
        request.method === "GET" ? 120 : 30,
      );
      const actor = {
        userId: admin.userId,
        sessionId: admin.sessionId,
        kind: "admin" as const,
      };
      if (request.method === "GET") {
        const campaignId = proposalIdSchema.safeParse(
          new URL(request.url).searchParams.get("campaignId"),
        );
        if (!campaignId.success)
          fail(400, "INVALID_INPUT", "캠페인을 선택해 주세요.");
        return json(
          await proposalTransaction(actor, (tx) =>
            listAdminProposals(tx, admin.userId, campaignId.data),
          ),
        );
      }
      const input = await readProposalBody(
        request,
        adminProposalMutationSchema,
        524_288,
      );
      return json(
        await proposalTransaction(actor, (tx) =>
          applyAdminProposalMutation(tx, admin.userId, input),
        ),
      );
    } catch (error) {
      if (error instanceof ProposalError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
