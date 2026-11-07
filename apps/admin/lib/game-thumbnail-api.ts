import "server-only";
import { getDatabase } from "@futures-medialab/database";
import {
  GAME_THUMBNAIL_MAX_BYTES,
  GAME_THUMBNAIL_TYPES,
} from "@futures-medialab/database/game-thumbnail-shared";
import {
  serveGameThumbnail,
  storeGameThumbnail,
} from "@futures-medialab/database/game-thumbnail-storage";
import {
  boundary,
  fail,
  json,
  rateLimit,
  recheckAdmin,
  requireAdmin,
  verifyOrigin,
} from "./access";
import { InvalidGameImage, normalizeGameImage } from "./game-thumbnail-image";

export function uploadGameThumbnail(request: Request) {
  return boundary(async () => {
    verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(admin, "game-thumbnail-upload", 20);
    await recheckAdmin(getDatabase(), admin);
    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim())
      fail(
        503,
        "STORAGE_UNAVAILABLE",
        "이미지 저장소가 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      );
    const contentType =
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
    if (
      !GAME_THUMBNAIL_TYPES.includes(
        contentType as (typeof GAME_THUMBNAIL_TYPES)[number],
      )
    )
      fail(400, "INVALID_IMAGE", "PNG, JPG, WebP 이미지 파일을 선택해 주세요.");
    if (
      Number(request.headers.get("content-length")) > GAME_THUMBNAIL_MAX_BYTES
    )
      fail(413, "IMAGE_TOO_LARGE", "이미지는 4MB 이하로 선택해 주세요.");
    const reader = request.body?.getReader();
    if (!reader) fail(400, "INVALID_IMAGE", "이미지 파일을 선택해 주세요.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > GAME_THUMBNAIL_MAX_BYTES) {
          await reader.cancel();
          fail(413, "IMAGE_TOO_LARGE", "이미지는 4MB 이하로 선택해 주세요.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let image: Buffer;
    try {
      image = await normalizeGameImage(
        Buffer.concat(chunks, size),
        contentType,
      );
    } catch (error) {
      if (error instanceof InvalidGameImage)
        fail(400, "INVALID_IMAGE", error.message);
      throw error;
    }
    await recheckAdmin(getDatabase(), admin);
    const result = await storeGameThumbnail(image, request.signal);
    await getDatabase().$transaction(async (tx) => {
      await recheckAdmin(tx, admin);
      await tx.auditLog.create({
        data: {
          actorId: admin.userId,
          action: "admin.game.thumbnail_upload",
          entityType: "GameThumbnail",
          entityId: result.hash,
          payload: { reason: "게임 썸네일 업로드", size: result.size },
        },
      });
    });
    return json({ thumbnailUrl: result.url });
  });
}
export function adminGameThumbnail(request: Request, hash: string) {
  return boundary(async () => {
    const admin = await requireAdmin(request.headers);
    return serveGameThumbnail(request, hash, () =>
      recheckAdmin(getDatabase(), admin),
    );
  });
}
