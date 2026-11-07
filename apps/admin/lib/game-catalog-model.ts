import { z } from "zod";

export const gameLanguages = [
  ["KO", "한국어"],
  ["EN", "영어"],
  ["ZH", "중국어 · 간체"],
] as const;
export type GameLocale = (typeof gameLanguages)[number][0];

export function publicGameUrl(value: string) {
  if (/\s|\\/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) &&
      !/\.(?:localhost|local|internal|lan|home|test|invalid)$/i.test(
        url.hostname,
      ) &&
      !/^\d+(?:\.\d+){3}$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}
export function validGameThumbnail(value: string) {
  return (
    publicGameUrl(value) ||
    (/^\/(?:demo|games)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp|avif|svg)$/.test(
      value,
    ) &&
      !value.includes("//"))
  );
}
const localization = z
  .strictObject({
    locale: z.enum(["KO", "EN", "ZH"]),
    title: z.string().trim().max(120),
    officialUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (v) => !v || publicGameUrl(v),
        "공식 사이트의 HTTPS 주소를 입력해 주세요.",
      ),
  })
  .refine(
    (v) => Boolean(v.title) || !v.officialUrl,
    "공식 사이트 주소와 함께 게임명을 입력해 주세요.",
  );
export const gameProfileSchema = z
  .strictObject({
    title: z.string().trim().min(1, "대표 게임명을 입력해 주세요.").max(120),
    thumbnailUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        validGameThumbnail,
        "썸네일 이미지의 HTTPS 주소를 입력해 주세요.",
      ),
    verified: z.boolean(),
    aliases: z.array(z.string().trim().min(1).max(120)).max(40),
    localizations: z
      .array(localization)
      .length(3)
      .refine(
        (rows) => new Set(rows.map((r) => r.locale)).size === 3,
        "언어별 명칭은 한 번씩 입력해 주세요.",
      ),
  })
  .refine(
    (v) => v.localizations.some((row) => row.title),
    "언어별 게임명을 하나 이상 입력해 주세요.",
  );
export const gameMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    requestId: z.uuid(),
    profile: gameProfileSchema,
  }),
  z.strictObject({
    action: z.literal("update"),
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
    expectedUpdatedAt: z.iso.datetime(),
    reason: z
      .string()
      .trim()
      .min(2, "변경 사유를 2자 이상 입력해 주세요.")
      .max(500),
    profile: gameProfileSchema,
  }),
]);
export const gameQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["all", "verified", "pending"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type GameProfile = z.infer<typeof gameProfileSchema>;
export type AdminGame = GameProfile & {
  id: string;
  updatedAt: string;
  organizationName: string | null;
  campaignCount: number;
};
export type GameList = {
  games: AdminGame[];
  total: number;
  page: number;
  pageSize: number;
};
export function blankGame(): GameProfile {
  return {
    title: "",
    thumbnailUrl: "",
    verified: true,
    aliases: [],
    localizations: gameLanguages.map(([locale]) => ({
      locale,
      title: "",
      officialUrl: "",
    })),
  };
}
