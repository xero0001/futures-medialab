import { z } from "zod";

export const campaignIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const amountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
const platforms = z.enum([
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
]);
const unique = (values: string[]) => new Set(values).size === values.length;
const fields = {
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(8000),
  platforms: z.array(platforms).min(1).max(6).refine(unique),
  regions: z
    .array(z.string().regex(/^[A-Z]{2}$/))
    .max(40)
    .refine(unique)
    .default([]),
  categories: z
    .array(
      z.enum([
        "gaming",
        "entertainment",
        "lifestyle",
        "technology",
        "beauty",
        "travel",
      ]),
    )
    .max(6)
    .refine(unique)
    .default([]),
  followerMin: z.number().int().min(0).max(2_147_483_647).optional(),
  followerMax: z.number().int().min(0).max(2_147_483_647).optional(),
  currency: z.enum(["USD", "KRW", "CNY"]),
  budgetAmount: amountSchema,
  deadline: z.iso.datetime({ offset: true }).optional(),
};

export const campaignMutationSchema = z
  .discriminatedUnion("action", [
    z.strictObject({ action: z.literal("create"), ...fields }),
    z.strictObject({
      action: z.literal("update"),
      id: campaignIdSchema,
      ...fields,
    }),
    z.strictObject({
      action: z.enum(["submit", "cancel"]),
      id: campaignIdSchema,
    }),
  ])
  .refine(
    (input) =>
      !("followerMin" in input && "followerMax" in input) ||
      input.followerMin === undefined ||
      input.followerMax === undefined ||
      input.followerMin <= input.followerMax,
    "Invalid follower range.",
  );

export function canSubmitCampaign(
  campaign: {
    title: string;
    summary: string;
    platforms: string[];
    budgetAmount: { toString(): string } | string | null;
    applicationDeadline: Date | null;
  },
  now = new Date(),
) {
  return Boolean(
    campaign.title.trim() &&
    campaign.summary.trim() &&
    campaign.platforms.length &&
    campaign.budgetAmount !== null &&
    Number(campaign.budgetAmount.toString()) > 0 &&
    campaign.applicationDeadline &&
    campaign.applicationDeadline.getTime() > now.getTime(),
  );
}

export const agencyApplicationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("apply"),
    campaignId: campaignIdSchema,
    proposal: z.string().trim().min(1).max(5000),
    proposedAmount: amountSchema.optional(),
  }),
  z.strictObject({
    action: z.literal("withdraw"),
    applicationId: campaignIdSchema,
  }),
]);

export const brandApplicationSchema = z.strictObject({
  action: z.enum(["shortlist", "accept", "reject"]),
  applicationId: campaignIdSchema,
});
