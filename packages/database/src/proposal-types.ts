export type ProposalStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "SUPERSEDED";
export type ProposalItemStatus =
  "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
export type ProposalDecisionKind = "APPROVE" | "REQUEST_CHANGES" | "REJECT";
export type ProposalItemInput = {
  creatorId: string | null;
  creatorName: string;
  platform: string;
  channelLabel: string;
  channelUrl: string;
  followers: number | null;
  averageViews: number | null;
  deliverables: string;
  quantity: number;
  unitAmount: string;
  scheduledAt: string | null;
  rights: string;
  supplierCost: string | null;
  internalNotes: string;
};
export type ProposalDraftInput = {
  title: string;
  summary: string;
  changeSummary: string;
  terms: string;
  expiresAt: string | null;
  items: ProposalItemInput[];
};
export type BrandProposalItem = {
  id: string;
  creatorName: string;
  platform: string;
  channelLabel: string;
  channelUrl: string;
  followers: number | null;
  averageViews: number | null;
  deliverables: string;
  quantity: number;
  unitAmount: string;
  totalAmount: string;
  scheduledAt: string | null;
  rights: string;
  status: ProposalItemStatus;
};
export type BrandProposalDecision = {
  id: string;
  decision: ProposalDecisionKind;
  itemIds: string[];
  message: string;
  createdAt: string;
};
export type BrandProposal = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  version: number;
  revision: number;
  status: Exclude<ProposalStatus, "DRAFT">;
  title: string;
  summary: string;
  changeSummary: string;
  terms: string;
  currency: "USD" | "KRW" | "CNY";
  totalAmount: string;
  publishedAt: string;
  expiresAt: string | null;
  isLatest: boolean;
  canRespond: boolean;
  responseDisabledReason: string | null;
  items: BrandProposalItem[];
  decisions: BrandProposalDecision[];
};
export type BrandProposalSummary = Pick<
  BrandProposal,
  | "id"
  | "campaignId"
  | "campaignTitle"
  | "version"
  | "revision"
  | "status"
  | "title"
  | "publishedAt"
  | "expiresAt"
  | "totalAmount"
  | "currency"
  | "canRespond"
> & { pendingItemCount: number };
export type AdminProposalItem = BrandProposalItem & {
  creatorId: string | null;
  supplierOrganizationId: string | null;
  supplierCost: string | null;
  internalNotes: string;
};
export type AdminProposal = Omit<
  BrandProposal,
  "status" | "publishedAt" | "items" | "canRespond" | "responseDisabledReason"
> & {
  status: ProposalStatus;
  publishedAt: string | null;
  items: AdminProposalItem[];
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canPublish: boolean;
  publishProblems: string[];
};
export type AdminProposalCreatorOption = {
  id: string;
  displayName: string;
  agencyName: string;
  channels: {
    platform: string;
    name: string;
    url: string;
    followers: number | null;
  }[];
};
export type AdminProposalsResponse = {
  campaign: {
    id: string;
    title: string;
    type: string;
    status: string;
    currency: "USD" | "KRW" | "CNY";
    budgetAmount: string | null;
    brandActive: boolean;
  };
  proposals: AdminProposal[];
  creators: AdminProposalCreatorOption[];
};
export type AdminProposalMutation =
  | {
      action: "createDraft";
      campaignId: string;
      clientRequestId: string;
      sourceProposalId?: string;
    }
  | {
      action: "saveDraft";
      campaignId: string;
      proposalId: string;
      expectedRevision: number;
      clientRequestId: string;
      data: ProposalDraftInput;
    }
  | {
      action: "publish";
      campaignId: string;
      proposalId: string;
      expectedRevision: number;
      clientRequestId: string;
    };
export type BrandProposalMutation = {
  action: "decide";
  proposalId: string;
  expectedRevision: number;
  clientRequestId: string;
  decision: ProposalDecisionKind;
  itemIds: string[];
  message: string;
};
