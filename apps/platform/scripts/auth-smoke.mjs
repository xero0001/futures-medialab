import assert from "node:assert/strict";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { verifyPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// This suite creates only uniquely named, synthetic accounts and removes those
// exact accounts/organizations in finally. Never run against an unrelated DB.
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const databaseRequire = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
const { config } = databaseRequire("dotenv");
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3002" },
    "env-file": { type: "string", default: "apps/platform/.env.local" },
    "allow-remote": { type: "boolean", default: false },
  },
});
const baseUrl = new URL(values["base-url"]);
assert.ok(
  ["http:", "https:"].includes(baseUrl.protocol) &&
    !baseUrl.username &&
    !baseUrl.password &&
    baseUrl.pathname === "/" &&
    !baseUrl.search &&
    !baseUrl.hash,
  "--base-url must be an HTTP(S) origin without credentials, path, or query",
);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
assert.ok(
  isLocal || values["allow-remote"],
  "Remote tests require --allow-remote",
);
assert.ok(
  isLocal || baseUrl.protocol === "https:",
  "Remote tests require HTTPS",
);

const loaded = config({
  path: resolve(repositoryRoot, values["env-file"]),
  quiet: true,
  override: false,
});
assert.ok(!loaded.error, "Cannot load the selected ignored environment file");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");
assert.ok(process.env.BETTER_AUTH_URL, "BETTER_AUTH_URL must be configured");
assert.equal(
  new URL(process.env.BETTER_AUTH_URL).origin,
  baseUrl.origin,
  "BETTER_AUTH_URL must match --base-url; use the same DB environment as the server",
);

const db = createDatabaseClient();
const runId = `${Date.now()}-${randomBytes(6).toString("hex")}`;
const namePrefix = `Auth QA ${runId}`;
const password = `Qa-${randomBytes(24).toString("base64url")}!`;
const fixtureEmails = new Set();
const fixtureNames = new Set();
const requestWindows = new Map();
const storagePaths = [
  "/storage/search",
  "/storage/similar-search",
  "/storage/similar-brands",
];
let currentStep = "preflight";
let failed = false;

function fixture(label, overrides = {}) {
  const email = `auth-qa-${runId}-${label}@example.invalid`;
  fixtureEmails.add(email);
  fixtureNames.add(`${namePrefix} ${label}`);
  return {
    role: "agency",
    organizationName: `${namePrefix} ${label}`,
    agencyType: "agency",
    email,
    password,
    locale: "en",
    ...overrides,
  };
}

async function cooldown(milliseconds) {
  // Keep individual waits below 60 seconds, including in interactive runs.
  let remaining = milliseconds;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 30_000);
    await delay(chunk);
    remaining -= chunk;
  }
}

async function request(
  path,
  { body, cookie, origin = baseUrl.origin, pace = true } = {},
) {
  // Better Auth resets these counters after 60 seconds of inactivity, not a
  // fixed clock minute. Respect that cooldown instead of spoofing client IPs.
  const max =
    path === "/api/auth/sign-up/organization"
      ? 5
      : path === "/api/auth/sign-in/email"
        ? 10
        : 0;
  const window = requestWindows.get(path) ?? { count: 0, last: 0 };
  if (pace && max && window.count >= max) {
    const remaining = Math.max(0, 60_500 - (Date.now() - window.last));
    if (remaining) {
      console.log("WAIT auth endpoint cooldown (no limiter bypass)");
      await cooldown(remaining);
    }
    window.count = 0;
  }
  window.count += 1;
  window.last = Date.now();
  requestWindows.set(path, window);
  const response = await globalThis.fetch(new URL(path, baseUrl), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(30_000),
    headers: {
      ...(origin === null
        ? {}
        : {
            Origin: origin,
            "Sec-Fetch-Site":
              origin === baseUrl.origin ? "same-origin" : "cross-site",
          }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json = null;
  if (response.headers.get("content-type")?.includes("application/json")) {
    json = JSON.parse(text);
  }
  return { response, json, text };
}

async function check(label, callback) {
  currentStep = label;
  await callback();
  console.log(`PASS ${label}`);
}

async function readFixture(email) {
  return db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      accounts: true,
      sessions: true,
      memberships: { include: { organization: true } },
    },
  });
}

