import "server-only";
import { getDatabase } from "@futures-medialab/database";
import {
  ProductionError,
  type ProductionActor,
} from "@futures-medialab/database/production";
import {
  productionMediaUpload,
  productionMediaStream,
} from "@futures-medialab/database/production-media-http";
import { getAuth } from "./auth";
import {
  fail,
  json,
  rateLimit,
  verifyOrigin,
  workspaceBoundary,
} from "./workspace-api";
export function platformProductionMediaApi(request: Request, id?: string) {
  return workspaceBoundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const session = await getAuth().api.getSession({
        headers: request.headers,
      });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const members = await getDatabase().organizationMember.findMany({
        where: {
          userId: session.user.id,
          organization: {
            type: { in: id ? ["BRAND", "AGENCY"] : ["AGENCY"] },
            status: "ACTIVE",
          },
        },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        select: {
          organizationId: true,
          organization: { select: { type: true } },
        },
      });
      if (!members.length) fail(403, "FORBIDDEN", "조직 권한을 확인해 주세요.");
      await rateLimit(
        session.user.id,
        id ? "production-video-read" : "production-video-write",
        id ? 240 : 30,
      );
      for (const member of members) {
        const actor: ProductionActor = {
          userId: session.user.id,
          sessionId: session.session.id,
          kind: member.organization.type === "BRAND" ? "brand" : "agency",
          organizationId: member.organizationId,
        };
        try {
          return await (id
            ? productionMediaStream(request, actor, id)
            : productionMediaUpload(request, actor));
        } catch (error) {
          if (id && error instanceof ProductionError && error.status === 404)
            continue;
          throw error;
        }
      }
      fail(404, "NOT_FOUND", "동영상을 찾을 수 없습니다.");
    } catch (error) {
      if (error instanceof ProductionError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
