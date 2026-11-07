import { createHash } from "node:crypto";
import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import {
  GAME_THUMBNAIL_MAX_BYTES,
  gameThumbnailHash,
  gameThumbnailUrl,
} from "@futures-medialab/database/game-thumbnail-shared";

const pathnameFor = (hash: string) => `game-thumbnails/${hash}.webp`;
function storageOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Game thumbnail storage unavailable");
  return { token };
}
export async function storeGameThumbnail(bytes: Buffer, signal?: AbortSignal) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  // A content-addressed key can only be overwritten with the exact same bytes.
  const result = await put(pathnameFor(hash), bytes, {
    ...storageOptions(),
    access: "private",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
    abortSignal: signal,
  });
  if (result.pathname !== pathnameFor(hash))
    throw new Error("Unexpected thumbnail location");
  return { url: gameThumbnailUrl(hash), hash, size: bytes.length };
}
export async function storedGameThumbnailExists(url: string) {
  const hash = gameThumbnailHash(url);
  if (!hash) return false;
  try {
    const info = await head(pathnameFor(hash), storageOptions());
    return (
      info.pathname === pathnameFor(hash) &&
      info.contentType === "image/webp" &&
      info.size > 0 &&
      info.size <= GAME_THUMBNAIL_MAX_BYTES
    );
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    throw error;
  }
}
export async function serveGameThumbnail(
  request: Request,
  hash: string,
  authorize: () => Promise<void>,
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const missing = () => new Response(null, { status: 404, headers });
  if (!/^[a-f0-9]{64}$/.test(hash)) return missing();
  await authorize();
  try {
    const result = await get(pathnameFor(hash), {
      ...storageOptions(),
      access: "private",
      abortSignal: request.signal,
    });
    if (!result || result.statusCode !== 200) return missing();
    if (
      result.blob.pathname !== pathnameFor(hash) ||
      result.blob.contentType !== "image/webp" ||
      result.blob.size <= 0 ||
      result.blob.size > GAME_THUMBNAIL_MAX_BYTES
    ) {
      await result.stream.cancel();
      return missing();
    }
    const reader = result.stream.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > GAME_THUMBNAIL_MAX_BYTES) {
          await reader.cancel();
          return missing();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks, size);
    if (
      size !== result.blob.size ||
      createHash("sha256").update(bytes).digest("hex") !== hash ||
      bytes.subarray(0, 4).toString() !== "RIFF" ||
      bytes.subarray(8, 12).toString() !== "WEBP"
    )
      return missing();
    await authorize();
    return new Response(bytes, {
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "Content-Length": String(size),
        "Content-Disposition": 'inline; filename="game-thumbnail.webp"',
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return missing();
    throw error;
  }
}