async function signIn(email) {
  const result = await request("/api/auth/sign-in/email", {
    body: { email, password, rememberMe: true },
  });
  assert.equal(result.response.status, 200, "Valid sign-in must succeed");
  assert.ok(result.json?.user?.id, "Sign-in must return the user");
  const setCookies = result.response.headers.getSetCookie();
  const sessionCookie = setCookies.find((value) =>
    value.split("=", 1)[0].endsWith("session_token"),
  );
  assert.ok(sessionCookie, "Sign-in must issue a session cookie");
  assert.match(
    sessionCookie,
    /;\s*HttpOnly(?:;|$)/i,
    "Session cookie must be HttpOnly",
  );
  assert.match(
    sessionCookie,
    /;\s*SameSite=Lax(?:;|$)/i,
    "Session cookie must be SameSite=Lax",
  );
  if (baseUrl.protocol === "https:") {
    assert.match(
      sessionCookie,
      /;\s*Secure(?:;|$)/i,
      "HTTPS session cookie must be Secure",
    );
  }
  return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
}

function profileFor(input) {
  return {
    organizationName: input.organizationName,
    industry: "gaming",
    countryCode: "KR",
    companySize: "15–49",
    contactName: "QA contact",
    phoneDialCode: "+82",
    phoneNumber: "0000000000",
    interests: ["campaign-management"],
    note: "QA",
  };
}

function assertRedirect(result, pathname, message) {
  assert.ok([303, 307, 308].includes(result.response.status), message);
  assert.equal(
    new URL(result.response.headers.get("location"), baseUrl).pathname,
    pathname,
    message,
  );
}

async function assertStorageAccess(cookie, destination = null) {
  for (const path of storagePaths) {
    const result = await request(`${path}?lang=en`, { cookie });
    if (destination) {
      assertRedirect(result, destination, `${path} must redirect safely`);
    } else {
      assert.equal(result.response.status, 200, `${path} must be accessible`);
      assert.ok(
        result.text.includes('data-creator-workspace="demo"'),
        "The workspace must explicitly identify its demo-data boundary",
      );
    }
  }
}

async function assertStoredBrandProfile(email, profile, organizationId) {
  const user = await readFixture(email);
  const organization = user.memberships[0].organization;
  assert.equal(
    organization.id,
    organizationId,
    "Onboarding must update the authenticated brand organization",
  );
  assert.equal(
    organization.name,
    profile.organizationName,
    "Company name must persist",
  );
  assert.equal(
    organization.countryCode,
    profile.countryCode,
    "Company country must persist",
  );
  assert.equal(
    organization.type,
    "BRAND",
    "Onboarding must preserve brand type",
  );
  assert.equal(
    organization.status,
    "PENDING",
    "Profile completion must not approve the organization",
  );
  assert.equal(
    user.emailVerified,
    false,
    "Profile completion must not mark the email verified",
  );
  assert.equal(
    user.memberships[0].role,
    "OWNER",
    "Profile completion must preserve membership role",
  );
  for (const key of [
    "industry",
    "companySize",
    "contactName",
    "phoneDialCode",
    "phoneNumber",
    "note",
  ]) {
    assert.equal(
      organization.metadata[key],
      profile[key],
      "Brand profile field must persist",
    );
  }
  assert.deepEqual(
    organization.metadata.interests,
    profile.interests,
    "Brand interests must persist",
  );
  assert.ok(
    typeof organization.metadata.profileCompletedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(organization.metadata.profileCompletedAt) &&
      Number.isFinite(Date.parse(organization.metadata.profileCompletedAt)),
    "Profile completion must have an ISO timestamp",
  );
}

