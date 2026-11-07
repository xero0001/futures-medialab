import { z } from "zod";
import { campaignIdSchema } from "./campaign-validation";

import {
  brandBriefSchema,
  brandCampaignCreateSchema,
} from "@futures-medialab/database/brand-intake";
export {
  brandBriefSchema,
  brandCampaignCreateSchema,
  isFutureBrandDate,
} from "@futures-medialab/database/brand-intake";

// Drafts preserve unfinished user input; they are never treated as submitted briefs.
export const brandDraftBriefSchema = brandBriefSchema.extend({
  genre: z.string().trim().max(120).default(""),
  goal: z.string().trim().max(1000).default(""),
  contentFormat: z.string().trim().max(160).default(""),
  creatorCount: z.number().int().min(0).max(100).default(0),
  desiredDate: z
    .union([brandBriefSchema.shape.desiredDate, z.literal("")])
    .default(""),
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
