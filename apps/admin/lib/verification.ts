export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
function timestamp(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}
export function submittedProfile(type: string, value: unknown): boolean {
  const metadata = record(value);
  if (type === "BRAND") return timestamp(metadata.profileCompletedAt);
  if (type !== "AGENCY" || !timestamp(metadata.agencyProfileSubmittedAt))
    return false;
  const profile = record(metadata.agencyProfile);
  if (!["agency", "studio"].includes(text(profile.agencyType))) return false;
  if (
    [
      "organizationName",
      "address",
      "countryCode",
      "establishedOn",
      "contactValue",
      "scopeOfBusiness",
      "platformContact",
      "businessDocumentId",
    ].some((key) => !text(profile[key]).trim())
  )
    return false;
  if (
    profile.agencyType === "agency" &&
    !text(profile.businessLicenseId).trim()
  )
    return false;
  return true;
}
export function reviewReason(value: unknown) {
  return text(record(record(value).adminReview).reason);
}
export function publicationProblems(
  campaign: {
    status: string;
    brandStatus: string;
    summary: string;
    platforms: string[];
    budgetAmount: string | null;
    applicationDeadline: Date | null;
  },
  now = Date.now(),
) {
  const problems: string[] = [];
  if (campaign.status !== "REVIEW")
    problems.push("검토 요청 상태의 캠페인만 공개할 수 있습니다.");
  if (campaign.brandStatus !== "ACTIVE")
    problems.push("브랜드 조직의 승인이 필요합니다.");
  if (!campaign.summary.trim() || !campaign.platforms.length)
    problems.push("캠페인 요약과 플랫폼이 필요합니다.");
  if (
    !campaign.budgetAmount ||
    !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(campaign.budgetAmount) ||
    Number(campaign.budgetAmount) <= 0
  )
    problems.push("0보다 큰 예산이 필요합니다.");
  if (
    !campaign.applicationDeadline ||
    campaign.applicationDeadline.getTime() <= now ||
    !Number.isFinite(campaign.applicationDeadline.getTime())
  )
    problems.push("신청 마감일이 현재보다 이후여야 합니다.");
  return problems;
}
