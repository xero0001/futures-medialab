import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import {
  DEMO_CAMPAIGN_BRAND_ID,
  DEMO_CAMPAIGN_SEED,
} from "../lib/campaign-demo.ts";
import { hasApprovedTestWorkspaceAccess } from "../lib/test-workspace-access.ts";

// Every name, brief, amount and status below is fictional. No real publisher,
// creator identity, contract, settlement, payout, credentials or session is seeded.
// Deploy the campaign-demo server guards BEFORE applying to a shared production
// database: old deployments do not know how to hide these fixtures from live users.
export const demoCampaigns = [
  {
    key: "starlight-odyssey",
    title: "Starlight Odyssey · Launch Preview",
    summary:
      "Fictional demo brief. Introduce a space-fantasy RPG through a 6–8 minute first-look video and two Shorts. Showcase exploration, character customization and a beginner-friendly team setup. Korean-language content; submit an outline before filming.",
    platforms: ["youtube", "tiktok"],
    categories: ["gaming", "entertainment"],
    followerMin: 10000,
    followerMax: 500000,
    budgetAmount: "5000.00",
    currency: "USD",
    days: 30,
    application: {
      status: "SUBMITTED",
      proposedAmount: "1800.00",
      proposal:
        "[Demo proposal] A fictional three-creator roster will produce a Korean first-look video and two short clips. This entry illustrates a submitted application; it is not a real commitment.",
    },
  },
  {
    key: "frost-haven",
    title: "Frost Haven · Survival Challenge",
    summary:
      "Fictional demo brief. Host a 90-minute co-op survival stream with an audience-voted base-building challenge. Deliver a highlight edit within five days. The proposed budget covers the complete example campaign, not a promised payout.",
    platforms: ["youtube", "twitch"],
    categories: ["gaming"],
    followerMin: 5000,
    followerMax: 200000,
    budgetAmount: "8000000.00",
    currency: "KRW",
    days: 38,
    application: {
      status: "SHORTLISTED",
      proposedAmount: "2500000.00",
      proposal:
        "[Demo proposal] Two fictional streamers will collaborate on a survival challenge, followed by one edited highlight. Shortlisted is a sample status only; no advertiser has reviewed this proposal.",
    },
  },
  {
    key: "neon-rally",
    title: "Neon Rally · Weekend Creator Cup",
    summary:
      "Fictional demo brief. Create a high-energy racing challenge using a fictional neon city track. Publish one 60-second vertical video and a behind-the-scenes story. Focus on friendly competition and accessible controls.",
    platforms: ["instagram", "tiktok"],
    categories: ["gaming", "entertainment"],
    followerMin: 1000,
    followerMax: 100000,
    budgetAmount: "24000.00",
    currency: "CNY",
    days: 45,
    application: {
      status: "ACCEPTED",
      proposedAmount: "8000.00",
      proposal:
        "[Demo proposal] A fictional creator team will make one racing challenge and a story set. Accepted is an illustrative status, not an executed contract, real selection or payment approval.",
    },
  },
  {
    key: "cloud-garden",
    title: "Cloud Garden · Cozy Play Sessions",
    summary:
      "Fictional demo brief. Share a relaxing garden-building session, explain the decoration system and invite viewers to design their own island. Deliver a 5-minute review and one cozy short-form edit in Korean.",
    platforms: ["youtube", "instagram"],
    categories: ["gaming", "lifestyle"],
    followerMin: 3000,
    followerMax: 150000,
    budgetAmount: "3200.00",
    currency: "USD",
    days: 52,
    application: {
      status: "REJECTED",
      proposedAmount: "950.00",
      proposal:
        "[Demo proposal] This fictional proposal demonstrates the not-selected state and project history. No real creator, advertiser or commercial decision is represented.",
    },
  },
  {
    key: "pixel-quest",
    title: "Pixel Quest · First Adventure Shorts",
    summary:
      "Fictional demo brief. Introduce a pixel-art adventure in three 30–45 second episodes. Explain the starting quest, one puzzle and a favorite in-game moment. Suitable for emerging gaming creators; no previous sponsorship experience required.",
    platforms: ["tiktok", "youtube"],
    categories: ["gaming"],
    followerMin: 1000,
    followerMax: 50000,
    budgetAmount: "2500000.00",
    currency: "KRW",
    days: 60,
  },
  {
    key: "arcane-tactics",
    title: "Arcane Tactics · Strategy Lab",
    summary:
      "Fictional demo brief. Produce an educational strategy guide for a fictional turn-based game. Show three team combinations and explain their strengths without making performance guarantees. One long-form video plus a text thread.",
    platforms: ["youtube", "x"],
    categories: ["gaming", "technology"],
    followerMin: 20000,
    followerMax: 1000000,
    budgetAmount: "7500.00",
    currency: "USD",
    days: 68,
  },
  {
    key: "moonlight-cafe",
    title: "Moonlight Café · Story Reveal",
    summary:
      "Fictional demo brief. Preview a story-driven café simulation with a spoiler-free character introduction. Create a vertical story recap and community poll. Korean audience; disclose sponsorship clearly in this example production plan.",
    platforms: ["instagram", "facebook"],
    categories: ["gaming", "lifestyle"],
    followerMin: 5000,
    followerMax: 300000,
    budgetAmount: "18000.00",
    currency: "CNY",
    days: 76,
  },
  {
    key: "aether-arena",
    title: "Aether Arena · Community Scrims",
    summary:
      "Fictional demo brief. Plan a two-hour friendly multiplayer tournament for a fictional arena game. Include a caster, an audience Q&A and a next-day highlight reel. Outline moderation, participant consent and production scheduling in the proposal.",
    platforms: ["twitch", "youtube"],
    categories: ["gaming", "entertainment"],
    followerMin: 50000,
    followerMax: null,
    budgetAmount: "15000000.00",
    currency: "KRW",
    days: 90,
  },
];

