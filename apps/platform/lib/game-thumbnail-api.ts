import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { gameThumbnailUrl } from "@futures-medialab/database/game-thumbnail-shared";
import { serveGameThumbnail } from "@futures-medialab/database/game-thumbnail-storage";
import { getAuth } from "./auth";
import { fail, workspaceBoundary } from "./workspace-api";

export function platformGameThumbnail(request: Request, hash: string) {
  return workspaceBoundary(() =>
    serveGameThumbnail(request, hash, async () => {
      const session = await getAuth().api.getSession({
        headers: request.headers,
      });
      if (!session) fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      const members = await getDatabase().organizationMember.findMany({
        where: {
          userId: session.user.id,
          organization: { type: { in: ["BRAND", "AGENCY"] }, status: "ACTIVE" },
        },
        select: { organizationId: true },
      });
      if (!members.length) fail(403, "FORBIDDEN", "조직 권한을 확인해 주세요.");
      const organizationIds = members.map((row) => row.organizationId);
      const game = await getDatabase().gameCatalog.findFirst({
        where: {
          thumbnailUrl: gameThumbnailUrl(hash),
          OR: [
            { verified: true },
            { organizationId: { in: organizationIds } },
            {
              campaigns: {
                some: { brandOrganizationId: { in: organizationIds } },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!game) fail(404, "NOT_FOUND", "게임 이미지를 찾을 수 없습니다.");
    }),
  );
}
