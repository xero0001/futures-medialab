import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedBrandMembership } from "../../../lib/brand-access";
import { resolveLocale } from "../../../lib/locale";
import { hasApprovedTestWorkspaceAccess } from "../../../lib/test-workspace-access";
import { organizationReviewReason } from "../../../lib/organization-review";
import {
  BRAND_COMPANY_SIZES,
  hasCompletedBrandProfile,
} from "../../../lib/brand-profile";
import { BrandOnboarding } from "./brand-onboarding";

export const preferredRegion = "sin1";

export const metadata: Metadata = {
  title: "Company profile — Futures Medialab",
  robots: { index: false, follow: false },
};

export default async function BrandOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [query, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
  ]);
  const locale = resolveLocale(
    query.lang,
    cookieStore.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
  const membership = await getAuthenticatedBrandMembership(locale);
  if (!membership || membership.organization.status === "SUSPENDED")
    redirect(`/account?lang=${locale}`);
  if (hasCompletedBrandProfile(membership.organization.metadata) || hasApprovedTestWorkspaceAccess(membership.organization))
    redirect(`${membership.organization.status === "ACTIVE" ? "/storage/search" : "/account"}?lang=${locale}`);
  if (membership.role !== "OWNER") redirect(`/account?lang=${locale}`);
  const metadata = membership.organization.metadata;
  const savedSize =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata.companySize
      : undefined;
  const companySize =
    typeof savedSize === "string" &&
    BRAND_COMPANY_SIZES.some((size) => size === savedSize)
      ? savedSize
      : "";
  return (
    <BrandOnboarding
      initialLocale={locale}
      initialCompanyName={membership.organization.name}
      initialCompanySize={companySize}
      reviewReason={organizationReviewReason(metadata)}
    />
  );
}