const actorId = "fm-demo-actor-agency-v1";
const actorEmail = "agency-demo-system@futures-medialab.invalid";
const brandSlug = "demo-agency-campaigns-v1";
const campaignId = (key) => `fm-demo-campaign-${key}`;
const applicationId = (key) => `fm-demo-application-${key}`;
const hasMarker = (value) =>
  value?.demo === true && value?.seed === DEMO_CAMPAIGN_SEED;

async function inspect(tx) {
  const agency = await tx.user.findUnique({
    where: { email: "agency@agency.com" },
    select: {
      id: true,
      memberships: {
        where: { organization: { type: "AGENCY" } },
        select: {
          organizationId: true,
          organization: { select: { status: true, metadata: true } },
        },
      },
    },
  });
  assert.ok(
    agency && agency.memberships.length === 1,
    "Expected exactly one agency@agency.com agency membership.",
  );
  const member = agency.memberships[0];
  assert.ok(
    hasApprovedTestWorkspaceAccess(member.organization),
    "The target agency must be an ACTIVE, explicitly approved test workspace.",
  );
  const [actor, emailOwner, brand, slugOwner, campaigns, applications] =
    await Promise.all([
      tx.user.findUnique({
        where: { id: actorId },
        select: {
          email: true,
          _count: {
            select: { accounts: true, sessions: true, memberships: true },
          },
        },
      }),
      tx.user.findUnique({
        where: { email: actorEmail },
        select: { id: true },
      }),
      tx.organization.findUnique({ where: { id: DEMO_CAMPAIGN_BRAND_ID } }),
      tx.organization.findUnique({
        where: { slug: brandSlug },
        select: { id: true },
      }),
      tx.campaign.findMany({
        where: {
          id: { in: demoCampaigns.map((item) => campaignId(item.key)) },
        },
      }),
      tx.campaignApplication.findMany({
        where: {
          OR: [
            {
              id: {
                in: demoCampaigns
                  .filter((item) => item.application)
                  .map((item) => applicationId(item.key)),
              },
            },
            {
              campaignId: {
                in: demoCampaigns
                  .filter((item) => item.application)
                  .map((item) => campaignId(item.key)),
              },
              agencyOrganizationId: member.organizationId,
            },
          ],
        },
      }),
    ]);
  assert.ok(
    !actor ||
      (actor.email === actorEmail &&
        Object.values(actor._count).every((count) => count === 0)),
    "Reserved demo actor collision or unexpected login access; no changes made.",
  );
  assert.ok(
    !emailOwner || emailOwner.id === actorId,
    "Reserved demo email collision; no changes made.",
  );
  assert.ok(
    !brand ||
      (brand.type === "BRAND" &&
        brand.slug === brandSlug &&
        brand.status === "ACTIVE" &&
        hasMarker(brand.metadata)),
    "Reserved demo brand collision; no changes made.",
  );
  assert.ok(
    !slugOwner || slugOwner.id === DEMO_CAMPAIGN_BRAND_ID,
    "Reserved demo slug collision; no changes made.",
  );
  for (const campaign of campaigns) {
    assert.ok(
      campaign.brandOrganizationId === DEMO_CAMPAIGN_BRAND_ID &&
        campaign.createdById === actorId &&
        hasMarker(campaign.requirements),
      "Reserved campaign collision; no changes made.",
    );
  }
  for (const application of applications) {
    const fixture = demoCampaigns.find(
      (item) => application.id === applicationId(item.key),
    );
    assert.ok(
      fixture?.application &&
        application.campaignId === campaignId(fixture.key) &&
        application.agencyOrganizationId === member.organizationId &&
        application.submittedById === agency.id,
      "Existing application does not belong to this fixture; no changes made.",
    );
  }
  return { agency, member, actor, brand, campaigns, applications };
}

