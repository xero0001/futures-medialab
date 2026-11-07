import "server-only";
import {
  ProductionError,
  type ProductionActor,
} from "@futures-medialab/database/production";
import {
  productionMediaUpload,
  productionMediaStream,
} from "@futures-medialab/database/production-media-http";
import {
  boundary,
  json,
  rateLimit,
  requireAdmin,
  verifyOrigin,
} from "./access";
export function adminProductionMediaApi(request: Request, id?: string) {
  return boundary(async () => {
    try {
      if (request.method === "POST") verifyOrigin(request);
      const admin = await requireAdmin(request.headers);
      await rateLimit(
        admin,
        id ? "production-video-read" : "production-video-write",
        id ? 240 : 30,
      );
      const actor: ProductionActor = {
        userId: admin.userId,
        sessionId: admin.sessionId,
        kind: "admin",
      };
      return await (id
        ? productionMediaStream(request, actor, id)
        : productionMediaUpload(request, actor));
    } catch (error) {
      if (error instanceof ProductionError)
        return json({ code: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
