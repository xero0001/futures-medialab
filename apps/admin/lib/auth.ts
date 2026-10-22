import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const configuredUrl = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !configuredUrl)
    throw new Error("Admin authentication is not configured.");
  const url = new URL(configuredUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname) ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    (process.env.VERCEL === "1" && url.protocol !== "https:")
  )
    throw new Error("A trusted admin origin is required.");
  return betterAuth({
    appName: "Futures Medialab Admin",
    secret,
    baseURL: url.origin,
    basePath: "/api/auth",
    trustedOrigins: [url.origin],
    database: prismaAdapter(getDatabase(), {
      provider: "postgresql",
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    disabledPaths: ["/sign-up/email"],
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 30,
      cookieCache: { enabled: false },
    },
    account: { accountLinking: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    advanced: {
      cookiePrefix: "futures-medialab-admin",
      useSecureCookies: url.protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: {
        ipAddressHeaders:
          process.env.VERCEL === "1" ? ["x-real-ip"] : ["x-forwarded-for"],
      },
    },
    logger: { disabled: true },
    plugins: [nextCookies()],
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (auth ??= createAuth());
}
