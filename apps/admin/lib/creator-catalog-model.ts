import { z } from "zod";
import {
  proposalIdSchema,
  proposalMoneySchema,
  publicChannelUrl,
  publicChannelThumbnailUrl,
} from "@futures-medialab/database/proposal-validation";

export const affiliationNames = {
  IN_HOUSE: "자사",
  PARTNER: "파트너",
  INDEPENDENT: "무소속",
} as const;
export const availabilityNames = {
  UNKNOWN: "미확인",
  AVAILABLE: "가능",
  LIMITED: "조건부",
  UNAVAILABLE: "불가",
} as const;
export const acceptanceNames = {
  UNKNOWN: "미확인",
  YES: "수용",
  CONDITIONAL: "조건부 수용",
  NO: "불가",
} as const;
export const catalogPlatforms = [
  "youtube",
  "chzzk",
  "soop",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
] as const;
export const catalogAgeMs = 90 * 24 * 60 * 60 * 1000;
const note = z.string().trim().max(2000);
const tags = z
  .array(z.string().trim().min(1).max(60))
  .max(30)
  .transform((values) => [...new Set(values)]);
const metric = z.number().int().min(0).max(2_147_483_647).nullable();
const day = z.iso.date().nullable();
export const channelSchema = z
  .strictObject({
    platform: z.enum(catalogPlatforms),
    name: z.string().trim().min(1).max(120),
    url: z.string().trim().max(2048),
    thumbnailUrl: z
      .string()
      .trim()
      .max(2048)
      .nullable()
      .default(null)
      .refine(
        (value) => value === null || Boolean(publicChannelThumbnailUrl(value)),
        "지원되는 채널 이미지 CDN의 HTTPS 주소를 입력해 주세요.",
      ),
    followers: metric,
    averageViews: metric,
    averageLiveViewers: metric,
    peakLiveViewers: metric,
    shortViews: metric,
  })
  .refine((v) => Boolean(publicChannelUrl(v.url, v.platform)), {
    message: "플랫폼의 공개 채널 URL을 입력해 주세요.",
    path: ["url"],
  });
export const profileSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(100),
    affiliation: z.enum(["IN_HOUSE", "PARTNER", "INDEPENDENT"]),
    partnerOrganizationId: proposalIdSchema.nullable(),
    rosterCreatorId: proposalIdSchema.nullable(),
    ownerId: proposalIdSchema,
    channels: z.array(channelSchema).min(1).max(12),
    genres: tags,
    languages: tags,
    formats: tags,
    audienceNotes: note,
    availability: z.enum(["UNKNOWN", "AVAILABLE", "LIMITED", "UNAVAILABLE"]),
    availableFrom: day,
    availableThrough: day,
    availabilityNote: note,
    acceptsChinaGames: z.enum(["UNKNOWN", "YES", "CONDITIONAL", "NO"]),
    conflicts: note,
    riskNotes: note,
    isActive: z.boolean(),
  })
  .refine(
    (v) =>
      (v.affiliation === "PARTNER") === Boolean(v.partnerOrganizationId) &&
      (!v.rosterCreatorId || v.affiliation === "PARTNER"),
    {
      message: "파트너 소속과 연결 조직을 확인해 주세요.",
      path: ["partnerOrganizationId"],
    },
  )
  .refine(
    (v) =>
      !v.availableFrom ||
      !v.availableThrough ||
      v.availableFrom <= v.availableThrough,
    {
      message: "가용 종료일은 시작일 이후여야 합니다.",
      path: ["availableThrough"],
    },
  )
  .refine(
    (v) =>
      new Set(v.channels.map((c) => c.url.toLowerCase())).size ===
      v.channels.length,
    { message: "중복 채널을 확인해 주세요.", path: ["channels"] },
  );
