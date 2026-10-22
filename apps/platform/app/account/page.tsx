import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "@futures-medialab/database";
import { getAuth } from "../../lib/auth";
import { hasCompletedBrandProfile } from "../../lib/brand-profile";
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
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) redirect(`/login?lang=${locale}`);

  const ownedBrand = user.memberships.find(
    (membership) =>
      membership.role === "OWNER" && membership.organization.type === "BRAND",
  );
  if (
    ownedBrand &&
    !hasCompletedBrandProfile(ownedBrand.organization.metadata)
  ) {
    redirect(`/onboarding/brand?lang=${locale}`);
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