export async function seedAgencyDemo({
  apply = false,
  // Dependency injection permits transaction/idempotency tests with no DB access.
  databaseClientFactory = createDatabaseClient,
} = {}) {
  if (databaseClientFactory === createDatabaseClient)
    assert.ok(
      process.env.DATABASE_URL,
      "Supply DATABASE_URL through the existing environment.",
    );
  const db = databaseClientFactory();
  try {
    await db.$queryRaw`SELECT 1`;
    return await db.$transaction(
      async (tx) => {
        const state = await inspect(tx);
        const missingCampaigns = demoCampaigns.filter(
          (item) =>
            !state.campaigns.some((row) => row.id === campaignId(item.key)),
        );
        const missingApplications = demoCampaigns.filter(
          (item) =>
            item.application &&
            !state.applications.some(
              (row) => row.id === applicationId(item.key),
            ),
        );
        const plan = {
          mode: apply ? "apply" : "dry-run",
          target: "agency@agency.com",
          campaignsToAdd: missingCampaigns.length,
          applicationsToAdd: missingApplications.length,
          existingRecordsPreserved: true,
        };
        if (!apply) return plan;
        if (!state.actor)
          await tx.user.create({
            data: {
              id: actorId,
              email: actorEmail,
              name: "[Demo] Fixture author — no login",
              emailVerified: false,
            },
          });
        if (!state.brand)
          await tx.organization.create({
            data: {
              id: DEMO_CAMPAIGN_BRAND_ID,
              slug: brandSlug,
              name: "[Demo] Fictional game publisher",
              type: "BRAND",
              status: "ACTIVE",
              countryCode: "KR",
              metadata: { demo: true, seed: DEMO_CAMPAIGN_SEED },
            },
          });
        const now = new Date();
        for (const item of missingCampaigns) {
          await tx.campaign.create({
            data: {
              id: campaignId(item.key),
              createdById: actorId,
              brandOrganizationId: DEMO_CAMPAIGN_BRAND_ID,
              title: `[Demo] ${item.title}`,
              summary: item.summary,
              status: "RECRUITING",
              platforms: item.platforms,
              regions: ["KR"],
              categories: item.categories,
              followerMin: item.followerMin,
              followerMax: item.followerMax,
              budgetAmount: item.budgetAmount,
              currency: item.currency,
              publishedAt: new Date(
                now.getTime() - demoCampaigns.indexOf(item) * 3600000,
              ),
              applicationDeadline: new Date(
                now.getTime() + item.days * 86400000,
              ),
              requirements: {
                demo: true,
                seed: DEMO_CAMPAIGN_SEED,
                disclaimer:
                  "Fictional test data. No real advertising, contract, settlement or payment.",
              },
            },
          });
        }
        for (const item of missingApplications) {
          await tx.campaignApplication.create({
            data: {
              id: applicationId(item.key),
              campaignId: campaignId(item.key),
              agencyOrganizationId: state.member.organizationId,
              submittedById: state.agency.id,
              ...item.application,
              currency: item.currency,
              rosterSnapshot: [],
              createdAt: new Date(
                now.getTime() - (demoCampaigns.indexOf(item) + 1) * 86400000,
              ),
            },
          });
        }
        if (missingCampaigns.length || missingApplications.length)
          await tx.auditLog.create({
            data: {
              actorId,
              action: "demo.agency.seeded",
              entityType: "Organization",
              entityId: DEMO_CAMPAIGN_BRAND_ID,
              payload: {
                seed: DEMO_CAMPAIGN_SEED,
                campaignsCreated: missingCampaigns.length,
                applicationsCreated: missingApplications.length,
              },
            },
          });
        return plan;
      },
      { isolationLevel: "Serializable", maxWait: 20000, timeout: 30000 },
    );
  } finally {
    await db.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--apply");
  assert.equal(
    unknown.length,
    0,
    "Only --apply is supported. Omit it for a read-only dry run.",
  );
  try {
    console.log(
      JSON.stringify(
        await seedAgencyDemo({ apply: process.argv.includes("--apply") }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : "Demo seed failed; the transaction was rolled back. Check the database connection and retry.",
    );
    process.exitCode = 1;
  }
}