export const rateSchema = z.strictObject({
  format: z.string().trim().min(1).max(120),
  currency: z.enum(["KRW", "USD", "CNY"]),
  minUnits: z.number().int().min(1).max(1000),
  supplyUnit: proposalMoneySchema,
  sellUnit: proposalMoneySchema,
  negotiatedUnit: proposalMoneySchema.nullable(),
  revisionFee: proposalMoneySchema.nullable(),
  rights: note,
  restrictions: note,
  vat: z.enum(["INCLUDED", "EXCLUDED", "UNSPECIFIED"]),
  exchangeDate: day,
  validUntil: day,
});
const rateList = z
  .array(rateSchema)
  .min(1)
  .max(20)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.format.toLowerCase() + "/" + r.currency))
        .size === rows.length,
    "형식·통화가 중복됩니다.",
  );
const reason = z.string().trim().min(2).max(500);
const update = {
  id: proposalIdSchema,
  revision: z.number().int().positive(),
  requestId: z.uuid(),
  reason,
};
export const catalogMutation = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    requestId: z.uuid(),
    profile: profileSchema,
    confirmAvailability: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("update"),
    ...update,
    profile: profileSchema,
    confirmAvailability: z.boolean(),
  }),
  z.strictObject({ action: z.literal("rates"), ...update, rates: rateList }),
]);
export const catalogQuery = z.object({
  q: z.string().trim().max(120).default(""),
  affiliation: z
    .enum(["all", "IN_HOUSE", "PARTNER", "INDEPENDENT"])
    .default("all"),
  active: z.enum(["all", "yes", "no"]).default("yes"),
  stale: z.enum(["all", "yes"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type CatalogChannel = z.infer<typeof channelSchema>;
export type CatalogProfile = z.infer<typeof profileSchema>;
export type CatalogRate = z.infer<typeof rateSchema>;
export type CatalogRecord = CatalogProfile & {
  id: string;
  revision: number;
  ownerName: string;
  partnerName: string | null;
  priceCheckedAt: string | null;
  availabilityCheckedAt: string | null;
  stalePrice: boolean;
  staleAvailability: boolean;
  rateVersion: number | null;
  rates: CatalogRate[];
};
export type CatalogDetail = {
  creator: CatalogRecord;
  history: {
    version: number;
    rates: CatalogRate[];
    reason: string;
    author: string;
    at: string;
  }[];
  campaigns: {
    id: string;
    title: string;
    version: number;
    status: string;
    publishedAt: string | null;
    creatorName: string;
  }[];
};
export type CatalogOptions = {
  selfId: string;
  owners: { id: string; name: string }[];
  agencies: { id: string; name: string }[];
  roster: {
    id: string;
    displayName: string;
    channels: CatalogChannel[];
    genres: string[];
    language: string;
  }[];
};
export type CatalogList = {
  items: CatalogRecord[];
  page: number;
  pageSize: number;
  total: number;
};
export const blankChannel = (): CatalogChannel => ({
  platform: "youtube",
  name: "",
  url: "",
  thumbnailUrl: null,
  followers: null,
  averageViews: null,
  averageLiveViewers: null,
  peakLiveViewers: null,
  shortViews: null,
});
export const blankProfile = (ownerId: string): CatalogProfile => ({
  displayName: "",
  affiliation: "INDEPENDENT",
  partnerOrganizationId: null,
  rosterCreatorId: null,
  ownerId,
  channels: [blankChannel()],
  genres: [],
  languages: [],
  formats: [],
  audienceNotes: "",
  availability: "UNKNOWN",
  availableFrom: null,
  availableThrough: null,
  availabilityNote: "",
  acceptsChinaGames: "UNKNOWN",
  conflicts: "",
  riskNotes: "",
  isActive: true,
});
export const blankRate = (): CatalogRate => ({
  format: "",
  currency: "KRW",
  minUnits: 1,
  supplyUnit: "",
  sellUnit: "",
  negotiatedUnit: null,
  revisionFee: null,
  rights: "",
  restrictions: "",
  vat: "UNSPECIFIED",
  exchangeDate: null,
  validUntil: null,
});
