export type ProductionStatus =
  | "AWAITING_SUBMISSION"
  | "ADMIN_REVIEW"
  | "AGENCY_REVISION"
  | "BRAND_REVIEW"
  | "BRAND_REVISION"
  | "APPROVED";
export type ProductionBrandDecision = "APPROVE" | "REQUEST_CHANGES";
export type BrandProductionSubmission = {
  id: string;
  version: number;
  status: ProductionStatus;
  title: string;
  url: string;
  note: string;
  releasedAt: string;
  brandDecision: ProductionBrandDecision | null;
  brandMessage: string;
  brandDecidedAt: string | null;
  isLatest: boolean;
  canRespond: boolean;
  responseDisabledReason: string | null;
};
export type ProductionItemBase = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  proposalId: string;
  proposalVersion: number;
  proposalItemId: string;
  creatorName: string;
  channelUrl: string;
  channelLabel: string;
  platform: string;
  deliverables: string;
  quantity: number;
  scheduledAt: string | null;
  rights: string;
  status: ProductionStatus;
  revision: number;
  coverImageUrl: string | null;
  gameIconUrl: string | null;
  gameName: string | null;
  gameSourceUrl: string | null;
};
export type BrandProductionItem = ProductionItemBase & {
  submissions: BrandProductionSubmission[];
  latestSubmission: BrandProductionSubmission | null;
  canRespond: boolean;
  responseDisabledReason: string | null;
};
export type AgencyProductionSubmission = {
  id: string;
  version: number;
  status: ProductionStatus;
  title: string;
  url: string;
  note: string;
  submittedAt: string;
  agencyFeedback: string;
  adminReviewedAt: string | null;
  releasedTitle: string | null;
  releasedUrl: string | null;
  releasedNote: string | null;
  releasedAt: string | null;
  brandDecision: ProductionBrandDecision | null;
  brandMessage: string;
  brandDecidedAt: string | null;
};
export type AgencyProductionItem = ProductionItemBase & {
  submissions: AgencyProductionSubmission[];
  latestSubmission: AgencyProductionSubmission | null;
  canSubmit: boolean;
  submitDisabledReason: string | null;
};
export type AdminProductionSubmission = AgencyProductionSubmission & {
  internalNote: string;
};
export type AdminProductionItem = ProductionItemBase & {
  isCurrent: boolean;
  isManaged: boolean;
  canSubmit: boolean;
  submitDisabledReason: string | null;
  supplierOrganizationId: string | null;
  supplierName: string | null;
  submissions: AdminProductionSubmission[];
  latestSubmission: AdminProductionSubmission | null;
  canAssign: boolean;
  canReview: boolean;
  reviewDisabledReason: string | null;
};
export type AdminProductionResponse = {
  campaignId: string;
  campaignTitle: string;
  coverImageUrl: string | null;
  gameIconUrl: string | null;
  items: AdminProductionItem[];
  eligibleApprovedItemCount: number;
  unpreparedApprovedItemCount: number;
  suppliers: { id: string; name: string }[];
};
export type AgencyProductionResponse = {
  items: AgencyProductionItem[];
  canSubmit: boolean;
};
export type BrandProductionResponse = { items: BrandProductionItem[] };
export type AgencyProductionMutation = {
  action: "submit";
  productionItemId: string;
  expectedRevision: number;
  clientRequestId: string;
  title: string;
  url: string;
  note: string;
};
export type AdminProductionMutation =
  | (AgencyProductionMutation & { campaignId: string })
  | { action: "prepare"; campaignId: string; clientRequestId: string }
  | {
      action: "assign";
      campaignId: string;
      productionItemId: string;
      expectedRevision: number;
      clientRequestId: string;
      supplierOrganizationId: string;
    }
  | {
      action: "requestChanges";
      campaignId: string;
      productionItemId: string;
      submissionId: string;
      expectedRevision: number;
      clientRequestId: string;
      agencyFeedback: string;
      internalNote: string;
    }
  | {
      action: "releaseToBrand";
      campaignId: string;
      productionItemId: string;
      submissionId: string;
      expectedRevision: number;
      clientRequestId: string;
      title: string;
      url: string;
      note: string;
      internalNote: string;
    };
export type BrandProductionMutation = {
  action: "approve" | "requestChanges";
  productionItemId: string;
  submissionId: string;
  expectedRevision: number;
  clientRequestId: string;
  message: string;
};
