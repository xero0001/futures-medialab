import { randomUUID } from "node:crypto";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { z } from "zod";
import { Prisma } from "./client";
import {
  RequestError,
  type RequestActor,
  requestFail,
  requestId,
  requestTransaction,
  ownedRequest,
  listRequestsSchema,
  listRequests,
  requestDetail,
  createRequestSchema,
  createRequest,
  requestMutationSchema,
  mutateRequest,
} from "./requests";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const FILE_LIMIT = 4 * 1024 * 1024;
export type RequestHttpAuth = {
  authenticate(request: Request): Promise<RequestActor>;
  verifyOrigin(request: Request): void;
  rateLimit(actor: RequestActor, bucket: string, limit: number): Promise<void>;
};
async function bytes(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) requestFail(400, "INVALID_INPUT", "요청 내용이 없습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        requestFail(413, "TOO_LARGE", "요청 크기가 허용량을 초과했습니다.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    requestFail(
      400,
      "INVALID_INPUT",
      "입력값을 확인하세요. 제목 2~160자, 본문 1~5,000자, 처리 사유 2~1,000자입니다.",
    );
  return result.data;
}
async function body<T>(request: Request, schema: z.ZodType<T>) {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    requestFail(400, "INVALID_INPUT", "JSON 요청이 필요합니다.");
  const raw = await bytes(request, 24_576);
  let value: unknown;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    requestFail(400, "INVALID_INPUT", "잘못된 요청 형식입니다.");
  }
  return parse(schema, value);
}
const attachmentDto = (a: {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
}) => ({
  id: a.id,
  fileName: a.fileName,
  contentType: a.contentType,
  size: a.size,
});
async function upload(actor: RequestActor, request: Request, id: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    requestFail(503, "STORAGE_UNAVAILABLE", "파일 저장소 연결이 필요합니다.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;"))
    requestFail(400, "INVALID_INPUT", "파일을 선택하세요.");
  await requestTransaction(actor, async (tx) => {
    const row = await ownedRequest(tx, actor, id);
    if (
      row.status === "CLOSED" ||
      (actor.kind === "brand" && row.status === "RESOLVED")
    )
      requestFail(409, "REQUEST_CLOSED", "현재 상태에서는 첨부할 수 없습니다.");
    const count = await tx.requestAttachment.count({
      where: {
        requestId: id,
        uploaderId: actor.userId,
        messageId: null,
        discardedAt: null,
      },
    });
    if (count >= 20)
      requestFail(
        409,
        "UPLOAD_LIMIT",
        "등록 대기 중인 첨부가 많습니다. 기존 첨부를 답변에 등록하거나 취소하세요.",
      );
  });
  const raw = await bytes(request, FILE_LIMIT + 16_384);
  let form: FormData;
  try {
    form = await new Response(raw, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    requestFail(400, "INVALID_FILE", "파일을 읽을 수 없습니다.");
  }
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    form.getAll("file").length !== 1 ||
    file.size < 1 ||
    file.size > FILE_LIMIT
  )
    requestFail(400, "INVALID_FILE", "4MB 이하 파일 한 개를 선택하세요.");
  const data = Buffer.from(await file.arrayBuffer());
  const formats = [
    {
      mime: "application/pdf",
      ext: "pdf",
      valid: data.subarray(0, 5).toString() === "%PDF-",
      pattern: /\.pdf$/i,
    },
    {
      mime: "image/png",
      ext: "png",
      valid: data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      pattern: /\.png$/i,
    },
    {
      mime: "image/jpeg",
      ext: "jpg",
      valid: data[0] === 255 && data[1] === 216 && data[2] === 255,
      pattern: /\.jpe?g$/i,
    },
  ];
  const format = formats.find(
    (f) => f.mime === file.type && f.valid && f.pattern.test(file.name),
  );
  if (
    !format ||
    file.name.length > 180 ||
    /[/\\]/.test(file.name) ||
    Array.from(file.name).some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127 || (code >= 0xd800 && code <= 0xdfff);
    })
  )
    requestFail(
      400,
      "INVALID_FILE",
      "유효한 PDF, PNG 또는 JPEG 파일만 첨부할 수 있습니다.",
    );
  const uploaded = await put(
    `request-attachments/${id}/${randomUUID()}.${format.ext}`,
    data,
    {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: format.mime,
      abortSignal: AbortSignal.timeout(30_000),
    },
  );
  try {
    const attachment = await requestTransaction(actor, async (tx) => {
      const row = await ownedRequest(tx, actor, id);
      if (
        row.status === "CLOSED" ||
        (actor.kind === "brand" && row.status === "RESOLVED")
      )
        requestFail(409, "REQUEST_CLOSED", "요청 상태가 변경되었습니다.");
      // This check must share the serializable insert transaction, not only precede Blob I/O.
      const count = await tx.requestAttachment.count({
        where: {
          requestId: id,
          uploaderId: actor.userId,
          messageId: null,
          discardedAt: null,
        },
      });
      if (count >= 20)
        requestFail(
          409,
          "UPLOAD_LIMIT",
          "등록 대기 중인 첨부가 많습니다. 기존 첨부를 답변에 등록하거나 취소하세요.",
        );
      return tx.requestAttachment.create({
        data: {
          requestId: id,
          uploaderId: actor.userId,
          fileName: file.name,
          contentType: format.mime,
          size: file.size,
          pathname: uploaded.pathname,
        },
      });
    });
    return json({ attachment: attachmentDto(attachment) }, 201);
  } catch (error) {
    // Only this call's newly uploaded object is eligible for cleanup.
    await del(uploaded.pathname).catch(() =>
      console.error("request_attachment_cleanup_failed"),
    );
    throw error;
  }
}
async function download(actor: RequestActor, id: string, attachmentId: string) {
  const attachment = await requestTransaction(actor, async (tx) => {
    await ownedRequest(tx, actor, id);
    const found = await tx.requestAttachment.findFirst({
      where: { id: attachmentId, requestId: id, discardedAt: null },
      include: { message: { select: { internal: true, requestId: true } } },
    });
    if (
      !found ||
      (!found.messageId && found.uploaderId !== actor.userId) ||
      (actor.kind === "brand" && found.message?.internal) ||
      (found.message && found.message.requestId !== id)
    )
      requestFail(404, "NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
    return found;
  });
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    requestFail(503, "STORAGE_UNAVAILABLE", "파일 저장소 연결이 필요합니다.");
  if (!attachment.pathname.startsWith(`request-attachments/${id}/`))
    requestFail(404, "NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
  const result = await get(attachment.pathname, {
    access: "private",
    useCache: false,
    abortSignal: AbortSignal.timeout(30_000),
  });
  if (!result || result.statusCode !== 200)
    requestFail(404, "NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
  if (
    result.blob.size !== attachment.size ||
    result.blob.contentType !== attachment.contentType
  ) {
    await result.stream.cancel();
    requestFail(
      409,
      "FILE_CHANGED",
      "파일이 변경되었습니다. 관리자에게 문의하세요.",
    );
  }
  try {
    await requestTransaction(actor, async (tx) => {
      await ownedRequest(tx, actor, id);
      const live = await tx.requestAttachment.findFirst({
        where: { id: attachmentId, requestId: id, discardedAt: null },
        include: { message: { select: { internal: true, requestId: true } } },
      });
      if (
        !live ||
        (!live.messageId && live.uploaderId !== actor.userId) ||
        (actor.kind === "brand" && live.message?.internal) ||
        (live.message && live.message.requestId !== id)
      )
        requestFail(404, "NOT_FOUND", "첨부파일을 찾을 수 없습니다.");
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "request.downloadAttachment",
          entityType: "RequestAttachment",
          entityId: attachment.id,
          payload: { requestId: id },
        },
      });
    });
  } catch (error) {
    await result.stream.cancel();
    throw error;
  }
  return new Response(result.stream, {
    headers: {
      ...headers,
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.size),
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
    },
  });
}
async function discard(actor: RequestActor, id: string, attachmentId: string) {
  const attachment = await requestTransaction(actor, async (tx) => {
    await ownedRequest(tx, actor, id);
    const found = await tx.requestAttachment.findFirst({
      where: {
        id: attachmentId,
        requestId: id,
        uploaderId: actor.userId,
        messageId: null,
      },
    });
    if (!found || !found.pathname.startsWith(`request-attachments/${id}/`))
      requestFail(404, "NOT_FOUND", "취소할 첨부파일을 찾을 수 없습니다.");
    if (!found.discardedAt) {
      const changed = await tx.requestAttachment.updateMany({
        where: {
          id: attachmentId,
          requestId: id,
          uploaderId: actor.userId,
          messageId: null,
          discardedAt: null,
        },
        data: { discardedAt: new Date() },
      });
      if (!changed.count)
        requestFail(
          409,
          "CONFLICT",
          "첨부파일이 변경되었습니다. 새로고침 후 다시 시도하세요.",
        );
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "request.discardAttachment",
          entityType: "RequestAttachment",
          entityId: attachmentId,
          payload: { requestId: id },
        },
      });
    }
    return found;
  });
  // Commit the tombstone before deleting storage: a concurrent reply can never claim this object.
  // Retain the row/path so a repeated DELETE can retry storage cleanup without reviving attachment access.
  let cleanupPending = true;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(attachment.pathname, {
        abortSignal: AbortSignal.timeout(15_000),
      });
      cleanupPending = false;
    } catch (error) {
      if (error instanceof BlobNotFoundError) cleanupPending = false;
      else console.error("request_attachment_discard_cleanup_failed");
    }
  }
  return json({ success: true, cleanupPending });
}
// App-specific authentication and CSRF checks are injected, never inferred from URL parameters.
export async function requestHttp(
  request: Request,
  auth: RequestHttpAuth,
  rawId?: string,
  rawAttachmentId?: string,
  isUpload = false,
) {
  try {
    if (!["GET", "POST", "DELETE"].includes(request.method))
      return json({ message: "허용되지 않은 메서드입니다." }, 405);
    if (request.method !== "GET") auth.verifyOrigin(request);
    const actor = await auth.authenticate(request);
    await auth.rateLimit(
      actor,
      request.method === "GET"
        ? "requests-read"
        : isUpload
          ? "requests-upload"
          : "requests-write",
      request.method === "GET" ? 120 : isUpload ? 10 : 30,
    );
    const id = rawId === undefined ? undefined : parse(requestId, rawId);
    const attachmentId =
      rawAttachmentId === undefined
        ? undefined
        : parse(requestId, rawAttachmentId);
    if (request.method === "DELETE")
      return attachmentId && id
        ? await discard(actor, id, attachmentId)
        : json({ message: "허용되지 않은 메서드입니다." }, 405);
    if (attachmentId && id && request.method === "GET")
      return await download(actor, id, attachmentId);
    if (isUpload && id && request.method === "POST")
      return await upload(actor, request, id);
    if (request.method === "GET") {
      if (id)
        return json(
          await requestDetail(
            actor,
            id,
            Boolean(process.env.BLOB_READ_WRITE_TOKEN),
          ),
        );
      return json(
        await listRequests(
          actor,
          parse(
            listRequestsSchema,
            Object.fromEntries(new URL(request.url).searchParams),
          ),
        ),
      );
    }
    if (id)
      return json(
        await mutateRequest(
          actor,
          id,
          await body(request, requestMutationSchema),
        ),
      );
    return json(
      await createRequest(actor, await body(request, createRequestSchema)),
      201,
    );
  } catch (error) {
    if (error instanceof RequestError)
      return json({ code: error.code, message: error.message }, error.status);
    if (error instanceof BlobNotFoundError)
      return json(
        { code: "NOT_FOUND", message: "첨부파일을 찾을 수 없습니다." },
        404,
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2002"].includes(error.code)
    )
      return json(
        {
          code: "CONFLICT",
          message: "데이터가 변경되었습니다. 새로고침 후 다시 시도하세요.",
        },
        409,
      );
    // App auth errors retain their safe structured code/message in the app boundary.
    if (error instanceof Error && "status" in error && "code" in error)
      throw error;
    console.error("request_workspace_failed");
    return json(
      {
        code: "UNAVAILABLE",
        message: "요청함을 일시적으로 사용할 수 없습니다.",
      },
      503,
    );
  }
}
