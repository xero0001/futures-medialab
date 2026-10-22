/**
 * An explicit, server-managed exemption for approved test organizations.
 * Public registration/profile input must never be allowed to set this flag.
 * It grants workspace access only; it does not verify email, company details,
 * or uploaded documents, and it does not replace role or tenant checks.
 */
export function hasApprovedTestWorkspaceAccess(organization: {
  status: string;
  metadata: unknown;
}): boolean {
  if (organization.status !== "ACTIVE") return false;

  const metadata = organization.metadata;
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata))
    return false;

  const prototype = Object.getPrototypeOf(metadata);
  if (prototype !== Object.prototype && prototype !== null) return false;

  return (
    Object.hasOwn(metadata, "testWorkspaceAccess") &&
    (metadata as Record<string, unknown>).testWorkspaceAccess === true
  );
}
