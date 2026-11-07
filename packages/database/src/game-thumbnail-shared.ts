export const GAME_THUMBNAIL_MAX_BYTES = 4 * 1024 * 1024;
export const GAME_THUMBNAIL_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const GAME_THUMBNAIL_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export function gameThumbnailHash(url: string): string | null {
  return /^\/api\/games\/thumbnails\/([a-f0-9]{64})$/.exec(url)?.[1] ?? null;
}
export function gameThumbnailUrl(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid thumbnail hash");
  return `/api/games/thumbnails/${hash}`;
}
