import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCampaign,
  DEMO_CAMPAIGN_BRAND_ID,
  getDemoCampaignArtwork,
  isDemoCampaign,
} from "../lib/campaign-demo.ts";
import { hasApprovedTestWorkspaceAccess } from "../lib/test-workspace-access.ts";
import { demoCampaigns } from "./seed-agency-demo.mjs";

test("demo metadata must be explicitly true; the reserved brand remains demo even if metadata changes", () => {
  for (const requirements of [
    null,
    {},
    [],
    { demo: "true" },
    { demo: false },
    Object.create({ demo: true }),
  ]) {
    assert.equal(isDemoCampaign({ requirements }), false);
  }
  assert.equal(isDemoCampaign({ requirements: { demo: true } }), true);
  assert.equal(
    isDemoCampaign({
      requirements: {},
      brandOrganizationId: DEMO_CAMPAIGN_BRAND_ID,
    }),
    true,
  );
});

test("ordinary, pending and suspended agencies cannot view or apply to demo campaigns", () => {
  const demo = { requirements: { demo: true } };
  for (const organization of [
    { status: "ACTIVE", metadata: {} },
    { status: "PENDING", metadata: { testWorkspaceAccess: true } },
    { status: "SUSPENDED", metadata: { testWorkspaceAccess: true } },
  ]) {
    assert.equal(
      canAccessCampaign(demo, hasApprovedTestWorkspaceAccess(organization)),
      false,
    );
    assert.equal(
      canAccessCampaign(
        { requirements: {} },
        hasApprovedTestWorkspaceAccess(organization),
      ),
      true,
    );
  }
  assert.equal(
    canAccessCampaign(
      demo,
      hasApprovedTestWorkspaceAccess({
        status: "ACTIVE",
        metadata: { testWorkspaceAccess: true },
      }),
    ),
    true,
  );
});

test("seed content is fictional, varied, dated in the future and contains no settlements or credentials", () => {
  assert.equal(demoCampaigns.length, 8);
  assert.equal(new Set(demoCampaigns.map((item) => item.key)).size, 8);
  assert.deepEqual(
    new Set(demoCampaigns.map((item) => item.currency)),
    new Set(["USD", "KRW", "CNY"]),
  );
  const applications = demoCampaigns.flatMap((item) =>
    item.application ? [item.application] : [],
  );
  assert.equal(applications.length, 4);
  assert.deepEqual(
    new Set(applications.map((item) => item.status)),
    new Set(["SUBMITTED", "SHORTLISTED", "ACCEPTED", "REJECTED"]),
  );
  for (const campaign of demoCampaigns) {
    assert.match(campaign.summary, /^Fictional demo brief\./);
    assert.ok(campaign.days >= 30);
    assert.ok(Number(campaign.budgetAmount) > 0);
    assert.ok(campaign.platforms.length > 0);
    assert.equal("settlement" in campaign, false);
    assert.equal("password" in campaign, false);
    if (campaign.application)
      assert.match(campaign.application.proposal, /^\[Demo proposal\]/);
  }
});

test("genre artwork comes only from an allowlist for known demo fixtures", () => {
  const expected = {
    "starlight-odyssey": "subculture",
    "frost-haven": "survival",
    "neon-rally": "racing",
    "cloud-garden": "cozy",
    "pixel-quest": "pixel",
    "arcane-tactics": "mmorpg",
    "moonlight-cafe": "cozy",
    "aether-arena": "mmorpg",
  };
  for (const [key, genre] of Object.entries(expected)) {
    const campaign = {
      id: `fm-demo-campaign-${key}`,
      requirements: { demo: true },
    };
    assert.equal(
      getDemoCampaignArtwork(campaign),
      `/campaign-art/${genre}.webp`,
    );
    assert.equal(
      getDemoCampaignArtwork({ ...campaign, requirements: {} }),
      null,
    );
  }
  for (const id of [
    "__proto__",
    "constructor",
    "unknown",
    "https://example.com/image.webp",
    "/campaign-art/../../secret",
  ]) {
    assert.equal(
      getDemoCampaignArtwork({
        id,
        requirements: {
          demo: true,
          coverImageUrl: "https://example.com/image.webp",
        },
      }),
      null,
    );
  }
});
