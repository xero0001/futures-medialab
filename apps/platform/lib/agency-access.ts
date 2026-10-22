import "server-only";
import { getDatabase } from "@futures-medialab/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "../app/_components/landing-copy";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile, metadataRecord } from "./agency-profile";

export async function getAuthenticatedAgencyMembership(locale: Locale) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?lang=${locale}`);
  return getDatabase().organizationMember.findFirst({
    where: { userId: session.user.id, organization: { type: "AGENCY" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: { role: true, user: { select: { name: true } }, organization: {
      select: { id: true, name: true, status: true, metadata: true },
    } },
  });
}

export async function requireAgencyWorkspace(locale: Locale): Promise<{
  organizationName: string; status: "PENDING" | "ACTIVE"; userName: string;
  agencyType: "agency" | "studio"; submittedAt: string | null;
}> {
  const membership = await getAuthenticatedAgencyMembership(locale);
  if (!membership || membership.organization.status === "SUSPENDED") redirect(`/account?lang=${locale}`);
  const { organization } = membership;
  if (!hasSubmittedAgencyProfile(organization.metadata)) {
    redirect(`/${membership.role === "OWNER" ? "onboarding/agency" : "account"}?lang=${locale}`);
  }
  const metadata = metadataRecord(organization.metadata);
  return {
    organizationName: organization.name, status: organization.status === "ACTIVE" ? "ACTIVE" : "PENDING",
    userName: membership.user.name?.trim() || organization.name,
    agencyType: metadata.agencyType === "studio" ? "studio" : "agency",
    submittedAt: typeof metadata.agencyProfileSubmittedAt === "string" ? metadata.agencyProfileSubmittedAt : null,
  };
}
