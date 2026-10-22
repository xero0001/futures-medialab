import "server-only";
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { z } from "zod";
import { getAuth } from "./auth";
import { hasCompletedBrandProfile } from "./brand-profile";
import {
  DEMO_BRANDS,
  filterCreators,
  findSimilarCreators,
  recommendForBrand,
  validateFilters,
  type Creator,
} from "./creator-directory";
import type {
  WorkspaceAccount,
  WorkspaceBootstrap,
  WorkspaceSearchResult,
} from "./workspace-types";

type Transaction = Prisma.TransactionClient;
type Database = Transaction | ReturnType<typeof getDatabase>;
export const workspaceHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const platformSchema = z.enum([
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
]);
const idSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const shortString = z.string().trim().max(120);
const numericBound = z.string().trim().max(16);

const filtersSchema = z
  .strictObject({
    platform: platformSchema,
    query: z.string().trim().max(500),
    searchMode: z.enum(["creator", "content", "bio", "brand"]),
    videoType: z.enum(["all", "video", "shorts", "live"]),
    includeTags: z.array(shortString).max(30),
    excludeTags: z.array(shortString).max(30),
    tagMatch: z.enum(["any", "all"]),
    keywordInclude: z.string().trim().max(500),
    keywordExclude: z.string().trim().max(500),
    keywordMatch: z.enum(["any", "all"]),
    country: z.string().regex(/^(?:[A-Z]{2})?$/),
    followersMin: numericBound,
    followersMax: numericBound,
    viewsMin: numericBound,
    viewsMax: numericBound,
    viewsWindow: z.enum(["last10", "last30"]),
    volatility: z.enum(["", "low", "medium", "high"]),
    lastPosted: z.enum(["", "7", "30", "90"]),
    language: z.string().max(10),
    audienceCountry: z.string().regex(/^(?:[A-Z]{2})?$/),
    audienceAge: z.enum(["", "18-24", "25-34", "35-44", "45+"]),
    audienceGender: z.enum(["", "mixed", "male", "female"]),
  })
  .refine(validateFilters, "Invalid numeric ranges.");

