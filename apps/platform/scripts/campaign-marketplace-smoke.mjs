import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { hashPassword } from "better-auth/crypto";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";

// Opt-in integration test. The caller supplies the database environment used
// by both servers. Never reads/writes environment files or prints credentials.
assert.equal(
  process.env.RUN_DB_SMOKE,
  "1",
  "Set RUN_DB_SMOKE=1 to create disposable DB fixtures.",
);
assert.ok(
  process.env.DATABASE_URL,
  "DATABASE_URL must be supplied by the caller.",
);

function origin(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert.ok(
    ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "Test URLs must be exact HTTP(S) origins.",
  );
  assert.ok(local || url.protocol === "https:", "Remote tests require HTTPS.");
  return url.origin;
}
const base = origin(process.env.BASE_URL || "http://localhost:3000");
const adminBase = origin(process.env.ADMIN_BASE_URL || "http://localhost:3001");
assert.notEqual(
  base,
  adminBase,
  "Platform and admin must use separate origins.",
);
const db = createDatabaseClient();
const run = `${Date.now()}-${randomBytes(6).toString("hex")}`;
const prefix = `fm-e2e-${run}`;
const password = `Fm-E2E-${randomBytes(24).toString("base64url")}!`;
const userIds = new Set();
const organizationIds = new Set();
const sessions = [];
const fixtures = {};
const ownedCampaignIds = new Set();
let phase = "preflight";
let passed = 0;
let loginCount = 0;
let lastLoginAt = 0;
let failed = false;
let lastStatus = null;

