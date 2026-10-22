import assert from "node:assert/strict";
import test from "node:test";
import {
  agencyApplicationSchema,
  brandApplicationSchema,
  campaignMutationSchema,
  canSubmitCampaign,
} from "../lib/campaign-validation.ts";

const draft = {
  action: "create",
  title: "Launch",
  summary: "Produce a gameplay video",
  platforms: ["youtube"],
  currency: "USD",
  budgetAmount: "100.25",
};
test("drafts remain editable before a complete publication brief exists", () => {
  assert.equal(campaignMutationSchema.safeParse(draft).success, true);
  assert.equal(
    campaignMutationSchema.safeParse({
      ...draft,
      action: "update",
      id: "campaign-1",
    }).success,
    true,
  );
  assert.equal(
    canSubmitCampaign({ ...draft, applicationDeadline: null }),
    false,
  );
});
test("publication requires positive budget and a future deadline", () => {
  const campaign = {
    ...draft,
    applicationDeadline: new Date("2027-01-02T00:00:00Z"),
  };
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(canSubmitCampaign(campaign, now), true);
  for (const override of [
    { budgetAmount: "0" },
    { summary: " " },
    { platforms: [] },
    { applicationDeadline: now },
    { applicationDeadline: new Date("invalid") },
  ]) {
    assert.equal(canSubmitCampaign({ ...campaign, ...override }, now), false);
  }
});
test("campaign inputs cannot choose a tenant or publish themselves", () => {
  for (const override of [
    { brandOrganizationId: "another-tenant" },
    { status: "RECRUITING" },
    { action: "publish" },
    { platforms: ["youtube", "youtube"] },
    { regions: ["KR", "KR"] },
    { categories: ["unknown"] },
    { followerMin: 100, followerMax: 10 },
    { followerMin: 3_000_000_000 },
    { budgetAmount: "-1" },
    { budgetAmount: "1.001" },
    { budgetAmount: "1e3" },
  ]) {
    assert.equal(
      campaignMutationSchema.safeParse({ ...draft, ...override }).success,
      false,
    );
  }
});
test("applications only accept validated proposals, not status, currency or tenant overrides", () => {
  const input = {
    action: "apply",
    campaignId: "campaign-1",
    proposal: "We can deliver this video.",
    proposedAmount: "80.50",
  };
  assert.equal(agencyApplicationSchema.safeParse(input).success, true);
  for (const override of [
    { proposal: " " },
    { proposal: "a".repeat(5001) },
    { proposedAmount: "-5" },
    { currency: "KRW" },
    { agencyOrganizationId: "another-tenant" },
    { status: "ACCEPTED" },
  ]) {
    assert.equal(
      agencyApplicationSchema.safeParse({ ...input, ...override }).success,
      false,
    );
  }
  assert.equal(
    agencyApplicationSchema.safeParse({
      action: "withdraw",
      applicationId: "a1",
    }).success,
    true,
  );
  assert.equal(
    brandApplicationSchema.safeParse({ action: "accept", applicationId: "a1" })
      .success,
    true,
  );
  assert.equal(
    brandApplicationSchema.safeParse({ action: "paid", applicationId: "a1" })
      .success,
    false,
  );
});
