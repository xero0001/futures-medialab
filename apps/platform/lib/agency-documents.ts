import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { BlobNotFoundError, get, head } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { z } from "zod";
import { getAuth } from "./auth";

type Transaction = Prisma.TransactionClient;
type Database = Transaction | ReturnType<typeof getDatabase>;
type Document = Prisma.AgencyDocumentGetPayload<Record<string, never>>;
export const agencyDocumentHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const idSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const mimeSchema = z.enum(["application/pdf", "image/png", "image/jpeg"]);
function validFileName(name: string) {
  return !/[\\/]/.test(name) && Array.from(name).every(character => {
    const codePoint = character.codePointAt(0)!;
    return codePoint >= 32 && codePoint !== 127 && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
  });
}
const allocationSchema = z.strictObject({
  kind: z.enum(["BUSINESS_REGISTRATION", "CONTRACT"]),
  fileName: z.string().trim().min(1).max(180).refine(validFileName),
  contentType: mimeSchema,
  size: z.number().int().positive().max(MAX_FILE_SIZE),
}).refine(({ fileName, contentType }) => {
  const extensions = { "application/pdf": /\.pdf$/i, "image/png": /\.png$/i, "image/jpeg": /\.jpe?g$/i };
  return extensions[contentType].test(fileName);
});
const clientPayloadSchema = z.strictObject({ documentId: idSchema });
const uploadSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("blob.generate-client-token"),
    payload: z.strictObject({
      pathname: z.string().min(1).max(500),
      multipart: z.boolean(),
      clientPayload: z.string().max(1000).nullable(),
    }),
  }),
  z.strictObject({
    type: z.literal("blob.upload-completed"),
    payload: z.strictObject({
      blob: z.strictObject({
        url: z.string().max(2048),
        downloadUrl: z.string().max(2048),
        pathname: z.string().max(500),
        contentType: z.string().max(120),
        contentDisposition: z.string().max(500),
        etag: z.string().max(200),
      }),
      tokenPayload: z.string().max(2000).nullable().optional(),
    }),
  }),
]);

export class AgencyDocumentError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
function fail(status: number, code: string, message: string): never {
  throw new AgencyDocumentError(status, code, message);
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: agencyDocumentHeaders });
export async function agencyDocumentBoundary(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    if (error instanceof AgencyDocumentError) {
      return Response.json({ code: error.code, message: error.message }, {
        status: error.status,
        headers: { ...agencyDocumentHeaders, ...(error.status === 429 ? { "Retry-After": "60" } : {}) },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
      return json({ code: "CONFLICT", message: "The data changed. Please try again." }, 409);
    }
    // SDK errors may contain private paths or credentials. Never log raw errors.
    console.error("agency_document_request_failed");
    return json({ code: "UNAVAILABLE", message: "Document storage is temporarily unavailable." }, 503);
  }
}

export function uploadConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
function blobOptions() {
  if (!uploadConfigured()) fail(503, "UPLOAD_UNAVAILABLE", "Document storage is not configured yet.");
  // Explicit credentials ensure client token generation and server reads use the same private store.
  return { token: process.env.BLOB_READ_WRITE_TOKEN!.trim() };
}
function applicationOrigin() {
  const base = getAuth().options.baseURL;
  if (typeof base !== "string") throw new Error("Application origin required");
  return new URL(base).origin;
}
function requireOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== applicationOrigin() || (site !== null && site !== "same-origin")) {
    fail(403, "INVALID_ORIGIN", "This request is not allowed.");
  }
}
async function readBody<T>(request: Request, schema: z.ZodType<T>, preserveKeyOrder = false): Promise<T> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
    fail(400, "INVALID_INPUT", "Send a valid JSON request.");
  }
  const reader = request.body?.getReader();
  if (!reader) fail(400, "INVALID_INPUT", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); fail(413, "INPUT_TOO_LARGE", "The request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail(400, "INVALID_INPUT", "Send a valid JSON request."); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) fail(400, "INVALID_INPUT", "Check the submitted fields and try again.");
  // Blob signs JSON.stringify(body), including property order. Its schemas have
  // no transforms; validate strictly but keep the original order for signature verification.
  return preserveKeyOrder ? body as T : parsed.data;
}

