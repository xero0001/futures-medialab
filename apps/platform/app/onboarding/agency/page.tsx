import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedAgencyMembership } from "../../../lib/agency-access";
import { getAgencyProfileValues, hasSubmittedAgencyProfile } from "../../../lib/agency-profile";
import { uploadConfigured } from "../../../lib/agency-documents";
import { resolveLocale } from "../../../lib/locale";
import { hasApprovedTestWorkspaceAccess } from "../../../lib/test-workspace-access";
import { AgencyOnboarding } from "./agency-onboarding";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Agency / Studio Information — Futures Medialab",
  robots: { index: false, follow: false },
};
export default async function AgencyOnboardingPage({ searchParams }: {
  searchParams: Promise<{ lang?: string; welcome?: string }>;
}) {
  const [query, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const locale = resolveLocale(query.lang, cookieStore.get("fm-locale")?.value, requestHeaders.get("accept-language"));
  const membership = await getAuthenticatedAgencyMembership(locale);
  if (!membership || membership.role !== "OWNER" || membership.organization.status === "SUSPENDED") redirect(`/account?lang=${locale}`);
  const { organization } = membership;
  if (hasApprovedTestWorkspaceAccess(organization)) redirect(`/agency?lang=${locale}`);
  const submitted = hasSubmittedAgencyProfile(organization.metadata);
  return <AgencyOnboarding
    initialLocale={locale}
    initialValues={getAgencyProfileValues(organization.name, organization.metadata)}
    initialStatus={submitted ? "SUBMITTED" : "DRAFT"}
    organizationStatus={organization.status === "ACTIVE" ? "ACTIVE" : "PENDING"}
    showWelcome={!submitted && query.welcome === "1"}
    uploadEnabled={uploadConfigured()}
  />;
}
