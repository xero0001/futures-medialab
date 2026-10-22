/** Reserved fixture namespace. Demo records never represent a paying advertiser. */
export const DEMO_CAMPAIGN_BRAND_ID = "fm-demo-brand-agency-v1";
export const DEMO_CAMPAIGN_SEED = "agency-workspace-v1";

const demoArtwork = {
  "fm-demo-campaign-starlight-odyssey": "/campaign-art/subculture.webp",
  "fm-demo-campaign-frost-haven": "/campaign-art/survival.webp",
  "fm-demo-campaign-neon-rally": "/campaign-art/racing.webp",
  "fm-demo-campaign-cloud-garden": "/campaign-art/cozy.webp",
  "fm-demo-campaign-pixel-quest": "/campaign-art/pixel.webp",
  "fm-demo-campaign-arcane-tactics": "/campaign-art/mmorpg.webp",
  "fm-demo-campaign-moonlight-cafe": "/campaign-art/cozy.webp",
  "fm-demo-campaign-aether-arena": "/campaign-art/mmorpg.webp",
} as const;

/** Only known demo fixtures receive our original artwork, never caller URLs. */
export function getDemoCampaignArtwork(campaign: {
  id: string;
  brandOrganizationId?: string;
  requirements: unknown;
}): (typeof demoArtwork)[keyof typeof demoArtwork] | null {
  if (!isDemoCampaign(campaign) || !Object.hasOwn(demoArtwork, campaign.id))
    return null;
  return demoArtwork[campaign.id as keyof typeof demoArtwork];
}

export function isDemoCampaign(campaign: {
  brandOrganizationId?: string;
  requirements: unknown;
}): boolean {
  if (campaign.brandOrganizationId === DEMO_CAMPAIGN_BRAND_ID) return true;
  const value = campaign.requirements;
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "demo") &&
    (value as Record<string, unknown>).demo === true
  );
}

export function canAccessCampaign(
  campaign: { brandOrganizationId?: string; requirements: unknown },
  approvedTestAccess: boolean,
): boolean {
  return !isDemoCampaign(campaign) || approvedTestAccess;
}
