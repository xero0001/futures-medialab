import "server-only";
import { getDatabase } from "@futures-medialab/database";
import {
  ProposalError,
  applyBrandProposalDecision,
  getBrandProposal,
  proposalTransaction,
  requireProposalBrand,
} from "@futures-medialab/database/proposals";
import {
  brandProposalMutationSchema,
  proposalIdSchema,
} from "@futures-medialab/database/proposal-validation";
import { readProposalBody } from "@futures-medialab/database/proposal-http";
import { getAuth } from "./auth";
import {
  fail,
  json,
  membership,
  rateLimit,
  verifyOrigin,
  workspaceBoundary,
} from "./workspace-api";

export function brandProposalsApi(request: Request) {
  return workspaceBoundary(async () => {
    try {
      if (!["GET", "POST"].includes(request.method))
        return json(
          { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 요청입니다." },
          405,
        );
      if (request.method === "POST") verifyOrigin(request);
      const session = await getAuth().api.getSession({
        headers: request.headers,
      });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const member = await membership(getDatabase(), session.user.id);
      await rateLimit(
        session.user.id,
        request.method === "GET"
          ? "brand-proposals-read"
          : "brand-proposals-write",
        request.method === "GET" ? 120 : 30,
      );
      const actor = {
        userId: session.user.id,
        sessionId: session.session.id,
        kind: "brand" as const,
        organizationId: member.organizationId,
      };
      if (request.method === "GET") {
        const id = proposalIdSchema.safeParse(
          new URL(request.url).searchParams.get("proposalId"),
        );
        if (!id.success)
          fail(404, "NOT_FOUND", "공개된 제안을 찾을 수 없습니다.");
        return json(
          await proposalTransaction(actor, async (tx) => {
            const liveMember = await requireProposalBrand(
              tx,
              actor.userId,
              actor.organizationId,
            );
            return {
              proposal: await getBrandProposal(
                tx,
                actor.organizationId,
                id.data,
                liveMember.role !== "MEMBER",
              ),
            };
          }),
        );
      }
      const input = await readProposalBody(
        request,
        brandProposalMutationSchema,
      );
      return json(
        await proposalTransaction(actor, (tx) =>
          applyBrandProposalDecision(tx, actor, input),
        ),
      );
    } catch (error) {
      if (error instanceof ProposalError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
