import creators from "./futures-creator-assets.json";

function channelIdentity(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        url.hostname,
      )
    )
      return null;
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    // Handles are case insensitive; channel IDs are case sensitive.
    return path.startsWith("/@") ? path.toLowerCase() : path;
  } catch {
    return null;
  }
}

const thumbnails = new Map(
  creators.flatMap((creator) =>
    creator.channelUrls.map(
      (url) => [channelIdentity(url), creator.thumbnailPath] as const,
    ),
  ),
);

// Match a published channel URL, never a creator's display name or initial.
export function futuresCreatorThumbnail(channelUrl: string) {
  const identity = channelIdentity(channelUrl);
  return identity ? (thumbnails.get(identity) ?? null) : null;
}
