import type { ProductionItemBase } from "@futures-medialab/database/production-types";

export type ReportingStatus =
  "AWAITING_SUBMISSION" | "ADMIN_REVIEW" | "AGENCY_REVISION" | "PUBLISHED";
export type ReportingMetrics = {
  views: number | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
};
/** null means unreported/collecting; zero is an explicitly reported zero. */
export type ReportingSnapshot = {
  title: string;
  postUrl: string;
  publishedAt: string;
  metricsAsOf: string | null;
  metrics: ReportingMetrics;
  evidenceUrl: string | null;
  note: string;
};
export type ReportingItemBase = Omit<
  ProductionItemBase,
  "id" | "status" | "revision"
> & {
  id: string;
  productionItemId: string;
  status: ReportingStatus;
  revision: number;
  isCurrent: boolean;
};
export type BrandReportingSubmission = ReportingSnapshot & {
  id: string;
  version: number;
  releasedAt: string;
  isLatest: boolean;
};
export type BrandReportingItem = ReportingItemBase & {
  submissions: BrandReportingSubmission[];
  latestSubmission: BrandReportingSubmission | null;
};
export type AgencyReportingSubmission = ReportingSnapshot & {
  id: string;
  version: number;
  status: ReportingStatus;
  submittedAt: string;
  agencyFeedback: string;
  adminReviewedAt: string | null;
  releasedSnapshot: ReportingSnapshot | null;
  releasedAt: string | null;
};
export type AgencyReportingItem = ReportingItemBase & {
  submissions: AgencyReportingSubmission[];
  latestSubmission: AgencyReportingSubmission | null;
  canSubmit: boolean;
  submitDisabledReason: string | null;
};
export type AdminReportingSubmission = AgencyReportingSubmission & {
  internalNote: string;
};
export type AdminReportingItem = ReportingItemBase & {
  supplierOrganizationId: string | null;
  supplierName: string | null;
  submissions: AdminReportingSubmission[];
  latestSubmission: AdminReportingSubmission | null;
  canReview: boolean;
  reviewDisabledReason: string | null;
};
export type AgencyReportingResponse = {
  items: AgencyReportingItem[];
  canSubmit: boolean;
};
export type BrandReportingResponse = { items: BrandReportingItem[] };
export type AdminReportingResponse = {
  campaignId: string;
  campaignTitle: string;
  coverImageUrl: string | null;
  gameIconUrl: string | null;
  eligibleApprovedItemCount: number;
  unpreparedApprovedItemCount: number;
  items: AdminReportingItem[];
};
export type AgencyReportingMutation = {
  action: "submit";
  reportingItemId: string;
  expectedRevision: number;
  clientRequestId: string;
  data: ReportingSnapshot;
};
export type AdminReportingMutation =
  | { action: "prepare"; campaignId: string; clientRequestId: string }
  | {
      action: "requestChanges";
      campaignId: string;
      reportingItemId: string;
      submissionId: string;
      expectedRevision: number;
      clientRequestId: string;
      agencyFeedback: string;
      internalNote: string;
    }
  | {
      action: "releaseToBrand";
      campaignId: string;
      reportingItemId: string;
      submissionId: string;
      expectedRevision: number;
      clientRequestId: string;
      data: ReportingSnapshot;
      internalNote: string;
    };