async function cooldown(milliseconds) {
  for (
    let remaining = milliseconds;
    remaining > 0;
    remaining -= Math.min(30_000, remaining)
  ) {
    await delay(Math.min(30_000, remaining));
  }
}
async function call(
  path,
  { target = base, cookie, body, requestOrigin = target, method } = {},
) {
  const response = await globalThis.fetch(`${target}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(60_000),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            Origin: requestOrigin,
            "Sec-Fetch-Site":
              requestOrigin === target ? "same-origin" : "cross-site",
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    /* Pages may return HTML. */
  }
  lastStatus = response.status;
  return { response, json };
}
function expect(result, status) {
  assert.equal(
    result.response.status,
    status,
    `${phase}: HTTP status must match.`,
  );
}
function pass(description) {
  passed += 1;
  console.log(`PASS ${passed}: ${description}`);
}
async function login(fixture, target = base) {
  // Both apps share the DB-backed auth rate limiter. Use at most four logins
  // per inactivity window, and never delete IP counters or spoof client IPs.
  if (loginCount >= 4) {
    console.log("WAIT auth limiter cooldown (no counter bypass)");
    await cooldown(Math.max(0, 61_000 - (Date.now() - lastLoginAt)));
    loginCount = 0;
  }
  let result;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = await call("/api/auth/sign-in/email", {
      target,
      body: { email: fixture.email, password },
    });
    if (result.response.status !== 429 || attempt === 2) break;
    const retrySeconds = Number(result.response.headers.get("retry-after"));
    console.log("WAIT server-requested authentication cooldown");
    await cooldown(
      Math.max(
        61_000,
        Number.isFinite(retrySeconds) ? retrySeconds * 1000 + 1000 : 0,
      ),
    );
    loginCount = 0;
  }
  loginCount += 1;
  lastLoginAt = Date.now();
  expect(result, 200);
  assert.equal(
    result.json?.user?.id,
    fixture.userId,
    "Login must resolve the owned fixture user.",
  );
  const cookie = result.response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Login must issue a session cookie.");
  sessions.push({ target, cookie });
  return cookie;
}
async function listFor(account) {
  const result = await call("/api/agency/campaigns", {
    cookie: account.cookie,
  });
  expect(result, 200);
  assert.ok(
    Array.isArray(result.json?.campaigns) &&
      Array.isArray(result.json?.applications),
    "Agency bootstrap must have typed collections.",
  );
  return result.json;
}
async function createCampaign(label, overrides = {}) {
  const result = await call("/api/workspace/campaigns", {
    cookie: fixtures.brand.cookie,
    body: {
      action: "create",
      title: `${prefix}-${label}`,
      summary: "Synthetic integration test campaign; no commercial activity.",
      platforms: ["youtube", "tiktok"],
      regions: ["KR"],
      categories: ["gaming"],
      followerMin: 1000,
      followerMax: 500000,
      currency: "USD",
      budgetAmount: "1000.25",
      deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      ...overrides,
    },
  });
  expect(result, 200);
  assert.equal(
    typeof result.json?.id,
    "string",
    "Creation must return a campaign ID.",
  );
  ownedCampaignIds.add(result.json.id);
  return result.json.id;
}
async function adminAction(action, id, options = {}) {
  return call("/api/admin/actions", {
    target: adminBase,
    cookie: fixtures.admin.cookie,
    body: { action, id, reason: "Disposable integration test action" },
    ...options,
  });
}
async function publish(campaignId) {
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: { action: "submit", id: campaignId },
    }),
    200,
  );
  expect(await adminAction("publishCampaign", campaignId), 200);
}
async function findOwnApplication(campaignId, agency = fixtures.agency) {
  const application = await db.campaignApplication.findUnique({
    where: {
      campaignId_agencyOrganizationId: {
        campaignId,
        agencyOrganizationId: agency.organizationId,
      },
    },
  });
  assert.ok(
    application,
    "A persisted application must exist for the fixture organization.",
  );
  return application;
}

try {
  phase = "anonymous boundaries";
  expect(await call("/api/agency/campaigns"), 401);
  expect(
    await call("/api/workspace/campaign-applications?campaignId=missing"),
    401,
  );
  expect(await call("/api/admin/bootstrap", { target: adminBase }), 401);
  pass("anonymous platform and admin APIs require authentication");

  phase = "fixture creation";
  const encodedPassword = await hashPassword(password);
  const specs = [
    ["brand", "BRAND", "ACTIVE"],
    ["otherBrand", "BRAND", "ACTIVE"],
    ["agency", "AGENCY", "ACTIVE"],
    ["otherAgency", "AGENCY", "ACTIVE"],
    ["pendingAgency", "AGENCY", "PENDING"],
    ["admin", "PLATFORM", "ACTIVE"],
  ];
  // IDs are assigned before the atomic transaction so cleanup remains exact
  // even if creation, a network call, or a later assertion fails.
  for (const [label, type, status] of specs) {
    const userId = `${prefix}-u-${label}`;
    const organizationId = `${prefix}-o-${label}`;
    userIds.add(userId);
    organizationIds.add(organizationId);
    fixtures[label] = {
      userId,
      organizationId,
      type,
      status,
      email: `${prefix}-${label.toLowerCase()}@example.invalid`,
    };
  }
  fixtures.member = {
    userId: `${prefix}-u-member`,
    organizationId: fixtures.agency.organizationId,
    email: `${prefix}-member@example.invalid`,
  };
  userIds.add(fixtures.member.userId);
  await db.$transaction(
    async (tx) => {
      for (const [label, fixture] of Object.entries(fixtures)) {
        await tx.user.create({
          data: {
            id: fixture.userId,
            email: fixture.email,
            emailVerified: false,
            name: `${prefix}-${label}`,
          },
        });
        await tx.account.create({
          data: {
            id: `${fixture.userId}-credential`,
            userId: fixture.userId,
            accountId: fixture.userId,
            providerId: "credential",
            password: encodedPassword,
          },
        });
        if (label !== "member")
          await tx.organization.create({
            data: {
              id: fixture.organizationId,
              name: `${prefix}-${label}`,
              slug: `${prefix}-${label}`,
              type: fixture.type,
              status: fixture.status,
              metadata:
                fixture.type === "PLATFORM"
                  ? {}
                  : { testWorkspaceAccess: true, agencyType: "agency" },
            },
          });
        await tx.organizationMember.create({
          data: {
            userId: fixture.userId,
            organizationId: fixture.organizationId,
            role: label === "member" ? "MEMBER" : "OWNER",
          },
        });
      }
    },
    { maxWait: 20_000, timeout: 20_000 },
  );

  const previous = await db.rateLimit.findFirst({
    where: { key: { endsWith: "|/sign-in/email" } },
    orderBy: { lastRequest: "desc" },
    select: { lastRequest: true },
  });
  const remaining = previous
    ? Math.max(0, 61_000 - (Date.now() - Number(previous.lastRequest)))
    : 0;
  if (remaining) {
    console.log(
      "WAIT previous auth inactivity window (no shared counter changes)",
    );
    await cooldown(remaining);
  }
  phase = "fixture logins";
  for (const [label, fixture] of Object.entries(fixtures))
    fixture.cookie = await login(fixture, label === "admin" ? adminBase : base);
  const ordinaryAdminCookie = await login(fixtures.brand, adminBase);
  pass("disposable DB fixtures authenticate with real credential hashing");

  phase = "role and approval boundaries";
  expect(
    await call("/api/agency/campaigns", { cookie: fixtures.brand.cookie }),
    403,
  );
  expect(
    await call("/api/workspace/bootstrap", { cookie: fixtures.agency.cookie }),
    403,
  );
  expect(
    await call("/api/agency/campaigns", {
      cookie: fixtures.pendingAgency.cookie,
    }),
    403,
  );
  expect(
    await call("/api/admin/bootstrap", {
      target: adminBase,
      cookie: ordinaryAdminCookie,
    }),
    403,
  );
  expect(
    await call("/api/admin/bootstrap", {
      target: adminBase,
      cookie: fixtures.brand.cookie,
    }),
    401,
  );
  expect(
    await call("/api/admin/actions", {
      target: adminBase,
      cookie: ordinaryAdminCookie,
      body: {
        action: "approveOrganization",
        id: fixtures.agency.organizationId,
        reason: "Forbidden role test",
      },
    }),
    403,
  );
  const adminSnapshot = await call("/api/admin/bootstrap", {
    target: adminBase,
    cookie: fixtures.admin.cookie,
  });
  expect(adminSnapshot, 200);
  assert.ok(
    adminSnapshot.json?.users?.some(
      (user) => user.id === fixtures.brand.userId,
    ),
    "Admin must see the synthetic user.",
  );
  assert.ok(
    !Object.hasOwn(
      adminSnapshot.json.users.find(
        (user) => user.id === fixtures.brand.userId,
      ),
      "password",
    ),
    "Admin listing must not expose credentials.",
  );
  const memberListing = await listFor(fixtures.member);
  assert.equal(
    memberListing.account.role,
    "MEMBER",
    "Member role must remain read-only.",
  );
  pass(
    "organization approval, roles, separate admin cookies and admin RBAC enforced",
  );

  phase = "campaign validation";
  const invalidCampaign = await createCampaign("invalid", {
    budgetAmount: "0",
    deadline: undefined,
  });
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: { action: "submit", id: invalidCampaign },
    }),
    400,
  );
  expect(await adminAction("publishCampaign", invalidCampaign), 409);
  const update = {
    action: "update",
    id: invalidCampaign,
    title: `${prefix}-invalid`,
    summary: "Synthetic validation only",
    platforms: ["youtube"],
    currency: "USD",
    budgetAmount: "100",
    deadline: new Date(Date.now() - 86_400_000).toISOString(),
  };
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: update,
    }),
    200,
  );
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: { action: "submit", id: invalidCampaign },
    }),
    400,
  );
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.otherBrand.cookie,
      body: update,
    }),
    409,
  );
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: { ...update, organizationId: fixtures.otherBrand.organizationId },
    }),
    400,
  );
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      requestOrigin: "https://untrusted.invalid",
      body: update,
    }),
    403,
  );
  const campaignId = await createCampaign("recruiting");
  assert.equal(
    (await db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status,
    "DRAFT",
    "New campaign must remain a draft.",
  );
  let listing = await listFor(fixtures.agency);
  assert.ok(
    !listing.campaigns.some((campaign) => campaign.id === campaignId),
    "Drafts must be hidden.",
  );
  const proposal = {
    action: "apply",
    campaignId,
    proposal: "Synthetic agency proposal for integration verification only.",
    proposedAmount: "700.25",
  };
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
    409,
  );
  expect(
    await call("/api/workspace/campaigns", {
      cookie: fixtures.brand.cookie,
      body: { action: "submit", id: campaignId },
    }),
    200,
  );
  assert.equal(
    (await db.campaign.findUniqueOrThrow({ where: { id: campaignId } })).status,
    "REVIEW",
    "Submission must request operations review.",
  );
  listing = await listFor(fixtures.agency);
  assert.ok(
    !listing.campaigns.some((campaign) => campaign.id === campaignId),
    "Review campaigns must stay hidden.",
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
    409,
  );
  pass(
    "draft/review isolation, positive budget, future deadline, tenant and CSRF validation",
  );

  phase = "admin publication";
  expect(
    await adminAction("publishCampaign", campaignId, {
      requestOrigin: "https://untrusted.invalid",
    }),
    403,
  );
  expect(await adminAction("publishCampaign", campaignId), 200);
  const published = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });
  assert.equal(
    published.status,
    "RECRUITING",
    "Admin publication must start recruiting.",
  );
  assert.ok(published.publishedAt, "Publication must persist its timestamp.");
  listing = await listFor(fixtures.agency);
  const visible = listing.campaigns.find(
    (campaign) => campaign.id === campaignId,
  );
  assert.ok(visible, "Published campaign must appear to approved agencies.");
  assert.deepEqual(
    visible.platforms,
    ["youtube", "tiktok"],
    "Platforms must persist.",
  );
  assert.deepEqual(visible.regions, ["KR"], "Regions must persist.");
  assert.equal(
    visible.budgetAmount,
    "1000.25",
    "Decimal budgets must retain cents.",
  );
  for (const key of [
    "brandOrganizationId",
    "brandOrganization",
    "privateTitle",
    "createdById",
    "requirements",
  ])
    assert.ok(
      !Object.hasOwn(visible, key),
      "Agency response must not expose private brand data.",
    );
  pass(
    "admin publication persists and is visible in the real agency marketplace",
  );

  phase = "applications and concurrency";
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.member.cookie,
      body: proposal,
    }),
    403,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.pendingAgency.cookie,
      body: proposal,
    }),
    403,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.brand.cookie,
      body: proposal,
    }),
    403,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      requestOrigin: "https://untrusted.invalid",
      body: proposal,
    }),
    403,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: {
        ...proposal,
        agencyOrganizationId: fixtures.otherAgency.organizationId,
      },
    }),
    400,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: { ...proposal, proposedAmount: "-1" },
    }),
    400,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: { ...proposal, currency: "KRW" },
    }),
    400,
  );
  const parallel = await Promise.all([
    call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
    call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
  ]);
  assert.deepEqual(
    parallel.map((result) => result.response.status).sort(),
    [200, 409],
    "Concurrent duplicate applications must create exactly one record.",
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
    409,
  );
  assert.equal(
    await db.campaignApplication.count({
      where: {
        campaignId,
        agencyOrganizationId: fixtures.agency.organizationId,
      },
    }),
    1,
    "Duplicate requests must not create additional applications.",
  );
  const firstApplication = await findOwnApplication(campaignId);
  assert.equal(
    firstApplication.proposal,
    proposal.proposal,
    "Proposal text must persist.",
  );
  assert.equal(
    firstApplication.proposedAmount.toFixed(2),
    "700.25",
    "Proposal amount must persist exactly.",
  );
  assert.equal(
    firstApplication.currency,
    "USD",
    "Proposal currency must come from the campaign.",
  );
  assert.equal(
    firstApplication.submittedById,
    fixtures.agency.userId,
    "Application submitter must come from the session.",
  );
  const brandList = await call(
    `/api/workspace/campaign-applications?campaignId=${campaignId}`,
    { cookie: fixtures.brand.cookie },
  );
  expect(brandList, 200);
  assert.equal(
    brandList.json.applications.length,
    1,
    "Brand must see the persisted application.",
  );
  assert.match(
    brandList.json.applications[0].agencyLabel,
    /^Partner /,
    "Brand must receive an opaque agency label.",
  );
  for (const key of [
    "agencyOrganizationId",
    "agencyOrganization",
    "submittedById",
    "email",
  ])
    assert.ok(
      !Object.hasOwn(brandList.json.applications[0], key),
      "Application response must not expose direct identity/contact data.",
    );
  expect(
    await call(
      `/api/workspace/campaign-applications?campaignId=${campaignId}`,
      { cookie: fixtures.otherBrand.cookie },
    ),
    404,
  );
  expect(
    await call("/api/workspace/campaign-applications", {
      cookie: fixtures.otherBrand.cookie,
      body: { action: "accept", applicationId: firstApplication.id },
    }),
    409,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.otherAgency.cookie,
      body: { action: "withdraw", applicationId: firstApplication.id },
    }),
    409,
  );
  pass(
    "real proposals persist once, including simultaneous duplicate protection and tenant isolation",
  );

  phase = "shortlist and withdrawal";
  expect(
    await call("/api/workspace/campaign-applications", {
      cookie: fixtures.brand.cookie,
      body: { action: "shortlist", applicationId: firstApplication.id },
    }),
    200,
  );
  listing = await listFor(fixtures.agency);
  assert.equal(
    listing.applications.find(
      (application) => application.id === firstApplication.id,
    )?.status,
    "SHORTLISTED",
    "Agency must see the shortlist decision.",
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: { action: "withdraw", applicationId: firstApplication.id },
    }),
    200,
  );
  assert.equal(
    (await findOwnApplication(campaignId)).status,
    "WITHDRAWN",
    "Withdrawal must persist.",
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: proposal,
    }),
    409,
  );
  expect(
    await call("/api/workspace/campaign-applications", {
      cookie: fixtures.brand.cookie,
      body: { action: "accept", applicationId: firstApplication.id },
    }),
    409,
  );
  pass(
    "shortlist and withdrawal synchronize across roles; withdrawn applications cannot reapply",
  );

  phase = "selection and closed recruitment";
  const selectedCampaignId = await createCampaign("selected");
  await publish(selectedCampaignId);
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: { ...proposal, campaignId: selectedCampaignId },
    }),
    200,
  );
  const selected = await findOwnApplication(selectedCampaignId);
  expect(
    await call("/api/workspace/campaign-applications", {
      cookie: fixtures.brand.cookie,
      body: { action: "accept", applicationId: selected.id },
    }),
    200,
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.agency.cookie,
      body: { action: "withdraw", applicationId: selected.id },
    }),
    409,
  );
  assert.equal(
    (await findOwnApplication(selectedCampaignId)).status,
    "ACCEPTED",
    "Selection must persist without being withdrawable.",
  );
  assert.equal(
    await db.settlement.count({ where: { applicationId: selected.id } }),
    0,
    "Selection must not create a payment or settlement.",
  );
  expect(await adminAction("closeCampaign", selectedCampaignId), 200);
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.otherAgency.cookie,
      body: { ...proposal, campaignId: selectedCampaignId },
    }),
    409,
  );
  listing = await listFor(fixtures.agency);
  assert.ok(
    !listing.campaigns.some((campaign) => campaign.id === selectedCampaignId),
    "Closed campaigns must leave the recruiting list.",
  );
  assert.equal(
    listing.applications.find((application) => application.id === selected.id)
      ?.campaignStatus,
    "IN_PROGRESS",
    "Own applications remain visible after recruitment closes.",
  );
  pass(
    "selection persists without money movement and closed recruitment rejects new applications",
  );

  phase = "elapsed deadline and suspension";
  const expiredCampaignId = await createCampaign("expired");
  await publish(expiredCampaignId);
  await db.campaign.update({
    where: { id: expiredCampaignId },
    data: { applicationDeadline: new Date(Date.now() - 60_000) },
  });
  listing = await listFor(fixtures.agency);
  assert.ok(
    !listing.campaigns.some((campaign) => campaign.id === expiredCampaignId),
    "Expired campaigns must leave the recruiting list.",
  );
  expect(
    await call("/api/agency/applications", {
      cookie: fixtures.otherAgency.cookie,
      body: { ...proposal, campaignId: expiredCampaignId },
    }),
    409,
  );
  expect(
    await adminAction(
      "suspendOrganization",
      fixtures.otherAgency.organizationId,
    ),
    200,
  );
  expect(
    await call("/api/agency/campaigns", {
      cookie: fixtures.otherAgency.cookie,
    }),
    403,
  );
  expect(
    await adminAction("suspendOrganization", fixtures.brand.organizationId),
    200,
  );
  listing = await listFor(fixtures.agency);
  assert.ok(
    !listing.campaigns.some((campaign) => campaign.id === campaignId),
    "Suspended advertisers' campaigns must be hidden.",
  );
  expect(
    await call("/api/workspace/bootstrap", { cookie: fixtures.brand.cookie }),
    403,
  );
  const auditRows = await db.auditLog.findMany({
    where: { actorId: { in: [...userIds] } },
    select: { action: true },
  });
  const auditActions = new Set(auditRows.map((row) => row.action));
  for (const action of [
    "campaign.created",
    "campaign.submit",
    "admin.publishCampaign",
    "application.submitted",
    "application.shortlist",
    "application.withdrawn",
    "application.accept",
    "admin.closeCampaign",
    "admin.suspendOrganization",
  ])
    assert.ok(
      auditActions.has(action),
      "Critical state changes must have audit records.",
    );
  pass(
    "deadline/suspension gates update immediately and state changes are audited",
  );
} catch (error) {
  failed = true;
  // Do not print the raw error, response, session, fixture password or DB URL.
  console.error(
    `FAIL at ${phase}; ${error instanceof assert.AssertionError ? "assertion" : "request/database"} failure; last HTTP status ${lastStatus ?? "none"}.`,
  );
  if (error instanceof assert.AssertionError) console.error(error.message);
} finally {
  phase = "owned fixture cleanup";
  for (const session of sessions) {
    try {
      const result = await call("/api/auth/sign-out", {
        target: session.target,
        cookie: session.cookie,
        body: {},
      });
      if (result.response.status !== 200) {
        failed = true;
        console.error("FAIL closing an owned test session.");
      }
    } catch {
      failed = true;
      console.error("FAIL contacting sign-out for an owned test session.");
    }
  }
  try {
    const ownedUsers = [...userIds],
      ownedOrganizations = [...organizationIds];
    assert.ok(
      ownedUsers.every((id) => id.startsWith(`${prefix}-u-`)) &&
        ownedOrganizations.every((id) => id.startsWith(`${prefix}-o-`)),
      "Cleanup IDs must belong to this exact test run.",
    );
    await db.$transaction(
      async (tx) => {
        // Query using exact owned organization IDs to also catch a campaign whose
        // API write succeeded before its response was interrupted.
        const campaigns = await tx.campaign.findMany({
          where: { brandOrganizationId: { in: ownedOrganizations } },
          select: { id: true },
        });
        for (const campaign of campaigns) ownedCampaignIds.add(campaign.id);
        const campaignIds = [...ownedCampaignIds];
        const applications = await tx.campaignApplication.findMany({
          where: { campaignId: { in: campaignIds } },
          select: { id: true },
        });
        const entityIds = [
          ...ownedUsers,
          ...ownedOrganizations,
          ...campaignIds,
          ...applications.map((application) => application.id),
        ];
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { actorId: { in: ownedUsers } },
              { entityId: { in: entityIds } },
            ],
          },
        });
        await tx.campaign.deleteMany({
          where: {
            id: { in: campaignIds },
            brandOrganizationId: { in: ownedOrganizations },
          },
        });
        const counters = await tx.rateLimit.findMany({
          where: {
            OR: ownedUsers.map((id) => ({ key: { endsWith: `:${id}` } })),
          },
          select: { id: true },
        });
        await tx.rateLimit.deleteMany({
          where: { id: { in: counters.map((counter) => counter.id) } },
        });
        await tx.organization.deleteMany({
          where: { id: { in: ownedOrganizations } },
        });
        await tx.user.deleteMany({ where: { id: { in: ownedUsers } } });
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
    assert.equal(
      await db.user.count({ where: { id: { in: [...userIds] } } }),
      0,
      "Owned users must be removed.",
    );
    assert.equal(
      await db.organization.count({
        where: { id: { in: [...organizationIds] } },
      }),
      0,
      "Owned organizations must be removed.",
    );
    console.log(
      "PASS cleanup: only exact owned fixtures, sessions and per-user counters removed; shared auth counters retained.",
    );
  } catch {
    failed = true;
    console.error(
      `FAIL cleanup: inspect only the disposable fixture prefix ${prefix}; no broad cleanup was attempted.`,
    );
  }
  await db.$disconnect();
}
console.log(
  `${failed ? "FAILED" : "PASSED"}: ${passed} marketplace integration groups.`,
);
process.exitCode = failed ? 1 : 0;