// Validate imported JSON again at the public boundary. Never return raw payloads.
const creatorSchema = z.strictObject({
  id: idSchema,
  name: shortString.min(1),
  handle: shortString.min(1),
  profileUrl: z.url().max(2048),
  platform: platformSchema,
  country: z.string().regex(/^[A-Z]{2}$/),
  language: z.string().min(2).max(10),
  followers: z.number().int().min(0).max(10_000_000_000),
  views10: z.number().int().min(0).max(10_000_000_000),
  views30: z.number().int().min(0).max(10_000_000_000),
  volatility: z.number().min(0).max(1),
  engagement: z.number().min(0).max(100),
  tags: z.array(shortString).max(30),
  bio: z.string().max(2000),
  content: z.array(z.string().max(300)).max(30),
  brands: z.array(shortString).max(30),
  videoTypes: z.array(z.enum(["video", "shorts", "live"])).max(3),
  daysSincePosted: z.number().int().min(0).max(36500),
  audienceCountry: z.string().regex(/^[A-Z]{2}$/),
  audienceAge: z.enum(["18-24", "25-34", "35-44", "45+"]),
  audienceGender: z.enum(["male", "female", "mixed"]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export class WorkspaceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, code: string, message: string): never {
  throw new WorkspaceError(status, code, message);
}
function json(value: unknown, status = 200) {
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
function verifyOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (
    request.headers.get("origin") !== applicationOrigin() ||
    (site !== null && site !== "same-origin")
  ) {
    fail(403, "INVALID_ORIGIN", "This request is not allowed.");
  }
}

async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
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

async function membership(database: Database, userId: string) {
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
  if (!hasCompletedBrandProfile(member.organization.metadata))
    fail(403, "PROFILE_REQUIRED", "Complete your company profile first.");
  return member;
}
type Member = Awaited<ReturnType<typeof membership>>;
function requireManager(member: Member, ownerOnly = false) {
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
async function rateLimit(userId: string, bucket: string, limit: number) {
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

function publishedWhere(member: Member) {
  return {
    isPublished: true,
    ...(member.organization.status === "PENDING" ? { isDemo: true } : {}),
  };
}
async function directory(
  database: Database,
  member: Member,
): Promise<Creator[]> {
  const entries = await database.creatorDirectoryEntry.findMany({
    where: publishedWhere(member),
    orderBy: { id: "asc" },
    take: 500,
  });
  return entries.flatMap((entry) => {
    const parsed = creatorSchema.safeParse(entry.payload);
    if (
      !parsed.success ||
      parsed.data.id !== entry.id ||
      parsed.data.platform !== entry.platform
    )
      return [];
    try {
      const profile = new URL(parsed.data.profileUrl);
      if (profile.protocol !== "https:" || profile.username || profile.password)
        return [];
    } catch {
      return [];
    }
    return [parsed.data];
  });
}

export async function bootstrapWorkspace(request: Request) {
  return workspaceBoundary(async () => {
    const userId = await sessionUser(request);
    await rateLimit(userId, "read", 120);
    const result = await getDatabase().$transaction(
      async (tx): Promise<WorkspaceBootstrap> => {
        const member = await membership(tx, userId),
          organizationId = member.organizationId;
        const [creators, collections, links, campaigns, requests, searches] =
          await Promise.all([
            directory(tx, member),
            tx.creatorCollection.findMany({
              where: { organizationId },
              orderBy: { createdAt: "desc" },
              take: 100,
              select: {
                id: true,
                name: true,
                items: {
                  where: { entry: publishedWhere(member) },
                  take: 500,
                  select: { entryId: true },
                },
              },
            }),
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
            tx.directorySearch.findMany({
              where: { organizationId, userId },
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                mode: true,
                filtersJson: true,
                createdAt: true,
              },
            }),
          ]);
        return {
          creators,
          brands: DEMO_BRANDS,
          collections: collections.map(({ items, ...collection }) => ({
            ...collection,
            creatorIds: items.map((item) => item.entryId),
          })),
          links: links.map((link) => ({
            ...link,
            createdAt: link.createdAt.toISOString(),
          })),
          campaigns: campaigns.map((campaign) => ({
            ...campaign,
            budgetAmount: campaign.budgetAmount?.toFixed(2) ?? null,
            createdAt: campaign.createdAt.toISOString(),
          })),
          requests: requests.map(({ inputJson, ...entry }) => ({
            ...entry,
            input: textField(metadataRecord(inputJson).input),
            createdAt: entry.createdAt.toISOString(),
          })),
          recentSearches: searches.map(({ filtersJson, ...entry }) => ({
            ...entry,
            query: textField(metadataRecord(filtersJson).query),
            createdAt: entry.createdAt.toISOString(),
          })),
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
  search = false,
) {
  return workspaceBoundary(async () => {
    verifyOrigin(request);
    const userId = await sessionUser(request);
    await membership(getDatabase(), userId);
    await rateLimit(userId, "write", 60);
    if (search) await rateLimit(userId, "search", 30);
    const input = await readBody(request, schema);
    const result = await getDatabase().$transaction(
      async (tx) => {
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

const searchSchema = z
  .strictObject({
    mode: z.enum(["search", "similar", "brands"]),
    filters: filtersSchema,
    brandId: idSchema.optional(),
    publishingPlatform: z.enum(["all", "mobile", "pc", "console"]).optional(),
  })
  .refine((input) => {
    if (input.mode === "similar")
      return ["youtube", "tiktok"].includes(input.filters.platform);
    if (input.mode === "brands") return input.filters.platform === "youtube";
    return true;
  }, "This search mode is not available for the selected platform.");
export async function searchWorkspace(request: Request) {
  return mutate(
    request,
    searchSchema,
    async (tx, member, userId, input): Promise<WorkspaceSearchResult> => {
      const source = await directory(tx, member);
      let creators: Creator[] = [],
        seed: Creator | null = null,
        brands = DEMO_BRANDS;
      if (input.mode === "search")
        creators = filterCreators(input.filters, source);
      if (input.mode === "similar") {
        const result = findSimilarCreators(
          input.filters.platform,
          input.filters.query,
          input.filters,
          source,
        );
        creators = result.results;
        seed = result.seed;
      }
      if (input.mode === "brands") {
        const result = recommendForBrand(
          input.brandId ?? "",
          input.filters,
          input.publishingPlatform ?? "all",
          source,
        );
        creators = result.creators;
        brands = result.brands;
      }
      const resultIds = creators.map((creator) => creator.id);
      const realResults = await tx.creatorDirectoryEntry.count({
        where: { id: { in: resultIds }, isDemo: false },
      });
      const search = await tx.directorySearch.create({
        data: {
          organizationId: member.organizationId,
          userId,
          mode: input.mode,
          filtersJson: {
            ...input.filters,
            ...(input.brandId ? { brandId: input.brandId } : {}),
            ...(input.publishingPlatform
              ? { publishingPlatform: input.publishingPlatform }
              : {}),
          },
          resultIdsJson: resultIds,
          isDemo: realResults === 0,
        },
      });
      // Per-user history is useful, but indefinite retention of every query is not.
      const expired = await tx.directorySearch.findMany({
        where: { organizationId: member.organizationId, userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 100,
        select: { id: true },
      });
      if (expired.length)
        await tx.directorySearch.deleteMany({
          where: {
            organizationId: member.organizationId,
            userId,
            id: { in: expired.map((entry) => entry.id) },
          },
        });
      return { creators, seed, brands, searchId: search.id };
    },
    true,
  );
}

const collectionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(80),
  }),
  z.strictObject({
    action: z.enum(["add", "remove"]),
    collectionId: idSchema,
    creatorId: idSchema,
  }),
]);
export async function collectionWorkspace(request: Request) {
  return mutate(
    request,
    collectionSchema,
    async (tx, member, _userId, input) => {
      const organizationId = member.organizationId;
      if (input.action === "create") {
        if (
          (await tx.creatorCollection.count({ where: { organizationId } })) >=
          100
        )
          fail(
            409,
            "LIMIT_REACHED",
            "This workspace can contain up to 100 collections.",
          );
        await tx.creatorCollection.create({
          data: { organizationId, name: input.name },
        });
        return;
      }
      const collection = await tx.creatorCollection.findFirst({
        where: { id: input.collectionId, organizationId },
        select: { id: true },
      });
      if (!collection) fail(404, "NOT_FOUND", "The collection was not found.");
      if (input.action === "remove") {
        await tx.creatorCollectionItem.deleteMany({
          where: { collectionId: collection.id, entryId: input.creatorId },
        });
        return;
      }
      const entry = await tx.creatorDirectoryEntry.findFirst({
        where: { id: input.creatorId, ...publishedWhere(member) },
        select: { id: true },
      });
      if (!entry) fail(404, "NOT_FOUND", "The creator was not found.");
      if (
        (await tx.creatorCollectionItem.count({
          where: { collectionId: collection.id },
        })) >= 500
      )
        fail(
          409,
          "LIMIT_REACHED",
          "A collection can contain up to 500 creators.",
        );
      await tx.creatorCollectionItem.upsert({
        where: {
          collectionId_entryId: {
            collectionId: collection.id,
            entryId: entry.id,
          },
        },
        create: { collectionId: collection.id, entryId: entry.id },
        update: {},
      });
    },
  );
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

const campaignsSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().max(8000),
    platforms: z
      .array(platformSchema)
      .min(1)
      .max(6)
      .refine((values) => new Set(values).size === values.length),
    currency: z.enum(["USD", "KRW", "CNY"]),
    budgetAmount: z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/),
    deadline: z.iso.datetime({ offset: true }).optional(),
  }),
  z.strictObject({ action: z.enum(["submit", "cancel"]), id: idSchema }),
]);
export async function campaignsWorkspace(request: Request) {
  return mutate(request, campaignsSchema, async (tx, member, userId, input) => {
    requireManager(member);
    const organizationId = member.organizationId;
    if (input.action === "create") {
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
      await tx.campaign.create({
        data: {
          brandOrganizationId: organizationId,
          createdById: userId,
          title: input.title,
          summary: input.summary,
          platforms: input.platforms,
          currency: input.currency,
          budgetAmount: input.budgetAmount,
          applicationDeadline: input.deadline ? new Date(input.deadline) : null,
          status: "DRAFT",
        },
      });
      return;
    }
    if (input.action === "submit" && member.organization.status !== "ACTIVE")
      fail(
        403,
        "APPROVAL_REQUIRED",
        "Your organization must be approved before submitting campaigns.",
      );
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
  });
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
