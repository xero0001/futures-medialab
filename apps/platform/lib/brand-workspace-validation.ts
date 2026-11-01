import { z } from "zod";
import { campaignIdSchema } from "./campaign-validation";

const unique = (values: string[]) => new Set(values).size === values.length;
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
export const brandBriefSchema = z.object({
  genre: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(1000),
  contentFormat: z.string().trim().min(1).max(160),
  creatorCount: z.number().int().min(1).max(100),
  desiredDate: dateOnly,
  note: z.string().trim().max(2000).default(""),
  compositionPreference: z
    .enum(["balanced", "reach", "efficient"])
    .nullable()
    .default(null),
});
export const brandCampaignCreateSchema = brandBriefSchema
  .extend({
    title: z.string().trim().min(2).max(160),
    budgetAmount: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0 && Number(value) <= 10_000_000),
    currency: z.enum(["USD", "KRW", "CNY"]),
    platforms: z
      .array(
        z.enum([
          "youtube",
          "chzzk",
          "soop",
          "tiktok",
          "instagram",
          "twitch",
          "x",
          "facebook",
          "recommend",
        ]),
      )
      .min(1)
      .max(9)
      .refine(unique)
      .refine((values) => !values.includes("recommend") || values.length === 1),
    regions: z
      .array(z.string().regex(/^[A-Z]{2}$/))
      .max(40)
      .refine(unique)
      .default([]),
    route: z.enum(["managed", "open"]),
    clientRequestId: z.uuid(),
    applicationDeadline: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

// Drafts preserve unfinished user input; they are never treated as submitted briefs.
export const brandDraftBriefSchema = brandBriefSchema.extend({
  genre: z.string().trim().max(120).default(""),
  goal: z.string().trim().max(1000).default(""),
  contentFormat: z.string().trim().max(160).default(""),
  creatorCount: z.number().int().min(0).max(100).default(0),
  desiredDate: z.union([dateOnly, z.literal("")]).default(""),
});
export const brandCampaignDraftSchema = brandCampaignCreateSchema
  .extend({
    ...brandDraftBriefSchema.shape,
    action: z.literal("saveDraft"),
    title: z.string().trim().min(1).max(160),
    budgetAmount: z
      .union([brandCampaignCreateSchema.shape.budgetAmount, z.literal("")])
      .default(""),
    currency: z.enum(["USD", "KRW", "CNY"]).default("USD"),
    platforms: z
      .union([
        brandCampaignCreateSchema.shape.platforms,
        z.array(z.never()).max(0),
      ])
      .default([]),
    route: z.enum(["managed", "open"]).default("managed"),
    id: campaignIdSchema.optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((input) => !input.id || Boolean(input.expectedUpdatedAt));

export function isFutureBrandDate(value: string, now = new Date()) {
  // Date-only requests are interpreted in the workspace's Korean business timezone.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return value > today;
}

export const brandCampaignMutationSchema = z.union([
  brandCampaignCreateSchema,
  brandCampaignDraftSchema,
  z.strictObject({
    action: z.literal("submitDraft"),
    id: campaignIdSchema,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    clientRequestId: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("cancel"),
    id: campaignIdSchema,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  }),
]);
