import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { requestHttp } from "@futures-medialab/database/request-http";
import { authenticated, agencyMember } from "./agency-api-access";
import { workspaceBoundary, verifyOrigin, rateLimit } from "./workspace-api";
export function agencyRequestsApi(
  request: Request,
  id?: string,
  attachmentId?: string,
  upload = false,
) {
  return workspaceBoundary(() =>
    requestHttp(
      request,
      {
        authenticate: async (req) => {
          const session = await authenticated(req);
          const write = req.method !== "GET";
          const member = await agencyMember(
            getDatabase(),
            session.user.id,
            write,
          );
          return {
            userId: session.user.id,
            sessionId: session.session.id,
            kind: "agency",
            organizationId: member.organizationId,
            write,
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
