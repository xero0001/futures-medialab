import "server-only";
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { z } from "zod";
import { getAuth } from "./auth";
import { hasCompletedBrandProfile } from "./brand-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import {
  campaignMutationSchema,
  canSubmitCampaign,
} from "./campaign-validation";
import type { WorkspaceAccount, WorkspaceBootstrap } from "./workspace-types";

type Transaction = Prisma.TransactionClient;
type Database = Transaction | ReturnType<typeof getDatabase>;
export const workspaceHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const idSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const shortString = z.string().trim().max(120);
export class WorkspaceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new WorkspaceError(status, code, message);
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: workspaceHeaders });
}
export async function workspaceBoundary(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return Response.json(
        { code: error.code, message: error.message },
        {
          status: error.status,
          headers: {
            ...workspaceHeaders,
            ...(error.status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034")
        return json(
          { code: "CONFLICT", message: "The data changed. Please try again." },
          409,
        );
      if (error.code === "P2002")
        return json(
          { code: "DUPLICATE", message: "This record already exists." },
          409,
        );
    }
    console.error("workspace_request_failed");
    return json(
      {
        code: "UNAVAILABLE",
        message: "The workspace is temporarily unavailable. Please try again.",
      },
      503,
    );
  }
}

function applicationOrigin() {
  const base = getAuth().options.baseURL;
  if (typeof base !== "string")
    throw new Error("An explicit application origin is required.");
  return new URL(base).origin;
}
export function verifyOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (
    request.headers.get("origin") !== applicationOrigin() ||
    (site !== null && site !== "same-origin")
  ) {
    fail(403, "INVALID_ORIGIN", "This request is not allowed.");
  }
}

export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  ) {
    fail(400, "INVALID_INPUT", "Send a valid JSON request.");
  }
  const reader = request.body?.getReader();
  if (!reader) fail(400, "INVALID_INPUT", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        fail(413, "INPUT_TOO_LARGE", "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail(400, "INVALID_INPUT", "Send a valid JSON request.");
  }
  const result = schema.safeParse(body);
  if (!result.success)
    fail(400, "INVALID_INPUT", "Check the submitted fields and try again.");
  return result.data;
}

async function sessionUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
  return session.user.id;
}

