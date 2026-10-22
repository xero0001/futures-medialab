import "server-only";

import { getDatabase } from "@futures-medialab/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "../app/_components/landing-copy";
import { getAuth } from "./auth";
import { hasCompletedBrandProfile } from "./brand-profile";
import { getAuthenticatedAgencyMembership } from "./agency-access";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";

// Membership and organization state are read for every request. A session or
// client-selected role alone never grants access to a brand workspace.
export async function getAuthenticatedBrandMembership(locale: Locale) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?lang=${locale}`);

  return getDatabase().organizationMember.findFirst({
    where: { userId: session.user.id, organization: { type: "BRAND" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: {
      role: true,
      user: { select: { name: true } },
      organization: {
        select: { name: true, status: true, metadata: true },
      },
    },
  });
}

type BrandMembership = Awaited<
  ReturnType<typeof getAuthenticatedBrandMembership>
>;

function brandDestination(membership: BrandMembership) {
  if (!membership || membership.organization.status === "SUSPENDED")
    return "/account";
  if (!hasCompletedBrandProfile(membership.organization.metadata) && !hasApprovedTestWorkspaceAccess(membership.organization))
    return membership.role === "OWNER" ? "/onboarding/brand" : "/account";
  return "/storage/search";
}

export async function getPostAuthDestination(locale: Locale, options: { registered?: boolean } = {}) {
  const membership = await getAuthenticatedBrandMembership(locale);
  if (membership) return `${brandDestination(membership)}?lang=${locale}`;
  const agency = await getAuthenticatedAgencyMembership(locale);
  if (!agency || agency.organization.status === "SUSPENDED") return `/account?lang=${locale}`;
  if (hasApprovedTestWorkspaceAccess(agency.organization)) return `/agency?lang=${locale}`;
  if (hasSubmittedAgencyProfile(agency.organization.metadata))
    return `${agency.organization.status === "ACTIVE" || agency.role !== "OWNER" ? "/agency" : "/onboarding/agency"}?lang=${locale}`;
  return agency.role === "OWNER"
    ? `/onboarding/agency?lang=${locale}${options.registered ? "&welcome=1" : ""}`
    : `/account?lang=${locale}`;
}

export async function requireBrandWorkspace(locale: Locale): Promise<{
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
}> {
  const membership = await getAuthenticatedBrandMembership(locale);
  const destination = brandDestination(membership);
  if (destination !== "/storage/search")
    redirect(`${destination}?lang=${locale}`);

  // Keep the type narrowing explicit and fail closed if the state changes.
  if (!membership || membership.organization.status === "SUSPENDED")
    redirect(`/account?lang=${locale}`);

  return {
    organizationName: membership.organization.name,
    status: membership.organization.status,
    userName: membership.user.name?.trim() || membership.organization.name,
  };
}
