import sharp from "sharp";
import {
  GAME_THUMBNAIL_MAX_BYTES,
  GAME_THUMBNAIL_TYPES,
} from "@futures-medialab/database/game-thumbnail-shared";

export class InvalidGameImage extends Error {}
export async function normalizeGameImage(bytes: Buffer, contentType: string) {
  if (!bytes.length || bytes.length > GAME_THUMBNAIL_MAX_BYTES)
    throw new InvalidGameImage("이미지는 4MB 이하로 선택해 주세요.");
  const expected = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType];
  if (
    !expected ||
    !GAME_THUMBNAIL_TYPES.includes(
      contentType as (typeof GAME_THUMBNAIL_TYPES)[number],
    )
  )
    throw new InvalidGameImage("PNG, JPG, WebP 이미지 파일을 선택해 주세요.");
  try {
    const options = { limitInputPixels: 20_000_000, failOn: "error" as const };
    const metadata = await sharp(bytes, options).metadata();
    if (
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) > 1
    )
      throw new InvalidGameImage(
        "움직이지 않는 PNG, JPG, WebP 이미지를 선택해 주세요.",
      );
    // Decode and re-encode: strip metadata, apply EXIF orientation, bound dimensions.
    return await sharp(bytes, options)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .timeout({ seconds: 10 })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidGameImage) throw error;
    throw new InvalidGameImage(
      "이미지 파일을 읽을 수 없습니다. 다른 PNG, JPG, WebP 파일을 선택해 주세요.",
    );
  }
}
