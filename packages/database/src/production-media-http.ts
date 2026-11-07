import { randomUUID } from "node:crypto";
import { get, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";
import {
  authorizeProductionUpload,
  productionFail,
  productionTransaction,
  readableProductionMedia,
  type ProductionActor,
} from "@futures-medialab/database/production";
import { readProductionBody } from "@futures-medialab/database/production-http";
import { productionIdSchema } from "@futures-medialab/database/production-validation";
import {
  PRODUCTION_VIDEO_MAX_BYTES,
  PRODUCTION_VIDEO_TYPES,
} from "@futures-medialab/database/production-media-shared";
const schema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("prepare"),
    productionItemId: productionIdSchema,
    expectedRevision: z.number().int().min(0),
    filename: z.string().trim().min(1).max(240),
    contentType: z.enum(PRODUCTION_VIDEO_TYPES),
    size: z.number().int().min(12).max(PRODUCTION_VIDEO_MAX_BYTES),
  }),
  z.strictObject({ action: z.literal("complete"), id: z.uuid() }),
]);
const json = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "private, no-store" } });
const etag = (value: string | null) => value?.replace(/^"|"$/g, "");
function storageReady() {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    productionFail(
      503,
      "STORAGE_UNAVAILABLE",
      "동영상 저장소가 아직 연결되지 않았습니다. 운영팀에 문의해 주세요.",
    );
}
export async function productionMediaUpload(
  request: Request,
  actor: ProductionActor,
) {
  storageReady();
  const input = await readProductionBody(request, schema);
  if (input.action === "prepare") {
    const extension = input.contentType === "video/mp4" ? "mp4" : "webm";
    if (!input.filename.toLowerCase().endsWith(`.${extension}`))
      productionFail(
        400,
        "INVALID_MEDIA",
        "MP4 또는 WebM 파일을 선택해 주세요.",
      );
    const id = randomUUID();
    const media = await productionTransaction(actor, async (tx) => {
      await authorizeProductionUpload(
        tx,
        actor,
        input.productionItemId,
        input.expectedRevision,
      );
      const pending = await tx.productionMedia.count({
        where: {
          uploadedById: actor.userId,
          completedAt: null,
          createdAt: { gt: new Date(Date.now() - 3600000) },
        },
      });
      if (pending >= 10)
        productionFail(
          429,
          "UPLOAD_LIMIT",
          "진행 중인 업로드가 많습니다. 잠시 후 다시 시도해 주세요.",
        );
      return tx.productionMedia.create({
        data: {
          id,
          productionItemId: input.productionItemId,
          uploadedById: actor.userId,
          revision: input.expectedRevision,
          pathname: `production/${input.productionItemId}/${id}.${extension}`,
          filename: input.filename,
          contentType: input.contentType,
          size: input.size,
        },
      });
    });
    const token = await generateClientTokenFromReadWriteToken({
      pathname: media.pathname,
      allowedContentTypes: [media.contentType],
      maximumSizeInBytes: media.size,
      validUntil: Date.now() + 30 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return json({ id: media.id, pathname: media.pathname, token });
  }
  const media = await productionTransaction(actor, async (tx) => {
    const row = await tx.productionMedia.findUnique({
      where: { id: input.id },
    });
    if (!row || row.uploadedById !== actor.userId)
      productionFail(404, "NOT_FOUND", "업로드를 찾을 수 없습니다.");
    await authorizeProductionUpload(
      tx,
      actor,
      row.productionItemId,
      row.revision,
    );
    return row;
  });
  if (media.completedAt)
    return json({
      url: `production-media:${media.id}`,
      filename: media.filename,
    });
  const info = await head(media.pathname);
  if (
    info.size !== media.size ||
    info.contentType !== media.contentType ||
    info.pathname !== media.pathname ||
    !new URL(info.url).hostname.endsWith(".private.blob.vercel-storage.com")
  )
    productionFail(
      400,
      "INVALID_MEDIA",
      "업로드된 동영상 정보를 확인할 수 없습니다.",
    );
  const sample = await get(media.pathname, {
    access: "private",
    useCache: false,
    headers: { Range: "bytes=0-31" },
  });
  if (!sample || sample.statusCode !== 200)
    productionFail(400, "INVALID_MEDIA", "업로드를 완료하지 못했습니다.");
  const reader = sample.stream.getReader();
  let bytes = Buffer.alloc(0);
  try {
    while (bytes.length < 12) {
      const part = await reader.read();
      if (part.done) break;
      bytes = Buffer.concat([bytes, Buffer.from(part.value.slice(0, 32))]);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const valid =
    media.contentType === "video/mp4"
      ? bytes.subarray(4, 8).toString() === "ftyp"
      : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!valid)
    productionFail(
      400,
      "INVALID_MEDIA",
      "재생 가능한 MP4 또는 WebM 동영상이 아닙니다.",
    );
  await productionTransaction(actor, async (tx) => {
    await authorizeProductionUpload(
      tx,
      actor,
      media.productionItemId,
      media.revision,
    );
    const result = await tx.productionMedia.updateMany({
      where: { id: media.id, uploadedById: actor.userId, completedAt: null },
      data: { completedAt: new Date(), etag: info.etag },
    });
    if (result.count)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "production.video_uploaded",
          entityType: "ProductionMedia",
          entityId: media.id,
          payload: {
            productionItemId: media.productionItemId,
            size: media.size,
            contentType: media.contentType,
          },
        },
      });
  });
  return json({
    url: `production-media:${media.id}`,
    filename: media.filename,
  });
}
export function productionByteRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | false {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  const first = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const last =
    match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (
    !Number.isSafeInteger(first) ||
    !Number.isSafeInteger(last) ||
    first >= size ||
    first > last ||
    (!match[1] && Number(match[2]) <= 0)
  )
    return false;
  return { start: first, end: last };
}
export async function productionMediaStream(
  request: Request,
  actor: ProductionActor,
  id: string,
) {
  if (!z.uuid().safeParse(id).success)
    productionFail(404, "NOT_FOUND", "동영상을 찾을 수 없습니다.");
  const media = await productionTransaction(actor, (tx) =>
    readableProductionMedia(tx, actor, id),
  );
  storageReady();
  const range = productionByteRange(request.headers.get("range"), media.size);
  if (range === false)
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${media.size}`,
        "Cache-Control": "private, no-store",
      },
    });
  const result = await get(media.pathname, {
    access: "private",
    abortSignal: request.signal,
    headers: range ? { Range: `bytes=${range.start}-${range.end}` } : undefined,
  });
  if (!result || result.statusCode !== 200)
    productionFail(404, "NOT_FOUND", "동영상을 찾을 수 없습니다.");
  try {
    if (
      result.blob.contentType !== media.contentType ||
      etag(result.blob.etag) !== etag(media.etag)
    )
      productionFail(
        409,
        "MEDIA_CHANGED",
        "동영상이 변경되었습니다. 다시 확인해 주세요.",
      );
    await productionTransaction(actor, (tx) =>
      readableProductionMedia(tx, actor, id),
    );
  } catch (error) {
    await result.stream.cancel();
    throw error;
  }
  const contentRange = result.headers.get("content-range");
  const headers: Record<string, string> = {
    "Content-Type": media.contentType,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`,
  };
  if (contentRange) headers["Content-Range"] = contentRange;
  const length = result.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  return new Response(result.stream, {
    status: contentRange ? 206 : 200,
    headers,
  });
}
