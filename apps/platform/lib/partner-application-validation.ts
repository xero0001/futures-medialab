import { z } from "zod";
import { publicChannelUrl } from "@futures-medialab/database/proposal-validation";

export const partnerPlatform = (value: string) =>
  ({
    YouTube: "youtube",
    치지직: "chzzk",
    SOOP: "soop",
    TikTok: "tiktok",
    Instagram: "instagram",
  })[value] ?? value.toLowerCase();
export const platformLabel = (value: string) =>
  ({
    youtube: "YouTube",
    chzzk: "치지직",
    soop: "SOOP",
    tiktok: "TikTok",
    instagram: "Instagram",
  })[value] ?? value;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const platform = z.enum([
  "youtube",
  "chzzk",
  "soop",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
]);
const money = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  .refine((v) => Number(v) > 0);
export const partnerRowSchema = z.strictObject({
  creatorId: id,
  platform,
  format: z.enum(["라이브", "VOD", "쇼츠", "커뮤니티"]),
  quantity: z.number().int().min(1).max(50),
  unitAmount: money,
  date,
});
const fields = {
  campaignId: id,
  applicationId: id.optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  clientRequestId: z.uuid(),
  note: z.string().trim().max(2000).default(""),
  rows: z
    .array(partnerRowSchema)
    .min(1)
    .max(20)
    .refine(
      (rows) =>
        new Set(rows.map((r) => `${r.creatorId}:${r.platform}:${r.format}`))
          .size === rows.length,
      "동일한 크리에이터·매체·형식의 수량을 합쳐 주세요.",
    ),
};
export const partnerApplicationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("apply"), ...fields }),
  z.strictObject({
    action: z.literal("saveDraft"),
    ...fields,
    rows: z
      .array(
        z.strictObject({
          creatorId: z.union([id, z.literal("")]),
          platform: z.union([platform, z.literal("")]),
          format: z.enum(["라이브", "VOD", "쇼츠", "커뮤니티"]),
          quantity: z.number().int().min(0).max(50),
          unitAmount: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
          date: z.union([date, z.literal("")]),
        }),
      )
      .max(20),
  }),
  z.strictObject({ action: z.literal("withdraw"), applicationId: id }),
]);
export const partnerCreatorSchema = z
  .strictObject({
    id: id.optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
    name: z.string().trim().min(1).max(100),
    channel: z.string().trim().max(2048),
    platform,
    genre: z.string().trim().min(1).max(150),
    followers: z.number().int().min(0).max(2_147_483_647),
    format: z.enum(["라이브", "VOD", "쇼츠", "커뮤니티"]),
    rate: z.number().min(0).max(1_000_000_000).multipleOf(0.01),
    available: date,
    acceptance: z.enum(["검토 가능", "조건 협의", "진행 불가"]),
    bio: z.string().trim().max(2000),
  })
  .refine(
    (v) => Boolean(publicChannelUrl(v.channel, v.platform)),
    "선택한 플랫폼의 공개 HTTPS 채널 주소를 입력해 주세요.",
  );
