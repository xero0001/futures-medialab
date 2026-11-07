import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const gameCatalogSelect = {
  id: true,
  title: true,
  thumbnailUrl: true,
  verified: true,
  aliases: true,
  localizations: { select: { locale: true, title: true, officialUrl: true } },
} satisfies Prisma.GameCatalogSelect;
export type CatalogGame = Prisma.GameCatalogGetPayload<{
  select: typeof gameCatalogSelect;
}>;
export type GameLanguage = "ko" | "en" | "zh";

export function normalizeGameTitle(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function localizedGame(game: CatalogGame, locale: GameLanguage) {
  const localized = game.localizations.find(
    (item) => item.locale === locale.toUpperCase(),
  );
  return {
    id: game.id,
    title: localized?.title ?? game.title,
    thumbnailUrl: game.thumbnailUrl,
    verified: game.verified,
    officialUrl: localized?.officialUrl ?? null,
  };
}

export async function resolveCampaignGame(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: { gameId?: string | null; gameName: string; gameLocale: GameLanguage },
) {
  if (input.gameId) {
    return tx.gameCatalog.findFirst({
      where: { id: input.gameId, OR: [{ verified: true }, { organizationId }] },
      select: gameCatalogSelect,
    });
  }
  const title = input.gameName.trim();
  if (!title) return null;
  const normalized = normalizeGameTitle(title);
  const existing = await tx.gameCatalog.findFirst({
    where: {
      aliases: { has: normalized },
      OR: [{ verified: true }, { organizationId }],
    },
    orderBy: [{ verified: "desc" }, { createdAt: "asc" }],
    select: gameCatalogSelect,
  });
  if (existing) return existing;
  const key = `custom:${createHash("sha256").update(`${organizationId}:${input.gameLocale}:${normalized}`).digest("hex")}`;
  // Never invent translated official names for an unverified title.
  return tx.gameCatalog.upsert({
    where: { key },
    update: {},
    create: {
      key,
      title,
      organizationId,
      thumbnailUrl: "/games/placeholder.svg",
      aliases: [normalized],
      searchText: normalized,
      localizations: {
        create: {
          locale: input.gameLocale.toUpperCase() as "KO" | "EN" | "ZH",
          title,
        },
      },
    },
    select: gameCatalogSelect,
  });
}
