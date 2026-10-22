import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "@futures-medialab/database";
import { getAuth } from "../../../lib/auth";
import { resolveLocale } from "../../../lib/locale";
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
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect(`/login?lang=${locale}`);
  const membership = await getDatabase().organizationMember.findFirst({
    where: {
      userId: session.user.id,
      role: "OWNER",
      organization: { type: "BRAND" },
    },
    orderBy: { createdAt: "asc" },
    select: { organization: { select: { name: true, metadata: true } } },
  });
  if (!membership || hasCompletedBrandProfile(membership.organization.metadata))
    redirect(`/account?lang=${locale}`);
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
    />
  );
}
