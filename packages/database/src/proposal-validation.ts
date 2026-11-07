import { z } from "zod";

export const proposalIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const proposalMoneySchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/);
const platformSchema = z.enum([
  "youtube",
  "chzzk",
  "soop",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
]);
export const proposalItemInputSchema = z
  .strictObject({
    catalogCreatorId: proposalIdSchema.nullable().optional(),
    catalogRateVersion: z.number().int().positive().nullable().optional(),
    creatorId: proposalIdSchema.nullable().default(null),
    creatorName: z.string().trim().max(100).default(""),
    platform: z.union([platformSchema, z.literal("")]).default(""),
    channelLabel: z.string().trim().max(120).default(""),
    channelUrl: z.string().trim().max(2048).default(""),
    followers: z
      .number()
      .int()
      .min(0)
      .max(2_147_483_647)
      .nullable()
      .default(null),
    averageViews: z
      .number()
      .int()
      .min(0)
      .max(2_147_483_647)
      .nullable()
      .default(null),
    deliverables: z.string().trim().max(1000).default(""),
    quantity: z.number().int().min(0).max(1000).default(0),
    unitAmount: z.union([proposalMoneySchema, z.literal("")]).default(""),
    scheduledAt: z.iso.datetime({ offset: true }).nullable().default(null),
    rights: z.string().trim().max(2000).default(""),
    supplierCost: proposalMoneySchema.nullable().default(null),
    internalNotes: z.string().trim().max(2000).default(""),
  })
  .refine(
    (item) =>
      !(item.creatorId && item.catalogCreatorId) &&
      (!item.catalogRateVersion || Boolean(item.catalogCreatorId)),
    "인물 연결 출처와 가격 버전을 확인해 주세요.",
  );
export const proposalDraftInputSchema = z.strictObject({
  title: z.string().trim().max(160).default(""),
  summary: z.string().trim().max(3000).default(""),
  changeSummary: z.string().trim().max(2000).default(""),
  terms: z.string().trim().max(3000).default(""),
  expiresAt: z.iso.datetime({ offset: true }).nullable().default(null),
  items: z.array(proposalItemInputSchema).max(50),
});
export const adminProposalMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("updateCosts"),
    campaignId: proposalIdSchema,
    proposalId: proposalIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    clientRequestId: z.uuid(),
    reason: z.string().trim().min(2).max(1000),
    items: z
      .array(
        z.strictObject({
          itemId: proposalIdSchema,
          supplierCost: proposalMoneySchema.refine(
            (value) => Number(value) > 0,
          ),
        }),
      )
      .min(1)
      .max(50)
      .refine(
        (items) =>
          new Set(items.map((item) => item.itemId)).size === items.length,
      ),
  }),
  z.strictObject({
    action: z.literal("createDraft"),
    campaignId: proposalIdSchema,
    clientRequestId: z.uuid(),
    sourceProposalId: proposalIdSchema.optional(),
  }),
  z.strictObject({
    action: z.literal("saveDraft"),
    campaignId: proposalIdSchema,
    proposalId: proposalIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    clientRequestId: z.uuid(),
    data: proposalDraftInputSchema,
  }),
  z.strictObject({
    action: z.literal("publish"),
    campaignId: proposalIdSchema,
    proposalId: proposalIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    clientRequestId: z.uuid(),
  }),
]);
export const brandProposalMutationSchema = z
  .strictObject({
    action: z.literal("decide"),
    proposalId: proposalIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    clientRequestId: z.uuid(),
    decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
    itemIds: z
      .array(proposalIdSchema)
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
    message: z.string().trim().max(2000).default(""),
  })
  .refine(
    (value) => value.decision === "APPROVE" || value.message.length >= 2,
    "변경·반려 사유를 2자 이상 작성해 주세요.",
  );

// Money is kept in decimal strings/cents so a published quote never uses floats.
export function proposalCents(amount: string): bigint {
  // Persisted campaign budgets use Decimal(18,2); draft unit-price inputs have
  // the narrower limit above so quantity multiplication can be bounded too.
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(amount))
    throw new Error("Invalid proposal amount");
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function proposalAmount(cents: bigint): string {
  if (cents < 0n) throw new Error("Negative proposal amount");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
export function publicChannelUrl(
  value: string,
  platform: string,
): string | null {
  const hosts: Record<string, string[]> = {
    youtube: ["youtube.com", "youtu.be"],
    chzzk: ["chzzk.naver.com"],
    soop: ["sooplive.co.kr", "sooplive.com", "afreecatv.com"],
    tiktok: ["tiktok.com"],
    instagram: ["instagram.com"],
    twitch: ["twitch.tv"],
    x: ["x.com", "twitter.com"],
    facebook: ["facebook.com", "fb.com"],
  };
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      url.search ||
      url.hash ||
      url.pathname === "/" ||
      !(hosts[platform] ?? []).some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`),
      )
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Only reviewed social-channel image hosts are rendered by the browser. No URL is fetched by the server. */
export function publicChannelThumbnailUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const exactHosts = [
    "yt3.ggpht.com",
    "yt3.googleusercontent.com",
    "pbs.twimg.com",
  ];
  const hostSuffixes = [
    "ytimg.com",
    "pstatic.net",
    "sooplive.co.kr",
    "sooplive.com",
    "afreecatv.com",
    "tiktokcdn.com",
    "cdninstagram.com",
    "fbcdn.net",
    "jtvnw.net",
  ];
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      url.hash ||
      url.pathname === "/" ||
      !(
        exactHosts.includes(host) ||
        hostSuffixes.some(
          (allowed) => host === allowed || host.endsWith(`.${allowed}`),
        )
      )
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
