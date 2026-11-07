export const PRODUCTION_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const PRODUCTION_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export function productionMediaId(value: string): string | null {
  return (
    /^production-media:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      value,
    )?.[1] ?? null
  );
}
export function productionMediaUrl(value: string) {
  const id = productionMediaId(value);
  return id ? `/api/production/media/${id}` : null;
}
export function productionVideoSource(
  value: string,
): { kind: "video" | "youtube"; src: string } | null {
  const local = productionMediaUrl(value);
  if (local) return { kind: "video", src: local };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (/\.(mp4|webm)$/i.test(url.pathname))
      return { kind: "video", src: url.href };
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
              url.hostname,
            )
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : /^\/(shorts|embed)\/([^/]+)$/.exec(url.pathname)?.[2]
          : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` }
      : null;
  } catch {
    return null;
  }
}