try {
  await check("auth health and anonymous account protection", async () => {
    await db.$queryRaw`SELECT 1`;
    const health = await request("/api/auth/ok");
    assert.equal(health.response.status, 200, "Auth health must return 200");
    assert.equal(health.json?.ok, true, "Auth health must be ready");
    const account = await request("/account?lang=en");
    assert.ok(
      [303, 307, 308].includes(account.response.status),
      "Anonymous account page must redirect",
    );
    assert.equal(
      new URL(account.response.headers.get("location"), baseUrl).pathname,
      "/login",
      "Anonymous account page must redirect to login",
    );
    const continuation = await request("/auth/continue?lang=ko");
    assertRedirect(
      continuation,
      "/login",
      "Anonymous post-auth routing must require a session",
    );
    assert.equal(
      new URL(
        continuation.response.headers.get("location"),
        baseUrl,
      ).searchParams.get("lang"),
      "ko",
      "Post-auth routing must preserve the chosen language",
    );
    await assertStorageAccess(undefined, "/login");
  });

  await check(
    "brand onboarding page and API require authentication",
    async () => {
      const page = await request("/onboarding/brand?lang=en");
      assertRedirect(
        page,
        "/login",
        "Anonymous onboarding must redirect to login",
      );
      const result = await request("/api/account/brand-profile", {
        body: profileFor({
          organizationName: `${namePrefix} unauthorized-profile`,
        }),
      });
      assert.equal(
        result.response.status,
        401,
        "Anonymous brand profile updates must be unauthorized",
      );
      assert.equal(
        result.json?.code,
        "UNAUTHORIZED",
        "Anonymous profile updates must use their stable error code",
      );
    },
  );

  // A previous test/browser session may still occupy the same IP bucket.
  // Read only the timestamp (not IP keys), and let its normal expiry elapse.
  const previousWindow = await db.rateLimit.findFirst({
    where: {
      OR: [
        { key: { endsWith: "|/sign-up/organization" } },
        { key: { endsWith: "|/sign-in/email" } },
      ],
    },
    orderBy: { lastRequest: "desc" },
    select: { lastRequest: true },
  });
  if (previousWindow) {
    const remaining = Math.max(
      0,
      60_500 - (Date.now() - Number(previousWindow.lastRequest)),
    );
    if (remaining) {
      console.log(
        "WAIT previous auth endpoint cooldown (no database counter reset)",
      );
      await cooldown(remaining);
    }
  }

  await check(
    "cross-origin first signup is rejected without a cookie",
    async () => {
      const input = fixture("cross-origin");
      const result = await request("/api/auth/sign-up/organization", {
        body: input,
        origin: "https://untrusted.example.invalid",
      });
      assert.equal(
        result.response.status,
        403,
        "Cross-origin signup must be forbidden",
      );
      assert.equal(
        await readFixture(input.email),
        null,
        "Cross-origin signup must not create a user",
      );
    },
  );

  const agency = fixture("agency");
  const studio = fixture("studio", { agencyType: "studio", locale: "ko" });
  const brand = fixture("brand", {
    role: "brand",
    agencyType: "",
    companySize: "15–49",
    locale: "zh",
  });
  for (const [label, input] of [
    ["agency", agency],
    ["studio", studio],
    ["brand", brand],
  ]) {
    await check(
      `${label} signup persists hashed credentials and a pending owner organization`,
      async () => {
        const result = await request("/api/auth/sign-up/organization", {
          body: { ...input, email: `  ${input.email.toUpperCase()}  ` },
        });
        assert.equal(
          result.response.status,
          200,
          "Organization signup must succeed",
        );
        assert.equal(result.json?.success, true, "Signup must report success");
        const user = await readFixture(input.email);
        assert.ok(
          user,
          "New account must exist in this database (check server/DB environment pairing)",
        );
        assert.equal(user.email, input.email, "Email must be normalized");
        assert.equal(
          user.emailVerified,
          false,
          "Unverified email must not be marked verified",
        );
        assert.equal(
          user.locale,
          input.locale.toUpperCase(),
          "Locale must persist",
        );
        assert.equal(
          user.accounts.length,
          1,
          "Exactly one credential account must exist",
        );
        assert.equal(
          user.accounts[0].providerId,
          "credential",
          "Account must use the credential provider",
        );
        assert.equal(
          user.accounts[0].accountId,
          user.id,
          "Credential account must belong to the user",
        );
        assert.ok(
          user.accounts[0].password && user.accounts[0].password !== password,
          "Password must never be stored in plain text",
        );
        assert.equal(
          await verifyPassword({ hash: user.accounts[0].password, password }),
          true,
          "Stored hash must verify with Better Auth",
        );
        assert.equal(
          user.memberships.length,
          1,
          "Signup must create exactly one organization membership",
        );
        const membership = user.memberships[0];
        assert.equal(
          membership.role,
          "OWNER",
          "Registrant must own the organization",
        );
        assert.equal(
          membership.organization.status,
          "PENDING",
          "New organization must await approval",
        );
        assert.equal(
          membership.organization.name,
          input.organizationName,
          "Organization name must persist",
        );
        assert.equal(
          membership.organization.type,
          input.role === "brand" ? "BRAND" : "AGENCY",
          "Organization role must persist",
        );
        assert.equal(
          membership.organization.metadata[
            input.role === "brand" ? "companySize" : "agencyType"
          ],
          input.role === "brand" ? input.companySize : input.agencyType,
          "Role-specific profile must persist",
        );
      },
    );
  }

  await check(
    "duplicate email is rejected without orphan organization creation",
    async () => {
      const duplicate = {
        ...agency,
        organizationName: `${namePrefix} duplicate`,
      };
      fixtureNames.add(duplicate.organizationName);
      const result = await request("/api/auth/sign-up/organization", {
        body: duplicate,
      });
      assert.equal(
        result.response.status,
        409,
        "Duplicate signup must return conflict",
      );
      assert.equal(
        result.json?.code,
        "USER_ALREADY_EXISTS",
        "Duplicate signup must use its stable error code",
      );
      assert.equal(
        await db.user.count({ where: { email: agency.email } }),
        1,
        "Duplicate signup must not duplicate the user",
      );
      assert.equal(
        await db.organization.count({
          where: { name: duplicate.organizationName },
        }),
        0,
        "Failed signup must not leave an organization",
      );
    },
  );

  await check(
    "creator role and direct generic signup are blocked",
    async () => {
      const creator = fixture("creator", { role: "creator" });
      const invalid = await request("/api/auth/sign-up/organization", {
        body: creator,
      });
      assert.equal(
        invalid.response.status,
        400,
        "Creator signup must fail validation",
      );
      assert.equal(
        invalid.json?.code,
        "INVALID_REGISTRATION",
        "Invalid signup must use its stable error code",
      );
      assert.equal(
        await readFixture(creator.email),
        null,
        "Creator signup must not create a user",
      );
      const generic = fixture("generic");
      const disabled = await request("/api/auth/sign-up/email", {
        body: {
          name: generic.organizationName,
          email: generic.email,
          password,
        },
      });
      assert.equal(
        disabled.response.status,
        404,
        "Generic signup must be disabled",
      );
      assert.equal(
        await readFixture(generic.email),
        null,
        "Generic signup must not create a user",
      );
    },
  );

  const missingCompanySize = fixture("brand-missing-size", {
    role: "brand",
    agencyType: "",
  });
  const shortPassword = fixture("short-password", { password: "Short7!" });
  const forgedPrivileges = fixture("forged-privileges", {
    status: "ACTIVE",
    membershipRole: "ADMIN",
    organizationType: "PLATFORM",
  });
  for (const [label, input] of [
    ["brand company size is required by the server", missingCompanySize],
    [
      "password shorter than eight characters is rejected by the server",
      shortPassword,
    ],
    [
      "forged approval and membership fields cannot escalate privileges",
      forgedPrivileges,
    ],
  ]) {
    await check(label, async () => {
      const result = await request("/api/auth/sign-up/organization", {
        body: input,
      });
      assert.equal(
        result.response.status,
        400,
        "Invalid registration must be rejected",
      );
      assert.equal(
        result.json?.code,
        "INVALID_REGISTRATION",
        "Invalid registration must use its stable error code",
      );
      assert.equal(
        await readFixture(input.email),
        null,
        "Rejected signup must not create an account",
      );
      assert.equal(
        await db.organization.count({
          where: { name: input.organizationName },
        }),
        0,
        "Rejected signup must not create an organization",
      );
    });
  }

  await check("wrong password does not authenticate", async () => {
    const result = await request("/api/auth/sign-in/email", {
      body: { email: agency.email, password: `${password}-wrong` },
    });
    assert.equal(
      result.response.status,
      401,
      "Wrong password must be rejected",
    );
    assert.ok(
      !result.response.headers
        .getSetCookie()
        .some((value) => /session_token=[^;]/.test(value)),
      "Failed login must not issue a session",
    );
    assert.equal(
      (await readFixture(agency.email)).sessions.length,
      0,
      "Failed login must not store a session",
    );
  });

  for (const [label, input] of [
    ["agency", agency],
    ["studio", studio],
    ["brand", brand],
  ]) {
    await check(
      `${label} login, persistent session, account page, logout, and revoked cookie`,
      async () => {
        const cookie = await signIn(input.email);
        const session = await request("/api/auth/get-session", { cookie });
        assert.equal(
          session.response.status,
          200,
          "Session lookup must succeed",
        );
        assert.equal(
          session.json?.user?.email,
          input.email,
          "Session must authenticate the expected user",
        );
        const stored = await readFixture(input.email);
        assert.equal(
          stored.sessions.length,
          1,
          "Login session must be stored in the database",
        );
        assert.equal(
          stored.sessions[0].id,
          session.json?.session?.id,
          "API session must match the database",
        );
        assert.ok(
          stored.sessions[0].expiresAt > new Date(),
          "Session must have a future expiration",
        );
        const repeated = await request("/api/auth/get-session", { cookie });
        assert.equal(
          repeated.json?.session?.id,
          session.json?.session?.id,
          "Session must survive a new request",
        );
        if (input.role === "agency") {
          const continuation = await request("/auth/continue?lang=en", {
            cookie,
          });
          assertRedirect(
            continuation,
            "/account",
            "Agency and studio logins must keep their account destination",
          );
          await assertStorageAccess(cookie, "/account");
          const deniedProfile = await request("/api/account/brand-profile", {
            body: profileFor(input),
            cookie,
          });
          assert.equal(
            deniedProfile.response.status,
            403,
            "Agency and studio accounts cannot update a brand profile",
          );
          assert.equal(
            deniedProfile.json?.code,
            "FORBIDDEN",
            "Non-brand profile requests must use their stable error code",
          );
          const agencyAfter = await readFixture(input.email);
          assert.equal(
            agencyAfter.memberships[0].organization.metadata.profileCompletedAt,
            undefined,
            "Forbidden profile updates must not modify the agency",
          );
        } else {
          const continuation = await request("/auth/continue?lang=en", {
            cookie,
          });
          assertRedirect(
            continuation,
            "/onboarding/brand",
            "An incomplete brand login must enter company onboarding",
          );
          await assertStorageAccess(cookie, "/onboarding/brand");
          const initialAccount = await request("/account?lang=en", { cookie });
          assertRedirect(
            initialAccount,
            "/onboarding/brand",
            "An incomplete brand account must enter onboarding",
          );
          const onboarding = await request("/onboarding/brand?lang=en", {
            cookie,
          });
          assert.equal(
            onboarding.response.status,
            200,
            "Authenticated incomplete brand onboarding must be accessible",
          );
          const profile = profileFor(input);
          for (const badProfile of [
            { ...profile, interests: [] },
            { ...profile, countryCode: "INVALID" },
            {
              ...profile,
              organizationId: stored.memberships[0].organization.id,
              userId: stored.id,
              status: "ACTIVE",
              emailVerified: true,
            },
          ]) {
            const invalid = await request("/api/account/brand-profile", {
              body: badProfile,
              cookie,
            });
            assert.equal(
              invalid.response.status,
              400,
              "Invalid fields or client-selected identity/privileges must be rejected",
            );
            assert.equal(
              invalid.json?.code,
              "INVALID_BRAND_PROFILE",
              "Invalid brand profiles must use their stable error code",
            );
          }
          for (const origin of ["https://untrusted.example.invalid", null]) {
            const forbidden = await request("/api/account/brand-profile", {
              body: profile,
              cookie,
              origin,
            });
            assert.equal(
              forbidden.response.status,
              403,
              "Foreign or missing origin must not update brand profiles",
            );
            assert.equal(
              forbidden.json?.code,
              "INVALID_ORIGIN",
              "Rejected origins must use their stable error code",
            );
          }
          const untouched = await readFixture(input.email);
          assert.equal(
            untouched.memberships[0].organization.metadata.profileCompletedAt,
            undefined,
            "Rejected profile requests must not complete onboarding",
          );
          assert.deepEqual(
            untouched.memberships[0].organization.metadata,
            stored.memberships[0].organization.metadata,
            "Rejected profile requests must not change existing metadata",
          );
          assert.equal(
            untouched.memberships[0].organization.countryCode,
            stored.memberships[0].organization.countryCode,
            "Rejected profile requests must not change the country",
          );
          const saved = await request("/api/account/brand-profile", {
            body: profile,
            cookie,
          });
          assert.equal(
            saved.response.status,
            200,
            "A valid brand profile must save",
          );
          assert.equal(
            saved.json?.success,
            true,
            "Profile save must report success",
          );
          await assertStoredBrandProfile(
            input.email,
            profile,
            stored.memberships[0].organization.id,
          );
          console.log(
            "PASS brand first-visit onboarding, field validation, authorization, origin protection, and actual DB persistence",
          );
          const completed = await request("/auth/continue?lang=en", { cookie });
          assertRedirect(
            completed,
            "/storage/search",
            "Completed brand login must enter the creator workspace",
          );
          const completedOnboarding = await request(
            "/onboarding/brand?lang=en",
            {
              cookie,
            },
          );
          assertRedirect(
            completedOnboarding,
            "/storage/search",
            "Completed brands must not repeat onboarding",
          );
          await assertStorageAccess(cookie);
        }
        const account = await request("/account?lang=en", { cookie });
        assert.equal(
          account.response.status,
          200,
          "Authenticated account page must be accessible",
        );
        assert.ok(
          account.text.includes(input.organizationName),
          "Account page must show the stored organization",
        );
        assert.ok(
          account.text.includes(input.email),
          "Account page must show the stored account",
        );
        const signedOut = await request("/api/auth/sign-out", {
          body: {},
          cookie,
        });
        assert.equal(signedOut.response.status, 200, "Logout must succeed");
        assert.equal(
          (await readFixture(input.email)).sessions.length,
          0,
          "Logout must delete the stored session",
        );
        const replay = await request("/api/auth/get-session", { cookie });
        assert.equal(
          replay.json,
          null,
          "Old session cookie must not authenticate after logout",
        );
        const protectedPage = await request("/account?lang=en", { cookie });
        assert.ok(
          [303, 307, 308].includes(protectedPage.response.status),
          "Revoked cookie must not access the account page",
        );
        await assertStorageAccess(cookie, "/login");
      },
    );
  }

  await check(
    "completed brand profile survives logout and a new login",
    async () => {
      const cookie = await signIn(brand.email);
      const account = await request("/account?lang=en", { cookie });
      assert.equal(
        account.response.status,
        200,
        "Completed brand must reach the account page after re-login",
      );
      const continuation = await request("/auth/continue?lang=zh", { cookie });
      assertRedirect(
        continuation,
        "/storage/search",
        "A returning brand must be routed to creator search",
      );
      assert.equal(
        new URL(
          continuation.response.headers.get("location"),
          baseUrl,
        ).searchParams.get("lang"),
        "zh",
        "Brand workspace routing must preserve the chosen language",
      );
      await assertStorageAccess(cookie);
      const user = await readFixture(brand.email);
      await assertStoredBrandProfile(
        brand.email,
        profileFor(brand),
        user.memberships[0].organization.id,
      );
      const result = await request("/api/auth/sign-out", { body: {}, cookie });
      assert.equal(
        result.response.status,
        200,
        "Brand re-login session must log out",
      );
      assert.equal(
        (await readFixture(brand.email)).sessions.length,
        0,
        "Brand re-login session must be revoked",
      );
    },
  );

  await check(
    "brand workspace enforces approval state and non-owner onboarding boundaries",
    async () => {
      const cookie = await signIn(brand.email);
      const user = await readFixture(brand.email);
      const organization = user.memberships[0].organization;
      assert.ok(
        organization.name.startsWith(`${namePrefix} `),
        "State tests may update only their own disposable organization",
      );
      const memberKey = {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      };

      await db.organization.update({
        where: { id: organization.id },
        data: { status: "ACTIVE" },
      });
      await assertStorageAccess(cookie);

      await db.$transaction([
        db.organizationMember.update({
          where: memberKey,
          data: { role: "MEMBER" },
        }),
        db.organization.update({
          where: { id: organization.id },
          data: { metadata: { companySize: "15–49" } },
        }),
      ]);
      await assertStorageAccess(cookie, "/account");
      for (const path of ["/auth/continue", "/onboarding/brand"]) {
        assertRedirect(
          await request(`${path}?lang=en`, { cookie }),
          "/account",
          "A non-owner cannot be trapped in owner-only onboarding",
        );
      }
      const nonOwnerProfile = await request("/api/account/brand-profile", {
        body: profileFor(brand),
        cookie,
      });
      assert.equal(
        nonOwnerProfile.response.status,
        403,
        "Non-owners cannot save company profiles",
      );
      await db.organization.update({
        where: { id: organization.id },
        data: { metadata: organization.metadata },
      });
      await assertStorageAccess(cookie);

      await db.$transaction([
        db.organizationMember.update({
          where: memberKey,
          data: { role: "OWNER" },
        }),
        db.organization.update({
          where: { id: organization.id },
          data: { status: "SUSPENDED", metadata: { companySize: "15–49" } },
        }),
      ]);
      await assertStorageAccess(cookie, "/account");
      for (const path of ["/auth/continue", "/onboarding/brand"]) {
        assertRedirect(
          await request(`${path}?lang=en`, { cookie }),
          "/account",
          "Suspended brands must not enter onboarding or search",
        );
      }
      const suspendedAccount = await request("/account?lang=en", { cookie });
      assert.equal(
        suspendedAccount.response.status,
        200,
        "Suspended brands must still see account status without a redirect loop",
      );
      assert.ok(
        suspendedAccount.text.includes("Suspended"),
        "The account must show its suspended status",
      );
      const suspendedProfile = await request("/api/account/brand-profile", {
        body: profileFor(brand),
        cookie,
      });
      assert.equal(
        suspendedProfile.response.status,
        403,
        "Suspended owners cannot change company profiles",
      );
      const afterRejected = await readFixture(brand.email);
      assert.equal(
        afterRejected.memberships[0].organization.status,
        "SUSPENDED",
        "Rejected profile updates must not reactivate a brand",
      );
      assert.deepEqual(
        afterRejected.memberships[0].organization.metadata,
        { companySize: "15–49" },
        "Rejected profile updates must not change metadata",
      );
      assert.equal(
        afterRejected.emailVerified,
        false,
        "Search access must never verify email ownership",
      );

      await db.organization.update({
        where: { id: organization.id },
        data: { status: "PENDING", metadata: organization.metadata },
      });
      const logout = await request("/api/auth/sign-out", { body: {}, cookie });
      assert.equal(
        logout.response.status,
        200,
        "The state-test session must log out",
      );
      await assertStorageAccess(cookie, "/login");
    },
  );

  await check(
    "rapid login attempts are limited and the counter persists in the DB",
    async () => {
      const missing = fixture("rate-limit-missing-account");
      const startedAt = BigInt(Date.now());
      let rejectedByLimiter = 0;
      let rejectedCredentials = 0;
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const result = await request("/api/auth/sign-in/email", {
          body: { email: missing.email, password },
          pace: false,
        });
        assert.ok(
          [401, 429].includes(result.response.status),
          "Every invalid login must fail or be rate limited",
        );
        if (result.response.status === 401) rejectedCredentials += 1;
        if (result.response.status === 429) {
          rejectedByLimiter += 1;
          assert.ok(
            Number(result.response.headers.get("x-retry-after")) > 0,
            "Rate limiting must communicate a retry delay",
          );
        }
      }
      assert.ok(
        rejectedCredentials > 0,
        "The limiter test must include an actual rejected credential check",
      );
      assert.ok(
        rejectedByLimiter > 0,
        "Eleven rapid login attempts must reach the ten-request limit",
      );
      const persistedCounter = await db.rateLimit.findFirst({
        where: {
          key: { endsWith: "|/sign-in/email" },
          count: { gte: 10 },
          lastRequest: { gte: startedAt },
        },
        select: { count: true, lastRequest: true },
      });
      assert.ok(
        persistedCounter,
        "The signin rate-limit counter must be persisted in the actual DB",
      );
      assert.equal(
        await readFixture(missing.email),
        null,
        "Rate-limit probes must not create an account",
      );
      console.log(
        "NOTE signin protection remains active for this client IP until its normal 60-second cooldown expires",
      );
    },
  );

  console.log("PASS all real-database auth checks");
} catch (error) {
  failed = true;
  // Never print response bodies, passwords, connection strings, cookies, or
  // adapter exceptions, which can contain sensitive information.
  const detail =
    error instanceof assert.AssertionError
      ? error.message.split("\n", 1)[0]
      : "unexpected network/database/runtime failure (details withheld)";
  console.error(`FAIL ${currentStep}: ${detail}`);
} finally {
  try {
    // Unique synthetic emails and names identify only this run's records.
    // The final deletes use exact IDs, never table-wide cleanup.
    const users = await db.user.findMany({
      where: { email: { in: [...fixtureEmails] } },
      select: {
        id: true,
        memberships: {
          select: { organization: { select: { id: true, name: true } } },
        },
      },
    });
    const ownedOrganizationIds = users.flatMap((user) =>
      user.memberships.map(({ organization }) => {
        assert.ok(
          organization.name.startsWith(`${namePrefix} `),
          "Refusing to delete an organization outside this test run",
        );
        return organization.id;
      }),
    );
    // Also clean potential orphans from unsuccessful requests, but only the
    // exact unique fixture names from this run, never a broad name prefix.
    const orphan = await db.organization.findMany({
      where: { name: { in: [...fixtureNames] } },
      select: { id: true },
    });
    const organizationIds = [
      ...new Set([...ownedOrganizationIds, ...orphan.map(({ id }) => id)]),
    ];
    await db.$transaction([
      db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } }),
      db.organization.deleteMany({ where: { id: { in: organizationIds } } }),
    ]);
    console.log(
      `CLEANUP removed ${users.length} synthetic account(s) and ${organizationIds.length} test organization(s)`,
    );
  } catch {
    failed = true;
    console.error(
      `CLEANUP FAILED: inspect only records named ${namePrefix} and their matching synthetic accounts`,
    );
  } finally {
    await db.$disconnect();
  }
}

if (failed) process.exitCode = 1;
