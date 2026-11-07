/** Supplier-visible status is derived only from the current published proposal.
 * No brand prices, notes, or proposal identifiers are included in the result. */
export function supplierRowStatus(
  row: {
    status: string;
    proposalItems?: {
      status: string;
      proposal: {
        publishedAt: Date | null;
        supersededAt: Date | null;
        expiresAt: Date | null;
        status: string;
      };
    }[];
  },
  campaignStatus: string,
  now = new Date(),
): string {
  if (row.status === "DRAFT") return "draft";
  if (row.status === "WITHDRAWN") return "withdrawn";
  if (campaignStatus === "CANCELED") return "canceled";
  const item = row.proposalItems?.find(
    ({ proposal }) =>
      proposal.publishedAt &&
      !proposal.supersededAt &&
      proposal.status !== "SUPERSEDED",
  );
  if (item) {
    if (item.status === "APPROVED") return "confirmed";
    if (item.status === "REJECTED") return "not_selected";
    if (item.proposal.expiresAt && item.proposal.expiresAt <= now)
      return "expired";
    if (item.status === "CHANGES_REQUESTED") return "review";
    return "brand_pending";
  }
  return (
    (
      {
        SUBMITTED: "received",
        SHORTLISTED: "review",
        ACCEPTED: "selected",
        REJECTED: "not_selected",
      } as Record<string, string>
    )[row.status] ?? "review"
  );
}
export function supplierApplicationStatus(
  statuses: string[],
  fallback = "received",
) {
  if (!statuses.length) return fallback;
  if (new Set(statuses).size === 1) return statuses[0]!;
  for (const value of ["brand_pending", "review", "received", "selected"])
    if (statuses.includes(value)) return value;
  return statuses.includes("confirmed") ? "partially_confirmed" : fallback;
}
