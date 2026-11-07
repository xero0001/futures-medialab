import { z } from "zod";
import type {
  BrandCampaign,
  BrandCampaignRoute,
} from "./brand-workspace-types";

// Store unfinished text without treating it as a validated campaign request.
const formSchema = z.object({
  title: z.string().max(160),
  gameName: z.string().max(120),
  genre: z.string().max(120),
  goal: z.string().max(1000),
  budgetAmount: z.string().max(100),
  currency: z.enum(["USD", "KRW", "CNY"]),
  platforms: z.array(z.string().max(30)).max(9),
  regions: z.array(z.string().regex(/^[A-Z]{2}$/)).max(40),
  contentFormat: z.string().max(160),
  creatorCount: z.string().max(100),
  desiredDate: z.string().max(10),
  note: z.string().max(2000),
  compositionPreference: z.enum(["balanced", "reach", "efficient"]),
  route: z.enum(["managed", "open"]),
  applicationDate: z.string().max(10),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  savedAt: z.number().finite(),
  form: formSchema,
  step: z.number().int().min(0).max(2),
  stage: z.number().int().min(0).max(2),
  requestId: z.uuid().nullable(),
  submitId: z.uuid().nullable(),
  draft: z
    .object({ id: z.string().min(1).max(100), updatedAt: z.iso.datetime() })
    .nullable(),
});
export type RequestDraftSnapshot = z.output<typeof snapshotSchema>;
export type RequestDraftForm = z.output<typeof formSchema>;
const storageKey = (scope: string, route: BrandCampaignRoute) =>
  `fm:campaign-request:v1:${encodeURIComponent(scope)}:${route}`;

export function readRequestDraft(
  scope: string,
  route: BrandCampaignRoute,
): RequestDraftSnapshot | null {
  try {
    const parsed = snapshotSchema.safeParse(
      JSON.parse(localStorage.getItem(storageKey(scope, route)) ?? "null"),
    );
    return parsed.success && Date.now() - parsed.data.savedAt < 30 * 86400000
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function writeRequestDraft(
  scope: string,
  route: BrandCampaignRoute,
  snapshot: RequestDraftSnapshot,
) {
  try {
    localStorage.setItem(storageKey(scope, route), JSON.stringify(snapshot));
  } catch {
    // Browser storage may be disabled. Server draft saving still works.
  }
}

export function clearRequestDraft(scope: string, route: BrandCampaignRoute) {
  try {
    localStorage.removeItem(storageKey(scope, route));
  } catch {
    /* Storage unavailable. */
  }
}

export function canRestoreRequestDraft(
  snapshot: RequestDraftSnapshot | null,
  campaign?: BrandCampaign,
) {
  if (!snapshot) return false;
  if (!campaign) return snapshot.draft === null;
  // Never overlay changes on another draft, or on a newer server version.
  return (
    campaign.status === "DRAFT" &&
    snapshot.draft?.id === campaign.id &&
    snapshot.draft.updatedAt === campaign.updatedAt
  );
}

export function requestBriefStage(field: string) {
  if (
    ["contentFormat", "creatorCount", "desiredDate", "platforms"].includes(
      field,
    )
  )
    return 1;
  if (["goal", "regions", "note"].includes(field)) return 2;
  return 0;
}
