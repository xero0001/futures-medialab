export type CampaignArtwork = {
  gameName: string | null;
  coverImageUrl: string | null;
  gameIconUrl: string | null;
  gameSourceUrl: string | null;
};

export function campaignArtwork(coverImageUrl: string | null | undefined, requirements: unknown): CampaignArtwork {
  const empty: CampaignArtwork = { gameName: null, coverImageUrl: null, gameIconUrl: null, gameSourceUrl: null };
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) return empty;
  const values = requirements as Record<string, unknown>;
  if (values.demo !== true || values.seed !== "official-proposals-nte-v1") return empty;
  const game = values.game && typeof values.game === "object" && !Array.isArray(values.game) ? values.game as Record<string, unknown> : {};
  return {
    gameName: typeof game.name === "string" ? game.name.slice(0, 120) : null,
    coverImageUrl: coverImageUrl === "/demo/nte/city-key-art.jpg" ? coverImageUrl : null,
    gameIconUrl: game.iconUrl === "/demo/nte/game-icon.png" ? game.iconUrl : null,
    gameSourceUrl: game.sourceUrl === "https://nte.perfectworld.com/kr/" ? game.sourceUrl : null,
  };
}