async function ownerMembership(database: Database, userId: string) {
  const member = await database.organizationMember.findFirst({
    where: { userId, organization: { type: "AGENCY" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: { role: true, organizationId: true, organization: { select: { status: true } } },
  });
  if (!member || member.role !== "OWNER" || member.organization.status === "SUSPENDED") {
    fail(403, "FORBIDDEN", "Only an agency owner can access these documents.");
  }
  return { organizationId: member.organizationId, status: member.organization.status };
}
export async function getAgencyDocumentOwner(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
  return { ...await ownerMembership(getDatabase(), session.user.id), userId: session.user.id, sessionId: session.session.id };
}
type Owner = Awaited<ReturnType<typeof getAgencyDocumentOwner>>;
async function recheckOwner(database: Database, owner: Owner) {
  const live = await database.session.findFirst({
    where: { id: owner.sessionId, userId: owner.userId, expiresAt: { gt: new Date() } }, select: { id: true },
  });
  if (!live) fail(401, "UNAUTHORIZED", "Log in to continue.");
  const current = await ownerMembership(database, owner.userId);
  if (current.organizationId !== owner.organizationId) fail(403, "FORBIDDEN", "This document is not available.");
}
async function rateLimit(owner: Owner, bucket: string, limit: number) {
  const key = `agency-document:${bucket}:${owner.userId}`, now = BigInt(Date.now()), cutoff = now - 60_000n;
  const rows = await getDatabase().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest") VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit"."count" + 1, ${limit + 1}) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"`;
  if (!rows[0] || rows[0].count > limit) fail(429, "RATE_LIMITED", "Too many requests. Please wait a minute.");
}
function documentDto(document: Document) {
  return {
    id: document.id, fileName: document.fileName, size: document.size,
    contentType: document.contentType, kind: document.kind, status: document.state,
    createdAt: document.createdAt.toISOString(),
  };
}
async function ownDocument(owner: Owner, id: string, database: Database = getDatabase()) {
  if (!idSchema.safeParse(id).success) fail(404, "NOT_FOUND", "Document not found.");
  const document = await database.agencyDocument.findFirst({ where: { id, organizationId: owner.organizationId } });
  if (!document) fail(404, "NOT_FOUND", "Document not found.");
  return document;
}

export function listAgencyDocuments(request: Request) {
  return agencyDocumentBoundary(async () => {
    const owner = await getAgencyDocumentOwner(request);
    await rateLimit(owner, "read", 120);
    const documents = await getDatabase().agencyDocument.findMany({
      where: { organizationId: owner.organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    });
    return json({ documents: documents.map(documentDto) });
  });
}
export function allocateAgencyDocument(request: Request) {
  return agencyDocumentBoundary(async () => {
    requireOrigin(request);
    const owner = await getAgencyDocumentOwner(request);
    blobOptions();
    const input = await readBody(request, allocationSchema);
    await rateLimit(owner, "allocate", 20);
    const document = await getDatabase().$transaction(async tx => {
      await recheckOwner(tx, owner);
      // Count every allocation, not just pending files, so completing/rejecting cannot bypass the daily cap.
      const allocated = await tx.agencyDocument.count({ where: { organizationId: owner.organizationId, createdAt: { gte: new Date(Date.now() - DAY) } } });
      if (allocated >= 20) fail(429, "DAILY_UPLOAD_LIMIT", "The daily document upload limit has been reached.");
      const extension = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[input.contentType];
      return tx.agencyDocument.create({ data: {
        ...input, userId: owner.userId, organizationId: owner.organizationId,
        pathname: `agency-documents/${owner.organizationId}/${randomUUID()}.${extension}`,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    return json({ id: document.id, pathname: document.pathname }, 201);
  });
}

export function authorizeAgencyUpload(request: Request) {
  return agencyDocumentBoundary(async () => {
    const options = blobOptions();
    const body = await readBody(request, uploadSchema, true);
    // A completion callback has no browser session. The SDK authenticates its signature;
    // it deliberately cannot finalize a document. Only the authenticated /complete route can.
    if (body.type === "blob.upload-completed") {
      try {
        const response = await handleUpload({ ...options, request, body,
          onBeforeGenerateToken: async () => { fail(403, "FORBIDDEN", "This request is not allowed."); },
          onUploadCompleted: async () => {},
        });
        return json(response);
      } catch { fail(403, "INVALID_CALLBACK", "This request is not allowed."); }
    }
    const response = await handleUpload({ ...options, request, body,
      onUploadCompleted: async () => {},
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        requireOrigin(request);
        const owner = await getAgencyDocumentOwner(request);
        await rateLimit(owner, "token", 20);
        let payload: unknown;
        try { payload = JSON.parse(clientPayload ?? "null"); }
        catch { fail(400, "INVALID_INPUT", "The upload request is invalid."); }
        const parsed = clientPayloadSchema.safeParse(payload);
        if (!parsed.success) fail(400, "INVALID_INPUT", "The upload request is invalid.");
        const document = await ownDocument(owner, parsed.data.documentId);
        if (document.pathname !== pathname) fail(403, "FORBIDDEN", "This upload path is not allowed.");
        if (document.state !== "PENDING" || document.createdAt.getTime() < Date.now() - DAY) {
          fail(409, "UPLOAD_EXPIRED", "Start a new upload for this document.");
        }
        return {
          allowedContentTypes: [document.contentType], maximumSizeInBytes: document.size,
          validUntil: Date.now() + 10 * 60_000, addRandomSuffix: false, allowOverwrite: false,
          cacheControlMaxAge: 60,
          callbackUrl: `${applicationOrigin()}/api/account/agency-documents/upload`,
          tokenPayload: JSON.stringify({ documentId: document.id }),
        };
      },
    });
    return json(response);
  });
}

function matchesMetadata(document: Document, blob: { pathname: string; size: number; contentType: string }) {
  return blob.pathname === document.pathname && blob.size === document.size &&
    blob.size <= MAX_FILE_SIZE && blob.contentType.split(";", 1)[0]?.trim().toLowerCase() === document.contentType;
}
async function hasExpectedSignature(document: Document, expectedEtag: string) {
  const result = await get(document.pathname, { ...blobOptions(), access: "private", useCache: false, abortSignal: AbortSignal.timeout(20_000) });
  if (!result || result.statusCode !== 200) fail(409, "UPLOAD_NOT_READY", "The upload has not completed yet.");
  if (!matchesMetadata(document, result.blob) || result.blob.etag !== expectedEtag) {
    await result.stream.cancel();
    return false;
  }
  const reader = result.stream.getReader();
  const signature = new Uint8Array(8);
  let length = 0;
  try {
    while (length < signature.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = value.subarray(0, signature.length - length);
      signature.set(bytes, length);
      length += bytes.length;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const expected = document.contentType === "application/pdf" ? [0x25, 0x50, 0x44, 0x46, 0x2d]
    : document.contentType === "image/png" ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] : [0xff, 0xd8, 0xff];
  return length >= expected.length && expected.every((byte, index) => signature[index] === byte);
}
export function completeAgencyDocument(request: Request, id: string) {
  return agencyDocumentBoundary(async () => {
    requireOrigin(request);
    const owner = await getAgencyDocumentOwner(request);
    await readBody(request, z.strictObject({}));
    await rateLimit(owner, "complete", 30);
    const document = await ownDocument(owner, id);
    if (document.state === "UPLOADED") return json(documentDto(document));
    if (document.state === "REJECTED") fail(409, "FILE_REJECTED", "Upload a new valid PDF, PNG or JPEG file.");
    let metadata;
    try { metadata = await head(document.pathname, { ...blobOptions(), abortSignal: AbortSignal.timeout(20_000) }); }
    catch (error) {
      if (error instanceof BlobNotFoundError) fail(409, "UPLOAD_NOT_READY", "The upload has not completed yet.");
      throw error;
    }
    // Signature checking is not malware scanning. Files remain private and are downloaded as attachments.
    const valid = matchesMetadata(document, metadata) && await hasExpectedSignature(document, metadata.etag);
    const updated = await getDatabase().$transaction(async tx => {
      await recheckOwner(tx, owner);
      await tx.agencyDocument.updateMany({ where: { id, organizationId: owner.organizationId, state: "PENDING" }, data: { state: valid ? "UPLOADED" : "REJECTED" } });
      return ownDocument(owner, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    if (updated.state !== "UPLOADED") fail(400, "FILE_REJECTED", "The file contents, type or size do not match. Upload a new file.");
    return json(documentDto(updated));
  });
}

export function downloadAgencyDocument(request: Request, id: string) {
  return agencyDocumentBoundary(async () => {
    const owner = await getAgencyDocumentOwner(request);
    await rateLimit(owner, "download", 60);
    const document = await ownDocument(owner, id);
    if (document.state !== "UPLOADED") fail(404, "NOT_FOUND", "Document not found.");
    const result = await get(document.pathname, { ...blobOptions(), access: "private", useCache: false, abortSignal: AbortSignal.timeout(60_000) });
    if (!result || result.statusCode !== 200) fail(404, "NOT_FOUND", "Document not found.");
    if (!matchesMetadata(document, result.blob)) { await result.stream.cancel(); fail(409, "FILE_CHANGED", "The document must be checked again."); }
    // Recheck after storage I/O so suspended/revoked accounts cannot retain access during a slow read.
    try { await recheckOwner(getDatabase(), owner); }
    catch (error) { await result.stream.cancel(); throw error; }
    const extension = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[document.contentType as z.infer<typeof mimeSchema>] ?? "bin";
    return new Response(result.stream, { headers: {
      ...agencyDocumentHeaders,
      "Content-Type": document.contentType,
      "Content-Length": String(document.size),
      "Content-Disposition": `attachment; filename="document.${extension}"; filename*=UTF-8''${encodeURIComponent(document.fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  });
}
