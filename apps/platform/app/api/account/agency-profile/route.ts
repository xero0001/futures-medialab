import { randomUUID } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { z } from "zod";
import { getAuth } from "../../../../lib/auth";
import { agencyProfileSchema, getAgencyProfileValues, hasSubmittedAgencyProfile, metadataRecord, validateAgencyProfile } from "../../../../lib/agency-profile";

export const preferredRegion = "sin1";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const schema = z.strictObject({ action: z.enum(["saveDraft", "submit"]), profile: agencyProfileSchema });
const memberQuery = (userId: string) => ({
  where: { userId, organization: { type: "AGENCY" as const } },
  orderBy: [{ createdAt: "asc" as const }, { organizationId: "asc" as const }],
  select: { role: true, organization: { select: { id: true, name: true, status: true, metadata: true } } },
});

async function boundedBody(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function GET(request: Request) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return json({ code: "UNAUTHORIZED" }, 401);
    const member = await getDatabase().organizationMember.findFirst(memberQuery(session.user.id));
    if (!member || member.role !== "OWNER" || member.organization.status === "SUSPENDED") return json({ code: "FORBIDDEN" }, 403);
    const org = member.organization;
    return json({ profile: getAgencyProfileValues(org.name, org.metadata), status: hasSubmittedAgencyProfile(org.metadata) ? "SUBMITTED" : "DRAFT" });
  } catch { return json({ code: "UNAVAILABLE" }, 503); }
}

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    const base = auth.options.baseURL;
    if (typeof base !== "string") throw new Error("Application origin required");
    const site = request.headers.get("sec-fetch-site");
    if (request.headers.get("origin") !== new URL(base).origin || (site !== null && site !== "same-origin")) return json({ code: "INVALID_ORIGIN" }, 403);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ code: "UNAUTHORIZED" }, 401);
    const parsed = schema.safeParse(await boundedBody(request));
    if (!parsed.success) return json({ code: "INVALID_PROFILE", fields: parsed.error.issues.map(issue => String(issue.path[1] ?? "organizationName")) }, 400);
    const { action, profile } = parsed.data;
    const fields = validateAgencyProfile(profile, action);
    if (fields.length) return json({ code: "INVALID_PROFILE", fields }, 400);
    const db = getDatabase();
    const key = `agency-profile:${session.user.id}`, now = BigInt(Date.now()), cutoff = now - 60_000n;
    const limits = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest") VALUES (${randomUUID()}, ${key}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit"."count" + 1, 31) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END RETURNING "count"`;
    if (!limits[0] || limits[0].count > 30) return json({ code: "RATE_LIMITED" }, 429);
    return await db.$transaction(async tx => {
      // Re-read both session and membership inside the mutation boundary.
      const live = await tx.session.findFirst({ where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (!live) return json({ code: "UNAUTHORIZED" }, 401);
      const member = await tx.organizationMember.findFirst(memberQuery(session.user.id));
      if (!member || member.role !== "OWNER" || member.organization.status === "SUSPENDED") return json({ code: "FORBIDDEN" }, 403);
      const org = member.organization;
      if (hasSubmittedAgencyProfile(org.metadata)) return json({ code: "PROFILE_LOCKED" }, 409);
      const ids = [profile.businessDocumentId, profile.contractDocumentId].filter(Boolean);
      const documents = await tx.agencyDocument.findMany({ where: { organizationId: org.id, id: { in: ids }, state: "UPLOADED" }, select: { id: true, kind: true } });
      const documentFields = [
        ...(profile.businessDocumentId && !documents.some(d => d.id === profile.businessDocumentId && d.kind === "BUSINESS_REGISTRATION") ? ["businessDocumentId"] : []),
        ...(profile.contractDocumentId && !documents.some(d => d.id === profile.contractDocumentId && d.kind === "CONTRACT") ? ["contractDocumentId"] : []),
      ];
      if (documentFields.length) return json({ code: "INVALID_DOCUMENT", fields: documentFields }, 400);
      const metadata = metadataRecord(org.metadata);
      const next = {
        ...metadata, agencyType: profile.agencyType, agencyProfileDraft: profile,
        ...(action === "submit" ? { agencyProfile: profile, agencyProfileSubmittedAt: new Date().toISOString() } : {}),
      } as Prisma.InputJsonObject;
      await tx.organization.update({ where: { id: org.id }, data: {
        ...(action === "submit" ? { name: profile.organizationName, countryCode: profile.countryCode } : {}),
        metadata: next,
        // Submission is not approval and never marks the email as verified.
      } });
      return json({ success: true, status: action === "submit" ? "SUBMITTED" : "DRAFT" });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return json({ code: "PROFILE_CONFLICT" }, 409);
    console.error("agency_profile_save_failed");
    return json({ code: "PROFILE_SAVE_FAILED" }, 503);
  }
}
