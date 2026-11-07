import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/);
export const sourcingMutationSchema = z.strictObject({
  campaignId: id,
  applicationId: id,
  rowId: id.optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["SHORTLISTED", "ACCEPTED", "REJECTED"]),
  reason: z.string().trim().min(2).max(1000),
});
export function canReviewSourcing(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    SUBMITTED: ["SHORTLISTED", "REJECTED"],
    SHORTLISTED: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["SHORTLISTED", "REJECTED"],
    REJECTED: ["SHORTLISTED"],
  };
  return transitions[from]?.includes(to) ?? false;
}
export function sourcingLockReason(input: {
  campaignStatus: string;
  brandActive: boolean;
  applicationStatus: string;
  hasWork: boolean;
}) {
  if (!["REVIEW", "RECRUITING", "IN_PROGRESS"].includes(input.campaignStatus))
    return "현재 캠페인 단계에서는 후보를 변경할 수 없습니다.";
  if (!input.brandActive) return "브랜드 조직의 승인이 필요합니다.";
  if (input.applicationStatus === "WITHDRAWN")
    return "철회된 신청은 변경할 수 없습니다.";
  if (input.hasWork)
    return "공개 제안·제작·계약·정산에 연결된 신청입니다. 기존 수행 기록을 보존합니다.";
  return null;
}
