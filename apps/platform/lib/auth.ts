import { getDatabase } from "@futures-medialab/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organizationRegistration } from "./auth-registration";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const configuredUrl = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !configuredUrl) {
    throw new Error("Authentication configuration is incomplete.");
  }
  const url = new URL(configuredUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "") ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    (process.env.VERCEL === "1" && url.protocol !== "https:")
  ) {
    throw new Error(
      "Authentication requires an exact, trusted application origin.",
    );
  }

  return betterAuth({
    appName: "Futures Medialab",
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
      requireEmailVerification: false,
    },
    // New users must pass the role whitelist and create a pending organization
    // atomically; the generic signup endpoint cannot create orphan accounts.
    disabledPaths: ["/sign-up/email"],
    user: {
      additionalFields: {
        locale: { type: "string", defaultValue: "EN", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { accountLinking: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-up/organization": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: url.protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      // Vercel overwrites x-real-ip; local Next.js provides x-forwarded-for.
      // Do not trust arbitrary, comma-separated forwarding chains.
      ipAddress: {
        ipAddressHeaders:
          process.env.VERCEL === "1" ? ["x-real-ip"] : ["x-forwarded-for"],
      },
    },
    logger: { disabled: true },
    plugins: [organizationRegistration(), nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Keep configuration and database initialization out of build-time imports.
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
