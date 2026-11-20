import type { BrandProposal } from "@futures-medialab/database/proposal-types";
import type { Locale } from "../../_components/landing-copy";
import { StatusBadge, type StatusTone } from "../../_components/workspace/status-badge";

const proposalStates = {
  PUBLISHED: { tone: "amber", ko: "승인 대기", en: "Awaiting approval", zh: "待审批" },
  APPROVED: { tone: "green", ko: "승인 완료", en: "Approved", zh: "已批准" },
  CHANGES_REQUESTED: { tone: "amber", ko: "수정 요청", en: "Changes requested", zh: "已请求修改" },
  REJECTED: { tone: "red", ko: "재제안 요청", en: "Replacement requested", zh: "已请求重新提案" },
  SUPERSEDED: { tone: "neutral", ko: "이전 버전", en: "Previous version", zh: "历史版本" },
} satisfies Record<BrandProposal["status"], Record<Locale, string> & { tone: StatusTone }>;

export function proposalStatusLabel(status: BrandProposal["status"], locale: Locale) {
  return proposalStates[status][locale];
}

export function BrandProposalStatusBadge({ status, locale }: { status: BrandProposal["status"]; locale: Locale }) {
  return <StatusBadge tone={proposalStates[status].tone}>{proposalStatusLabel(status, locale)}</StatusBadge>;
}
