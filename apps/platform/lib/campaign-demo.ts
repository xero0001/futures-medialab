/** Reserved fixture namespace. Demo records never represent a paying advertiser. */
export const DEMO_CAMPAIGN_BRAND_ID = "fm-demo-brand-agency-v1";
export const DEMO_CAMPAIGN_SEED = "agency-workspace-v1";

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
