import { z } from "zod";
import type {
  BrandCampaign,
  BrandCampaignRoute,
} from "./brand-workspace-types";

// Store unfinished text without treating it as a validated campaign request.
const formSchema = z.object({
  gameId: z.string().max(120).nullable().default(null),
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

const archivePrefix = (scope: string, route: BrandCampaignRoute) =>
  `${storageKey(scope, route)}:saved:`;
const identity = (snapshot: RequestDraftSnapshot) =>
  snapshot.draft?.id ?? snapshot.requestId;

function parseSnapshot(value: string | null): RequestDraftSnapshot | null {
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(value ?? "null"));
    return parsed.success && Date.now() - parsed.data.savedAt < 30 * 86400000
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function hasRequestDraftInput(snapshot: RequestDraftSnapshot) {
  const form = snapshot.form;
  return Boolean(
    snapshot.draft ||
    [
      form.title,
      form.gameName,
      form.genre,
      form.goal,
      form.budgetAmount,
      form.contentFormat,
      form.creatorCount,
      form.desiredDate,
      form.note,
      form.applicationDate,
    ].some((value) => value.trim()) ||
    form.platforms.length,
  );
}

export function listRequestDrafts(scope: string, route: BrandCampaignRoute) {
  const snapshots: RequestDraftSnapshot[] = [];
  try {
    const active = parseSnapshot(
      localStorage.getItem(storageKey(scope, route)),
    );
    if (active && hasRequestDraftInput(active)) snapshots.push(active);
    const prefix = archivePrefix(scope, route);
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const snapshot = parseSnapshot(localStorage.getItem(key));
      if (
        snapshot &&
        hasRequestDraftInput(snapshot) &&
        !snapshots.some((existing) => identity(existing) === identity(snapshot))
      )
        snapshots.push(snapshot);
    }
  } catch {
    /* Browser storage may be unavailable. Server drafts are still listed. */
  }
  return snapshots;
}

export function readRequestDraft(
  scope: string,
  route: BrandCampaignRoute,
  campaignId?: string,
): RequestDraftSnapshot | null {
  try {
    const active = parseSnapshot(
      localStorage.getItem(storageKey(scope, route)),
    );
    if (!campaignId || active?.draft?.id === campaignId) return active;
    return parseSnapshot(
      localStorage.getItem(`${archivePrefix(scope, route)}${campaignId}`),
    );
  } catch {
    return null;
  }
}

function archiveRequestDraft(
  scope: string,
  route: BrandCampaignRoute,
  snapshot: RequestDraftSnapshot,
) {
  if (!hasRequestDraftInput(snapshot)) return;
  const saved = {
    ...snapshot,
    requestId: snapshot.requestId ?? crypto.randomUUID(),
  };
  localStorage.setItem(
    `${archivePrefix(scope, route)}${identity(saved)}`,
    JSON.stringify(saved),
  );
}

export function writeRequestDraft(
  scope: string,
  route: BrandCampaignRoute,
  snapshot: RequestDraftSnapshot,
) {
  try {
    const current = readRequestDraft(scope, route);
    const sameDraft =
      current &&
      ((current.draft && current.draft.id === snapshot.draft?.id) ||
        (current.requestId && current.requestId === snapshot.requestId) ||
        (!current.draft && !snapshot.draft && !current.requestId));
    if (current && !sameDraft) archiveRequestDraft(scope, route, current);
    localStorage.setItem(storageKey(scope, route), JSON.stringify(snapshot));
    // Once activated/saved, this record no longer needs a second recovery copy.
    for (const id of [snapshot.draft?.id, snapshot.requestId])
      if (id) localStorage.removeItem(`${archivePrefix(scope, route)}${id}`);
    return true;
  } catch {
    return false;
  }
}

export function startNewRequestDraft(scope: string, route: BrandCampaignRoute) {
  const current = readRequestDraft(scope, route);
  if (!current) {
    clearRequestDraft(scope, route);
    return true;
  }
  try {
    archiveRequestDraft(scope, route, current);
    localStorage.removeItem(storageKey(scope, route));
    return true;
  } catch {
    return false;
  }
}

export function clearRequestDraft(scope: string, route: BrandCampaignRoute) {
  try {
    const current = readRequestDraft(scope, route);
    if (current && identity(current))
      localStorage.removeItem(
        `${archivePrefix(scope, route)}${identity(current)}`,
      );
    localStorage.removeItem(storageKey(scope, route));
  } catch {
    /* Storage unavailable. */
  }
}

export type RequestDraftChoice = {
  id: string;
  title: string;
  savedAt: number;
  route: BrandCampaignRoute;
  storageRoute: BrandCampaignRoute;
  campaign?: BrandCampaign;
  snapshot?: RequestDraftSnapshot;
};

export function requestDraftChoices(
  campaigns: BrandCampaign[],
  snapshots: {
    storageRoute: BrandCampaignRoute;
    snapshot: RequestDraftSnapshot;
  }[],
) {
  const choices = new Map<string, RequestDraftChoice>();
  for (const campaign of campaigns) {
    if (campaign.status !== "DRAFT") continue;
    const route = campaign.type === "OPEN_BIDDING" ? "open" : "managed";
    choices.set(campaign.id, {
      id: campaign.id,
      campaign,
      title: campaign.title,
      savedAt: Date.parse(campaign.updatedAt),
      route,
      storageRoute: route,
    });
  }
  for (const { storageRoute, snapshot } of snapshots) {
    if (!hasRequestDraftInput(snapshot)) continue;
    if (snapshot.draft) {
      const choice = choices.get(snapshot.draft.id);
      if (
        choice &&
        canRestoreRequestDraft(snapshot, choice.campaign) &&
        snapshot.savedAt >= choice.savedAt
      )
        choices.set(choice.id, {
          ...choice,
          snapshot,
          storageRoute,
          title: snapshot.form.title,
          savedAt: snapshot.savedAt,
        });
    } else {
      const id = `local:${storageRoute}:${snapshot.requestId ?? "active"}`;
      choices.set(id, {
        id,
        snapshot,
        title: snapshot.form.title,
        savedAt: snapshot.savedAt,
        route: snapshot.form.route,
        storageRoute,
      });
    }
  }
  return [...choices.values()].sort(
    (a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id),
  );
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

export function requestCurrencyForLocale(locale: "ko" | "en" | "zh") {
  return ({ ko: "KRW", en: "USD", zh: "CNY" } as const)[locale];
}

export function requestDraftPath(campaign: Pick<BrandCampaign, "id" | "type">) {
  const route = campaign.type === "OPEN_BIDDING" ? "open" : "managed";
  return `/advertiser/campaign/new?draft=${encodeURIComponent(campaign.id)}&route=${route}`;
}
