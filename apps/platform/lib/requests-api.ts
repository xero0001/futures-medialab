import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { requestHttp } from "@futures-medialab/database/request-http";
import { getAuth } from "./auth";
import {
  workspaceBoundary,
  membership,
  verifyOrigin,
  rateLimit,
  fail,
} from "./workspace-api";

export function requestsApi(
  request: Request,
  id?: string,
  attachmentId?: string,
  upload = false,
) {
  return workspaceBoundary(() =>
    requestHttp(
      request,
      {
        authenticate: async (request) => {
          const session = await getAuth().api.getSession({
            headers: request.headers,
          });
          if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
          const member = await membership(getDatabase(), session.user.id);
          return {
            userId: session.user.id,
            sessionId: session.session.id,
            kind: "brand",
            organizationId: member.organizationId,
          };
        },
        verifyOrigin,
        rateLimit: (actor, bucket, limit) =>
          rateLimit(actor.userId, bucket, limit),
      },
      id,
      attachmentId,
      upload,
    ),
  );
}
