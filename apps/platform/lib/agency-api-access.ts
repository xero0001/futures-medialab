import "server-only";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { getAuth } from "./auth";
import { hasSubmittedAgencyProfile } from "./agency-profile";
import { hasApprovedTestWorkspaceAccess } from "./test-workspace-access";
import { fail } from "./workspace-api";
type Tx = Prisma.TransactionClient;
type Db = Tx | ReturnType<typeof getDatabase>;
export async function authenticated(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) fail(401, "UNAUTHORIZED", "Log in to continue.");
  return session;
}

export async function liveSession(
  tx: Tx,
  session: Awaited<ReturnType<typeof authenticated>>,
) {
  if (
    !(await tx.session.findFirst({
      where: {
        id: session.session.id,
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }))
  ) {
    fail(401, "UNAUTHORIZED", "Log in to continue.");
  }
}

export async function agencyMember(db: Db, userId: string, write = false) {
  const member = await db.organizationMember.findFirst({
    where: { userId, organization: { type: "AGENCY" } },
    orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
    select: {
      role: true,
      organizationId: true,
      organization: { select: { status: true, metadata: true } },
    },
  });
  if (!member || member.organization.status === "SUSPENDED")
    fail(403, "FORBIDDEN", "This agency workspace is unavailable.");
  if (
    member.organization.status !== "ACTIVE" ||
    (!hasSubmittedAgencyProfile(member.organization.metadata) &&
      !hasApprovedTestWorkspaceAccess(member.organization))
  ) {
    fail(
      403,
      "APPROVAL_REQUIRED",
      "Your organization must be approved before viewing live campaigns.",
    );
  }
  if (write && member.role === "MEMBER")
    fail(
      403,
      "FORBIDDEN",
      "Only an owner or administrator can manage applications.",
    );
  return member;
}
