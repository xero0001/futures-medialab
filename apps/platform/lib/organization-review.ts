export function organizationReviewReason(
  metadata: unknown,
): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return;
  const review = (metadata as Record<string, unknown>).adminReview;
  if (!review || typeof review !== "object" || Array.isArray(review)) return;
  const value = review as Record<string, unknown>;
  return value.status === "CHANGES_REQUESTED" &&
    typeof value.reason === "string"
    ? value.reason
    : undefined;
}
