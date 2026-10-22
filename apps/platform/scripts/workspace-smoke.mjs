import assert from "node:assert/strict";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import { defaultFilters } from "../lib/creator-directory.ts";

// Explicitly scoped synthetic fixtures only. This script never reads or changes
// an existing user's password, profile, approval state, or organization data.
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
  "--base-url must be an HTTP(S) origin",
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
assert.ok(
  !loaded.error && process.env.DATABASE_URL && process.env.BETTER_AUTH_URL,
  "Load the server's ignored environment file first",
);
assert.equal(
  new URL(process.env.BETTER_AUTH_URL).origin,
  baseUrl.origin,
  "BETTER_AUTH_URL must match --base-url",
);

const db = createDatabaseClient();
const runId = `${Date.now()}-${randomBytes(6).toString("hex")}`;
const prefix = `workspace-qa-${runId}`;
const password = `Qa-${randomBytes(24).toString("base64url")}!`;
const userIds = new Set();
const orgIds = new Set();
const entryIds = new Set();
let currentStep = "preflight";
let failed = false;
let checks = 0;

async function request(
  path,
  { method, body, cookie, origin = baseUrl.origin } = {},
) {
  const response = await globalThis.fetch(new URL(path, baseUrl), {
    method: method ?? (body === undefined ? "GET" : "POST"),
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
  const raw = await response.text();
  const json = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? JSON.parse(raw)
    : null;
  return { response, json, raw };
}

async function check(label, fn) {
  currentStep = label;
  await fn();
  checks += 1;
  console.log(`PASS ${label}`);
}
function status(result, expected, message) {
  assert.equal(result.response.status, expected, message);
}
async function mutate(path, cookie, body, expected = 200) {
  const result = await request(`/api/workspace/${path}`, { cookie, body });
  status(result, expected, `${path} must return the expected status`);
  return result;
}
async function bootstrap(cookie) {
  const result = await request("/api/workspace/bootstrap", { cookie });
  status(result, 200, "Authorized workspace bootstrap must succeed");
  assert.match(
    result.response.headers.get("cache-control") ?? "",
    /no-store/,
    "Private data must not be cached",
  );
  return result.json;
}
async function fixture(
  label,
  {
    organizationId,
    role = "OWNER",
    status: orgStatus = "PENDING",
    completed = true,
    type = "BRAND",
  } = {},
) {
  const id = `${prefix}-${label}`;
  const email = `${id}@example.invalid`;
  const orgId = organizationId ?? `${id}-org`;
  userIds.add(id);
  if (!organizationId) orgIds.add(orgId);
  const hashed = await hashPassword(password);
  await db.$transaction(async (tx) => {
    if (!organizationId)
      await tx.organization.create({
        data: {
          id: orgId,
          name: `Workspace QA ${runId} ${label}`,
          slug: orgId,
          type,
          status: orgStatus,
          countryCode: "KR",
          metadata: {
            industry: "gaming",
            companySize: "15–49",
            contactName: "QA Contact",
            ...(completed
              ? { profileCompletedAt: new Date().toISOString() }
              : {}),
          },
        },
      });
    await tx.user.create({
      data: {
        id,
        email,
        name: "Workspace QA",
        locale: "EN",
        emailVerified: false,
        accounts: {
          create: { providerId: "credential", accountId: id, password: hashed },
        },
        memberships: { create: { organizationId: orgId, role } },
      },
    });
  });
  let login = await request("/api/auth/sign-in/email", {
    body: { email, password },
  });
  if (login.response.status === 429) {
    console.log("WAIT normal sign-in cooldown (no limiter bypass)");
    await delay(30_500);
    await delay(30_500);
    login = await request("/api/auth/sign-in/email", {
      body: { email, password },
    });
  }
  status(login, 200, "Synthetic fixture sign-in must succeed");
  const cookies = login.response.headers.getSetCookie();
  assert.ok(
    cookies.some((cookie) => cookie.split("=", 1)[0].endsWith("session_token")),
    "A real session must be issued",
  );
  return {
    userId: id,
    orgId,
    cookie: cookies.map((cookie) => cookie.split(";", 1)[0]).join("; "),
  };
}

try {
  let owner, outsider, member, incomplete, agency;
  let creator, folder, shortLink, campaign;
  await check("anonymous workspace access is rejected", async () => {
    status(
      await request("/api/workspace/bootstrap"),
      401,
      "Anonymous bootstrap must be rejected",
    );
    status(
      await request("/api/workspace/collections", {
        body: { action: "create", name: "Not saved" },
      }),
      401,
      "Anonymous write must be rejected",
    );
  });
  await check("isolated real-DB fixtures authenticate", async () => {
    owner = await fixture("owner");
    outsider = await fixture("outsider", { status: "ACTIVE" });
    member = await fixture("member", {
      organizationId: owner.orgId,
      role: "MEMBER",
    });
    incomplete = await fixture("incomplete", { completed: false });
    agency = await fixture("agency", { type: "AGENCY", status: "ACTIVE" });
  });
  await check("pending brands see published demo entries only", async () => {
    const data = await bootstrap(owner.cookie);
    assert.ok(
      data.creators.length > 0,
      "Seed the fictional directory before running this suite",
    );
    creator = data.creators.find((entry) => entry.platform === "youtube");
    assert.ok(creator, "Seeded YouTube sample must exist");
    const entries = await db.creatorDirectoryEntry.findMany({
      where: { id: { in: data.creators.map((entry) => entry.id) } },
      select: { id: true, isDemo: true, isPublished: true },
    });
    assert.equal(
      entries.length,
      data.creators.length,
      "Every returned profile must be stored in the DB",
    );
    assert.ok(
      entries.every((entry) => entry.isDemo && entry.isPublished),
      "Pending brands must only see published demo profiles",
    );
    assert.equal(
      data.account.status,
      "PENDING",
      "Reading the directory must not approve an organization",
    );
    assert.ok(
      !JSON.stringify(data).includes("internalNotes"),
      "Internal notes must never be serialized",
    );
  });
  await check(
    "private agency profiles and unpublished directory entries never leak",
    async () => {
      const privateId = `${prefix}-private`;
      entryIds.add(privateId);
      await db.creatorProfile.create({
        data: {
          agencyOrganizationId: agency.orgId,
          displayName: `${prefix}-private-name`,
          internalNotes: `${prefix}-confidential`,
        },
      });
      await db.creatorDirectoryEntry.create({
        data: {
          id: privateId,
          platform: creator.platform,
          isDemo: false,
          isPublished: false,
          payload: { ...creator, id: privateId, name: `${prefix}-hidden` },
        },
      });
      for (const cookie of [owner.cookie, outsider.cookie]) {
        const data = await bootstrap(cookie);
        assert.ok(
          !data.creators.some((entry) => entry.id === privateId),
          "Unpublished entries must stay hidden even for approved brands",
        );
        assert.ok(
          !JSON.stringify(data).includes(`${prefix}-confidential`),
          "Agency internal notes must stay private",
        );
        assert.ok(
          !JSON.stringify(data).includes(`${prefix}-private-name`),
          "Agency profiles must not be auto-published",
        );
      }
    },
  );
  await check(
    "incomplete and agency accounts cannot access brand APIs",
    async () => {
      status(
        await request("/api/workspace/bootstrap", {
          cookie: incomplete.cookie,
        }),
        403,
        "Incomplete profile must be blocked",
      );
      status(
        await request("/api/workspace/bootstrap", { cookie: agency.cookie }),
        403,
        "Agency must not enter the brand API",
      );
    },
  );
  await check(
    "search filters execute against DB entries and persist history",
    async () => {
      const filters = {
        ...defaultFilters("youtube"),
        country: creator.country,
        followersMin: String(creator.followers / 1000),
        followersMax: String(creator.followers / 1000),
      };
      const result = await mutate("search", owner.cookie, {
        mode: "search",
        filters,
      });
      assert.ok(
        result.json.creators.some((entry) => entry.id === creator.id),
        "Matching stored creator must appear",
      );
      assert.ok(
        result.json.creators.every(
          (entry) =>
            entry.platform === "youtube" &&
            entry.country === creator.country &&
            entry.followers === creator.followers,
        ),
        "Country and exact K-range must filter results",
      );
      const saved = await db.directorySearch.findUnique({
        where: { id: result.json.searchId },
      });
      assert.equal(
        saved.organizationId,
        owner.orgId,
        "Search history must be tenant scoped",
      );
      assert.equal(
        saved.userId,
        owner.userId,
        "Search history must be user scoped",
      );
      assert.deepEqual(
        saved.resultIdsJson,
        result.json.creators.map((entry) => entry.id),
        "Search result IDs must persist",
      );
    },
  );
  await check(
    "similar creator search resolves only a known stored seed",
    async () => {
      const filters = {
        ...defaultFilters("youtube"),
        query: creator.profileUrl,
      };
      const result = await mutate("search", owner.cookie, {
        mode: "similar",
        filters,
      });
      assert.equal(
        result.json.seed?.id,
        creator.id,
        "Known example URL must resolve the seed",
      );
      assert.ok(
        result.json.creators.every(
          (entry) => entry.id !== creator.id && entry.platform === "youtube",
        ),
        "Similar results exclude the seed and other platforms",
      );
      const unknown = await mutate("search", owner.cookie, {
        mode: "similar",
        filters: { ...filters, query: "https://example.com/not-in-directory" },
      });
      assert.equal(
        unknown.json.seed,
        null,
        "Unknown external URL must not fabricate a creator",
      );
      assert.equal(
        unknown.json.creators.length,
        0,
        "Unknown URL must not fabricate results",
      );
    },
  );
  await check("brand recommendations and search validation work", async () => {
    const result = await mutate("search", owner.cookie, {
      mode: "brands",
      brandId: "lumen-quest",
      publishingPlatform: "mobile",
      filters: defaultFilters("youtube"),
    });
    assert.ok(
      result.json.brands.some((brand) => brand.id === "lumen-quest"),
      "Requested demo brand must be represented",
    );
    assert.ok(
      result.json.creators.length > 0,
      "Known demo brand must yield matching stored creators",
    );
    await mutate(
      "search",
      owner.cookie,
      {
        mode: "search",
        filters: {
          ...defaultFilters("youtube"),
          followersMin: "50",
          followersMax: "10",
        },
      },
      400,
    );
    await mutate(
      "search",
      owner.cookie,
      { mode: "similar", filters: defaultFilters("instagram") },
      400,
    );
    await mutate(
      "search",
      owner.cookie,
      {
        mode: "brands",
        brandId: "lumen-quest",
        filters: defaultFilters("tiktok"),
      },
      400,
    );
    const mine = await bootstrap(owner.cookie),
      other = await bootstrap(outsider.cookie);
    assert.ok(
      mine.recentSearches.length >= 4,
      "Search history must survive bootstrap reload",
    );
    assert.equal(
      other.recentSearches.length,
      0,
      "Other tenant must not see the search history",
    );
  });
  await check("collections create, add idempotently and persist", async () => {
    await mutate("collections", owner.cookie, {
      action: "create",
      name: "QA shortlist",
    });
    folder = (await bootstrap(owner.cookie)).collections.find(
      (item) => item.name === "QA shortlist",
    );
    assert.ok(folder, "Created folder must survive reload");
    await mutate("collections", owner.cookie, {
      action: "add",
      collectionId: folder.id,
      creatorId: creator.id,
    });
    await mutate("collections", owner.cookie, {
      action: "add",
      collectionId: folder.id,
      creatorId: creator.id,
    });
    const stored = (await bootstrap(owner.cookie)).collections.find(
      (item) => item.id === folder.id,
    );
    assert.deepEqual(
      stored.creatorIds,
      [creator.id],
      "Duplicate saves must not duplicate items",
    );
  });
  await check(
    "collection tenant isolation and removal are enforced",
    async () => {
      await mutate(
        "collections",
        outsider.cookie,
        { action: "remove", collectionId: folder.id, creatorId: creator.id },
        404,
      );
      assert.equal(
        (await bootstrap(outsider.cookie)).collections.length,
        0,
        "Other tenant must not see collections",
      );
      await mutate(
        "collections",
        owner.cookie,
        {
          action: "add",
          collectionId: folder.id,
          creatorId: `${prefix}-private`,
        },
        404,
      );
      await mutate("collections", owner.cookie, {
        action: "remove",
        collectionId: folder.id,
        creatorId: creator.id,
      });
      assert.equal(
        (await bootstrap(owner.cookie)).collections.find(
          (item) => item.id === folder.id,
        ).creatorIds.length,
        0,
        "Removal must persist",
      );
    },
  );
  await check(
    "short links persist and reject unsafe destinations",
    async () => {
      await mutate("links", owner.cookie, {
        action: "create",
        title: "QA link",
        targetUrl: "https://example.com/campaign?utm_source=qa",
      });
      shortLink = (await bootstrap(owner.cookie)).links[0];
      assert.ok(
        shortLink?.active && shortLink.clickCount === 0,
        "New link must start active at zero requests",
      );
      for (const url of [
        "http://example.com",
        "javascript:alert(1)",
        "https://127.0.0.1/path",
        "https://[::1]/",
        "https://user:password@example.com",
        "https://localhost/",
        `${baseUrl.origin}/s/recursive`,
      ]) {
        await mutate(
          "links",
          owner.cookie,
          { action: "create", title: "Unsafe not saved", targetUrl: url },
          400,
        );
      }
      assert.equal(
        (await bootstrap(owner.cookie)).links.length,
        1,
        "Invalid destinations must not create rows",
      );
    },
  );
  await check(
    "public redirect counts GET but not HEAD and respects pause",
    async () => {
      const head = await request(`/s/${shortLink.code}`, {
        method: "HEAD",
        origin: null,
      });
      status(head, 302, "HEAD must resolve without counting");
      assert.equal(
        (await db.shortLink.findUnique({ where: { id: shortLink.id } }))
          .clickCount,
        0,
        "HEAD must not increment requests",
      );
      const result = await request(`/s/${shortLink.code}`, { origin: null });
      status(result, 302, "Valid active link must redirect");
      assert.equal(
        result.response.headers.get("location"),
        "https://example.com/campaign?utm_source=qa",
        "Redirect must retain the validated target",
      );
      assert.equal(
        (await db.shortLink.findUnique({ where: { id: shortLink.id } }))
          .clickCount,
        1,
        "GET must increment requests once",
      );
      await mutate(
        "links",
        outsider.cookie,
        { action: "toggle", id: shortLink.id, active: false },
        404,
      );
      await mutate("links", owner.cookie, {
        action: "toggle",
        id: shortLink.id,
        active: false,
      });
      status(
        await request(`/s/${shortLink.code}`, { origin: null }),
        404,
        "Paused link must not redirect",
      );
      assert.equal(
        (await db.shortLink.findUnique({ where: { id: shortLink.id } }))
          .clickCount,
        1,
        "Paused link must not count",
      );
      await mutate("links", owner.cookie, {
        action: "toggle",
        id: shortLink.id,
        active: true,
      });
    },
  );
  await check(
    "campaign draft preserves exact decimals and pending submission is blocked",
    async () => {
      await mutate("campaigns", owner.cookie, {
        action: "create",
        title: "QA campaign",
        summary: "Synthetic test brief",
        platforms: ["youtube", "tiktok"],
        currency: "USD",
        budgetAmount: "12345.67",
      });
      campaign = (await bootstrap(owner.cookie)).campaigns[0];
      assert.equal(
        campaign.budgetAmount,
        "12345.67",
        "Budget must preserve decimal precision",
      );
      assert.equal(
        campaign.status,
        "DRAFT",
        "Creation must never auto-publish",
      );
      await mutate(
        "campaigns",
        owner.cookie,
        { action: "submit", id: campaign.id },
        403,
      );
      await mutate(
        "campaigns",
        outsider.cookie,
        { action: "cancel", id: campaign.id },
        409,
      );
      assert.equal(
        (await db.campaign.findUnique({ where: { id: campaign.id } })).status,
        "DRAFT",
        "Denied writes must not alter campaign state",
      );
    },
  );
  await check(
    "approved fixture can submit once then cancel its private campaign",
    async () => {
      // Only this run's synthetic organization is approved, never a real tenant.
      await db.organization.update({
        where: { id: owner.orgId },
        data: { status: "ACTIVE" },
      });
      await mutate("campaigns", owner.cookie, {
        action: "submit",
        id: campaign.id,
      });
      assert.equal(
        (await db.campaign.findUnique({ where: { id: campaign.id } })).status,
        "REVIEW",
        "Submission must stop at operations review",
      );
      await mutate(
        "campaigns",
        owner.cookie,
        { action: "submit", id: campaign.id },
        409,
      );
      await mutate("campaigns", owner.cookie, {
        action: "cancel",
        id: campaign.id,
      });
      assert.equal(
        (await db.campaign.findUnique({ where: { id: campaign.id } })).status,
        "CANCELED",
        "Cancellation must persist",
      );
      await db.organization.update({
        where: { id: owner.orgId },
        data: { status: "PENDING" },
      });
    },
  );
  await check(
    "analysis tools save requests without claiming processing",
    async () => {
      for (const tool of ["social-data", "brand-insight", "comments"])
        await mutate("tools", owner.cookie, {
          tool,
          title: `QA ${tool}`,
          input: "Synthetic request. Do not execute.",
        });
      const stored = (await bootstrap(owner.cookie)).requests;
      assert.equal(
        stored.length,
        3,
        "All tool requests must persist across reloads",
      );
      assert.ok(
        stored.every(
          (entry) =>
            entry.status === "REQUESTED" &&
            entry.input === "Synthetic request. Do not execute.",
        ),
        "Saved requests must not be reported as completed analysis",
      );
      assert.equal(
        (await bootstrap(outsider.cookie)).requests.length,
        0,
        "Tool requests must remain tenant private",
      );
    },
  );
  await check(
    "owner account changes persist without changing identity or approval",
    async () => {
      const before = await db.user.findUnique({ where: { id: owner.userId } });
      await mutate("account", owner.cookie, {
        name: `Workspace QA ${runId} updated`,
        contactName: "Updated QA",
        websiteUrl: "https://example.com",
      });
      const data = await bootstrap(owner.cookie);
      assert.equal(
        data.account.contactName,
        "Updated QA",
        "Contact name must persist",
      );
      assert.equal(
        data.account.websiteUrl,
        "https://example.com/",
        "Validated company website must persist",
      );
      assert.equal(
        data.account.status,
        "PENDING",
        "Account edits must not grant approval",
      );
      const after = await db.user.findUnique({ where: { id: owner.userId } });
      assert.equal(
        after.email,
        before.email,
        "Login email must stay unchanged",
      );
      assert.equal(
        after.emailVerified,
        false,
        "Account edit must not claim email verification",
      );
      await mutate(
        "account",
        owner.cookie,
        {
          name: "Rejected",
          contactName: "QA",
          websiteUrl: "",
          status: "ACTIVE",
          emailVerified: true,
        },
        400,
      );
    },
  );
  await check(
    "regular members cannot perform manager or owner operations",
    async () => {
      for (const [path, body] of [
        [
          "links",
          {
            action: "create",
            title: "Not saved",
            targetUrl: "https://example.com",
          },
        ],
        ["links", { action: "toggle", id: shortLink.id, active: false }],
        [
          "campaigns",
          {
            action: "create",
            title: "Not saved",
            summary: "QA",
            platforms: ["youtube"],
            currency: "USD",
            budgetAmount: "1",
          },
        ],
        ["account", { name: "Not saved", contactName: "QA", websiteUrl: "" }],
      ])
        await mutate(path, member.cookie, body, 403);
      assert.equal(
        (await bootstrap(member.cookie)).account.role,
        "MEMBER",
        "Shared read access must not grant a higher role",
      );
    },
  );
  await check(
    "CSRF, strict schemas and bounded request bodies fail closed",
    async () => {
      for (const origin of [null, "https://foreign.example.com"])
        status(
          await request("/api/workspace/collections", {
            cookie: owner.cookie,
            origin,
            body: { action: "create", name: "Not saved" },
          }),
          403,
          "Missing or foreign origins must be rejected",
        );
      await mutate(
        "collections",
        owner.cookie,
        { action: "create", name: "Not saved", organizationId: outsider.orgId },
        400,
      );
      await mutate(
        "tools",
        owner.cookie,
        { tool: "comments", title: "Too large", input: "x".repeat(20_000) },
        413,
      );
    },
  );
  await check(
    "suspension invalidates API and public-link access immediately",
    async () => {
      await db.organization.update({
        where: { id: owner.orgId },
        data: { status: "SUSPENDED" },
      });
      status(
        await request("/api/workspace/bootstrap", { cookie: owner.cookie }),
        403,
        "Existing session must not bypass suspension",
      );
      await mutate(
        "tools",
        owner.cookie,
        { tool: "comments", title: "Not saved", input: "QA" },
        403,
      );
      status(
        await request(`/s/${shortLink.code}`, { origin: null }),
        404,
        "Suspended tenant's short links must not redirect",
      );
    },
  );
  await check(
    "sign-out revokes workspace access for the prior session",
    async () => {
      const result = await request("/api/auth/sign-out", {
        cookie: outsider.cookie,
        body: {},
      });
      status(result, 200, "Sign-out must succeed");
      status(
        await request("/api/workspace/bootstrap", { cookie: outsider.cookie }),
        401,
        "Revoked session cookie must no longer authorize API reads",
      );
    },
  );
  console.log(`PASS all ${checks} real-database workspace checks`);
} catch (error) {
  failed = true;
  const detail =
    error instanceof assert.AssertionError
      ? error.message.split("\n", 1)[0]
      : "unexpected network/database/runtime failure (details withheld)";
  console.error(`FAIL ${currentStep}: ${detail}`);
} finally {
  try {
    const ids = [...userIds],
      organizationIds = [...orgIds];
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    assert.ok(
      users.every(
        (user) =>
          user.email === `${user.id}@example.invalid` &&
          user.id.startsWith(`${prefix}-`),
      ),
      "Refusing to remove records outside this exact synthetic run",
    );
    const organizations = await db.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, slug: true },
    });
    assert.ok(
      organizations.every(
        (org) => org.slug === org.id && org.id.startsWith(`${prefix}-`),
      ),
      "Refusing to remove an unrelated organization",
    );
    await db.$transaction([
      db.campaign.deleteMany({
        where: {
          brandOrganizationId: { in: organizationIds },
          createdById: { in: ids },
        },
      }),
      db.auditLog.deleteMany({ where: { actorId: { in: ids } } }),
      db.organization.deleteMany({ where: { id: { in: organizationIds } } }),
      db.user.deleteMany({ where: { id: { in: ids } } }),
      db.creatorDirectoryEntry.deleteMany({
        where: { id: { in: [...entryIds] } },
      }),
      db.rateLimit.deleteMany({
        where: {
          key: {
            in: ids.flatMap((id) =>
              ["read", "write", "search"].map(
                (bucket) => `workspace:${bucket}:${id}`,
              ),
            ),
          },
        },
      }),
    ]);
    console.log(
      `CLEANUP removed ${users.length} synthetic account(s), ${organizations.length} fixture organization(s), and their exact workspace records`,
    );
  } catch {
    failed = true;
    console.error(
      `CLEANUP FAILED: inspect only this run's synthetic IDs starting with ${prefix}`,
    );
  } finally {
    await db.$disconnect();
  }
}
if (failed) process.exitCode = 1;
