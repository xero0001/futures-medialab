// Exact public addresses of the same production admin deployment.
// Development and preview environments trust only their configured origin.
const productionOrigins = [
  "https://futures-medialab-admin.vercel.app",
  "https://admin-f.futuresmedia.app",
];

export function trustedAdminOrigins(configuredBase: unknown): string[] {
  if (typeof configuredBase !== "string") {
    throw new Error("An explicit admin origin is required.");
  }
  const origin = new URL(configuredBase).origin;
  return productionOrigins.includes(origin) ? [...productionOrigins] : [origin];
}

export function allowsAdminWrite(
  headers: Headers,
  configuredBase: unknown,
): boolean {
  const origin = headers.get("origin");
  const site = headers.get("sec-fetch-site");
  if (!origin || !trustedAdminOrigins(configuredBase).includes(origin))
    return false;
  if (site !== null) return site === "same-origin";
  // Older clients omit Fetch Metadata; their Origin must match the request host.
  const host = headers.get("host");
  if (!host) return origin === new URL(configuredBase as string).origin;
  const url = new URL(origin);
  const authority = host.toLowerCase();
  return (
    authority === url.host ||
    (url.port === "" &&
      authority === `${url.hostname}:${url.protocol === "https:" ? 443 : 80}`)
  );
}
