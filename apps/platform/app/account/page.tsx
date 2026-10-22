import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "@futures-medialab/database";
import { getAuth } from "../../lib/auth";
import { hasCompletedBrandProfile } from "../../lib/brand-profile";
import { hasSubmittedAgencyProfile } from "../../lib/agency-profile";
import { resolveLocale } from "../../lib/locale";
import { AccountPanel } from "./account-panel";

export const preferredRegion = "sin1";

export const metadata: Metadata = {
  title: "Your account — Futures Medialab",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
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

  const user = await getDatabase().user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              metadata: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
      },
    },
  });
  if (!user) redirect(`/login?lang=${locale}`);

  const brand = user.memberships.find(
    (membership) => membership.organization.type === "BRAND",
  );
  if (
    brand?.role === "OWNER" &&
    brand.organization.status !== "SUSPENDED" &&
    !hasCompletedBrandProfile(brand.organization.metadata)
  ) {
    redirect(`/onboarding/brand?lang=${locale}`);
  }

  const agency = !brand && user.memberships.find(({ organization }) => organization.type === "AGENCY");
  if (agency && agency.role === "OWNER" && agency.organization.status !== "SUSPENDED") {
    redirect(`${hasSubmittedAgencyProfile(agency.organization.metadata) && agency.organization.status === "ACTIVE" ? "/agency" : "/onboarding/agency"}?lang=${locale}`);
  }

  return (
    <AccountPanel
      initialLocale={locale}
      email={user.email}
      organizations={user.memberships.map(({ organization }) => ({
        id: organization.id,
        name: organization.name,
        type: organization.type,
        status: organization.status,
      }))}
    />
  );
}
