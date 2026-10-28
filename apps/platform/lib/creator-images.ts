import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { BlobNotFoundError, get } from "@vercel/blob";
import manifest from "./creator-demo-images.json";
import {
  MAX_CREATOR_IMAGE_BYTES,
  approvedCreatorImageForEntry,
  creatorImagePublicProperties,
  findApprovedCreatorImage,
  validCreatorImageBytes,
} from "./creator-image-policy.mjs";

export { creatorAvatarSchema } from "./creator-image-policy.mjs";

const errorHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function publicCreatorImageProperties(entry: unknown) {
  return creatorImagePublicProperties(manifest, entry);
}

async function publishedImageEntry(id: string) {
  return getDatabase().creatorDirectoryEntry.findFirst({
    where: { id, isDemo: true, isPublished: true },
    select: { id: true, isDemo: true, isPublished: true, payload: true },
  });
}

async function readImageBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_CREATOR_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

/**
 * Deliberately public only for reviewed demo portraits. Authentication is not
 * used here: next/image fetches the original without the viewer's cookies.
 * Never accept a URL/path parameter or reuse the private document handlers.
 */
export async function serveCreatorImage(
  request: Request,
  id: string,
  version: string,
) {
  const notFound = () =>
    new Response(null, { status: 404, headers: errorHeaders });
  if (
    new URL(request.url).search ||
    !findApprovedCreatorImage(manifest, id, version)
  )
    return notFound();

  try {
    const entry = await publishedImageEntry(id);
    const image = approvedCreatorImageForEntry(manifest, entry, version);
    if (!image) return notFound();

    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token)
      return new Response(null, { status: 503, headers: errorHeaders });
    const result = await get(image.pathname, {
      token,
      access: "private",
      abortSignal: AbortSignal.timeout(20_000),
    });
    if (!result || result.statusCode !== 200) return notFound();
    if (
      result.blob.pathname !== image.pathname ||
      result.blob.contentType !== image.contentType ||
      !Number.isInteger(result.blob.size) ||
      result.blob.size < 12 ||
      result.blob.size > MAX_CREATOR_IMAGE_BYTES
    ) {
      await result.stream.cancel();
      return notFound();
    }
    const bytes = await readImageBytes(result.stream);
    if (
      !bytes ||
      !validCreatorImageBytes(bytes, {
        sha256: image.sha256,
        size: result.blob.size,
      })
    )
      return notFound();

    // A row may be unpublished or its approval metadata changed during Blob I/O.
    const current = await publishedImageEntry(id);
    if (!approvedCreatorImageForEntry(manifest, current, version))
      return notFound();

    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${id}.webp"`,
        "Cache-Control": "public, max-age=300, s-maxage=300",
        ETag: `"${image.sha256}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, noarchive",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return notFound();
    // SDK/DB errors may contain credentials or storage URLs. Log no raw values.
    console.error("creator_image_unavailable");
    return new Response(null, { status: 503, headers: errorHeaders });
  }
}
