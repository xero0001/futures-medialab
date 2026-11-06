export type AdminCampaignSection =
  | "overview"
  | "sourcing"
  | "proposal"
  | "production"
  | "reporting"
  | "documents"
  | "settlement";
export const operationKinds = [
  "request",
  "proposal",
  "recruitment",
  "production",
  "reporting",
  "settlement",
  "invoice",
  "payout",
] as const;
export type OperationKind = (typeof operationKinds)[number];
export const operationKindLabels: Record<OperationKind, string> = {
  request: "접수·회신",
  proposal: "공식 제안",
  recruitment: "모집 마감",
  production: "제작 검수",
  reporting: "성과 검토",
  settlement: "완료·발행",
  invoice: "브랜드 미입금",
  payout: "파트너 미지급",
};
export type OperationTask = {
  id: string;
  kind: OperationKind;
  title: string;
  description: string;
  campaignId: string | null;
  campaignTitle: string | null;
  brandName: string;
  requestId: string | null;
  section: AdminCampaignSection;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  deadlineLabel: string;
  updatedAt: string;
};
export type OperationsResponse = {
  items: OperationTask[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  counts: {
    total: number;
    mine: number;
    unassigned: number;
    overdue: number;
    soon: number;
    byKind: Record<OperationKind, number>;
  };
  asOf: string;
};
export type AdminDocumentKind =
  "proposal" | "report" | "invoice" | "payout" | "attachment";
export type AdminCampaignDocument = {
  id: string;
  kind: AdminDocumentKind;
  title: string;
  status: string;
  version: number | null;
  scope: "internal" | "brand" | "partner";
  recipient: string;
  sharedAt: string | null;
  updatedAt: string;
  isLatest: boolean;
  section: AdminCampaignSection;
  requestId: string | null;
  file: { url: string; name: string } | null;
  details: { label: string; value: string }[];
};
export type AdminCampaignDocumentsResponse = {
  campaignId: string;
  campaignTitle: string;
  documents: AdminCampaignDocument[];
  hasMore: boolean;
  perKindLimit: number;
};
