import "server-only";
import { requestHttp } from "@futures-medialab/database/request-http";
import { boundary, requireAdmin, verifyOrigin, rateLimit } from "./access";

export function requestsApi(
  request: Request,
  id?: string,
  attachmentId?: string,
  upload = false,
) {
  return boundary(() =>
    requestHttp(
      request,
      {
        authenticate: async (request) => ({
          ...(await requireAdmin(request.headers)),
          kind: "admin",
        }),
        verifyOrigin,
        rateLimit: (actor, bucket, limit) =>
          rateLimit({ ...actor, name: "" }, bucket, limit),
      },
      id,
      attachmentId,
      upload,
    ),
  );
}
