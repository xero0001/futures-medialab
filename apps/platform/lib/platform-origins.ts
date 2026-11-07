// These are two public addresses of the same production platform deployment.
const productionOrigins = [
  "https://futures-medialab.vercel.app",
  "https://www.futuresmedia.app",
];

export function trustedPlatformOrigins(configuredBase: unknown): string[] {
  if (typeof configuredBase !== "string") {
    throw new Error("An explicit platform origin is required.");
  }
  const origin = new URL(configuredBase).origin;
  return productionOrigins.includes(origin) ? [...productionOrigins] : [origin];
}

export function allowsPlatformWrite(
  headers: Headers,
  configuredBase: unknown,
): boolean {
  const origin = headers.get("origin");
  const site = headers.get("sec-fetch-site");
  if (!origin || !trustedPlatformOrigins(configuredBase).includes(origin))
    return false;
  if (site !== null) return site === "same-origin";
  // Older clients omit Fetch Metadata. Compare their Origin to the request authority as well.
  const host = headers.get("host");
  if (!host) return origin === configuredBase;
  const url = new URL(origin);
  const authority = host.toLowerCase();
  return (
    authority === url.host ||
    (url.port === "" &&
      authority === `${url.hostname}:${url.protocol === "https:" ? 443 : 80}`)
  );
}