export async function membership(database: Database, userId: string) {
  const member = await database.organizationMember.findFirst({
    where: { userId, organization: { type: "BRAND" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: {
      role: true,
      organizationId: true,
      user: { select: { email: true } },
      organization: {
        select: {
          name: true,
          status: true,
          countryCode: true,
          websiteUrl: true,
          metadata: true,
        },
      },
    },
  });
  if (!member || member.organization.status === "SUSPENDED")
    fail(403, "FORBIDDEN", "This workspace is not available for your account.");
  if (
    !hasCompletedBrandProfile(member.organization.metadata) &&
    !hasApprovedTestWorkspaceAccess(member.organization)
  )
    fail(403, "PROFILE_REQUIRED", "Complete your company profile first.");
  if (member.organization.status !== "ACTIVE")
    fail(
      403,
      "APPROVAL_REQUIRED",
      "Organization approval is required to access this workspace.",
    );
  return member;
}
type Member = Awaited<ReturnType<typeof membership>>;
export function requireManager(member: Member, ownerOnly = false) {
  if (ownerOnly ? member.role !== "OWNER" : member.role === "MEMBER") {
    fail(
      403,
      "FORBIDDEN",
      ownerOnly
        ? "Only the owner can update this account."
        : "An owner or administrator is required.",
    );
  }
}
function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function textField(value: unknown) {
  return typeof value === "string" ? value : "";
}
function accountDto(member: Member): WorkspaceAccount {
  const org = member.organization,
    metadata = metadataRecord(org.metadata);
  return {
    name: org.name,
    email: member.user.email,
    countryCode: org.countryCode,
    websiteUrl: org.websiteUrl,
    contactName: textField(metadata.contactName),
    industry: textField(metadata.industry),
    companySize: textField(metadata.companySize),
    role: member.role,
    status: org.status === "ACTIVE" ? "ACTIVE" : "PENDING",
  };
}

// A single atomic, database-backed counter works across serverless instances.
export async function rateLimit(userId: string, bucket: string, limit: number) {
  const key = `workspace:${bucket}:${userId}`,
    now = BigInt(Date.now()),
    cutoff = now - 60_000n;
  const rows = await getDatabase().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${`ws_${randomBytes(12).toString("hex")}`}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit"."count" + 1, ${limit + 1}) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"
  `;
  if (!rows[0] || rows[0].count > limit)
    fail(429, "RATE_LIMITED", "Too many requests. Please wait a minute.");
}

// Creator discovery is retired from the partner platform. These endpoints must
// never touch the directory, even for approved brands or demo/test accounts.
export function creatorDirectoryUnavailable() {
  return json(
    { code: "NOT_FOUND", message: "This resource is unavailable." },
    404,
  );
}
export const previewCreatorDirectory = creatorDirectoryUnavailable;
export const searchWorkspace = creatorDirectoryUnavailable;
export const collectionWorkspace = creatorDirectoryUnavailable;

export async function bootstrapWorkspace(request: Request) {
  return workspaceBoundary(async () => {
    const userId = await sessionUser(request);
    await rateLimit(userId, "read", 120);
    const result = await getDatabase().$transaction(
      async (tx): Promise<WorkspaceBootstrap> => {
        const member = await membership(tx, userId),
          organizationId = member.organizationId;
        const [links, campaigns, requests] = await Promise.all([
          tx.shortLink.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              code: true,
              title: true,
              targetUrl: true,
              active: true,
              clickCount: true,
              createdAt: true,
            },
          }),
          tx.campaign.findMany({
            where: { brandOrganizationId: organizationId },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              title: true,
              summary: true,
              platforms: true,
              currency: true,
              budgetAmount: true,
              status: true,
              createdAt: true,
              applicationDeadline: true,
              regions: true,
              categories: true,
              followerMin: true,
              followerMax: true,
              requirements: true,
              _count: { select: { applications: true } },
            },
          }),
          tx.workspaceToolRequest.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              tool: true,
              title: true,
              inputJson: true,
              status: true,
              createdAt: true,
            },
          }),
        ]);
        return {
          // Preserve the response shape without querying or exposing directory data.
          creators: [],
          brands: [],
          collections: [],
          links: links.map((link) => ({
            ...link,
            createdAt: link.createdAt.toISOString(),
          })),
          campaigns: campaigns.map(({ requirements, _count, ...campaign }) => ({
            ...campaign,
            budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
            createdAt: campaign.createdAt.toISOString(),
            applicationDeadline:
              campaign.applicationDeadline?.toISOString() ?? null,
            reviewNote:
              textField(
                metadataRecord(metadataRecord(requirements).adminReview).reason,
              ) || null,
            applicationCount: _count.applications,
          })),
          requests: requests.map(({ inputJson, ...entry }) => ({
            ...entry,
            input: textField(metadataRecord(inputJson).input),
            createdAt: entry.createdAt.toISOString(),
          })),
          recentSearches: [],
          account: accountDto(member),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
    return json(result);
  });
}

async function mutate<T>(
  request: Request,
  schema: z.ZodType<T>,
  action: (
    tx: Transaction,
    member: Member,
    userId: string,
    input: T,
  ) => Promise<unknown>,
) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
    const userId = session.user.id;
    await membership(getDatabase(), userId);
    await rateLimit(userId, "write", 60);
    const input = await readBody(request, schema);
    const result = await getDatabase().$transaction(
      async (tx) => {
        const liveSession = await tx.session.findFirst({
          where: {
            id: session.session.id,
            userId,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!liveSession) fail(401, "UNAUTHORIZED", "Log in to continue.");
        const member = await membership(tx, userId);
        return action(tx, member, userId, input);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    return json(result ?? { success: true });
  });
}

export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value),
      hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const ownHosts = [
      new URL(applicationOrigin()).hostname.toLowerCase(),
      "futures-medialab.vercel.app",
      process.env.VERCEL_URL?.toLowerCase(),
      process.env.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase(),
    ];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      ownHosts.includes(hostname) ||
      !hostname.includes(".") ||
      isIP(hostname) ||
      hostname.includes(":") ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(
        hostname,
      )
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
const linksSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    title: shortString.min(1),
    targetUrl: z.string().trim().min(1).max(2048),
  }),
  z.strictObject({
    action: z.literal("toggle"),
    id: idSchema,
    active: z.boolean(),
  }),
]);
export async function linksWorkspace(request: Request) {
  return mutate(request, linksSchema, async (tx, member, userId, input) => {
    requireManager(member);
    const organizationId = member.organizationId;
    if (input.action === "toggle") {
      const result = await tx.shortLink.updateMany({
        where: { id: input.id, organizationId },
        data: { active: input.active },
      });
      if (!result.count) fail(404, "NOT_FOUND", "The link was not found.");
      return;
    }
    const targetUrl = safeExternalUrl(input.targetUrl);
    if (!targetUrl)
      fail(
        400,
        "INVALID_URL",
        "Use a public external HTTPS URL without login details.",
      );
    if ((await tx.shortLink.count({ where: { organizationId } })) >= 100)
      fail(
        409,
        "LIMIT_REACHED",
        "This workspace can contain up to 100 short links.",
      );
    await tx.shortLink.create({
      data: {
        organizationId,
        userId,
        title: input.title,
        targetUrl,
        code: randomBytes(9).toString("base64url"),
      },
    });
  });
}

export async function campaignsWorkspace(request: Request) {
  return mutate(
    request,
    campaignMutationSchema,
    async (tx, member, userId, input) => {
      requireManager(member);
      const organizationId = member.organizationId;
      if (input.action === "create" || input.action === "update") {
        const values = {
          title: input.title,
          summary: input.summary,
          platforms: input.platforms,
          regions: input.regions,
          categories: input.categories,
          followerMin: input.followerMin ?? null,
          followerMax: input.followerMax ?? null,
          currency: input.currency,
          budgetAmount: input.budgetAmount,
          applicationDeadline: input.deadline ? new Date(input.deadline) : null,
        };
        if (input.action === "update") {
          const result = await tx.campaign.updateMany({
            where: {
              id: input.id,
              brandOrganizationId: organizationId,
              status: "DRAFT",
            },
            data: values,
          });
          if (!result.count)
            fail(409, "INVALID_STATE", "Only your own drafts can be edited.");
          await tx.auditLog.create({
            data: {
              actorId: userId,
              action: "campaign.updated",
              entityType: "Campaign",
              entityId: input.id,
            },
          });
          return { success: true, id: input.id };
        }
        if (
          (await tx.campaign.count({
            where: { brandOrganizationId: organizationId },
          })) >= 100
        )
          fail(
            409,
            "LIMIT_REACHED",
            "This workspace can contain up to 100 campaigns.",
          );
        const campaign = await tx.campaign.create({
          data: {
            brandOrganizationId: organizationId,
            createdById: userId,
            ...values,
            status: "DRAFT",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: "campaign.created",
            entityType: "Campaign",
            entityId: campaign.id,
          },
        });
        return { success: true, id: campaign.id };
      }
      if (input.action === "submit" && member.organization.status !== "ACTIVE")
        fail(
          403,
          "APPROVAL_REQUIRED",
          "Your organization must be approved before submitting campaigns.",
        );
      if (input.action === "submit") {
        const campaign = await tx.campaign.findFirst({
          where: {
            id: input.id,
            brandOrganizationId: organizationId,
            status: "DRAFT",
          },
        });
        if (!campaign || !canSubmitCampaign(campaign))
          fail(
            400,
            "INVALID_CAMPAIGN",
            "Add a brief, positive budget and a future application deadline before submitting.",
          );
      }
      const result = await tx.campaign.updateMany({
        where: {
          id: input.id,
          brandOrganizationId: organizationId,
          status:
            input.action === "submit" ? "DRAFT" : { in: ["DRAFT", "REVIEW"] },
          ...(input.action === "submit"
            ? { brandOrganization: { status: "ACTIVE" } }
            : {}),
        },
        data: { status: input.action === "submit" ? "REVIEW" : "CANCELED" },
      });
      if (!result.count)
        fail(
          409,
          "INVALID_STATE",
          "This campaign is unavailable or cannot be changed in its current state.",
        );
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `campaign.${input.action}`,
          entityType: "Campaign",
          entityId: input.id,
        },
      });
    },
  );
}

const toolsSchema = z.strictObject({
  tool: z.enum(["social-data", "brand-insight", "comments"]),
  title: shortString.min(1),
  input: z.string().trim().min(1).max(8000),
});
export async function toolsWorkspace(request: Request) {
  return mutate(request, toolsSchema, async (tx, member, userId, input) => {
    if (
      (await tx.workspaceToolRequest.count({
        where: { organizationId: member.organizationId },
      })) >= 1000
    )
      fail(
        409,
        "LIMIT_REACHED",
        "The request limit has been reached. Contact your workspace administrator.",
      );
    await tx.workspaceToolRequest.create({
      data: {
        organizationId: member.organizationId,
        userId,
        tool: input.tool,
        title: input.title,
        inputJson: { input: input.input },
        status: "REQUESTED",
      },
    });
    // No provider is connected: saving a request must never imply AI analysis ran.
  });
}

const accountSchema = z.strictObject({
  name: shortString.min(1),
  websiteUrl: z.string().trim().max(2048),
  contactName: z.string().trim().min(1).max(100),
});
export async function accountWorkspace(request: Request) {
  return mutate(request, accountSchema, async (tx, member, _userId, input) => {
    requireManager(member, true);
    const websiteUrl = input.websiteUrl
      ? safeExternalUrl(input.websiteUrl)
      : null;
    if (input.websiteUrl && !websiteUrl)
      fail(400, "INVALID_URL", "Use a public external HTTPS website URL.");
    await tx.organization.update({
      where: { id: member.organizationId },
      data: {
        name: input.name,
        websiteUrl,
        metadata: {
          ...metadataRecord(member.organization.metadata),
          contactName: input.contactName,
        } as Prisma.InputJsonObject,
      },
    });
  });
}
