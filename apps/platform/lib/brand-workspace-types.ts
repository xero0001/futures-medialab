import type { WorkspaceAccount, WorkspaceLink } from "./workspace-types";
import type { CampaignArtwork } from "./campaign-artwork";
import type { BrandProductionItem } from "@futures-medialab/database/production-types";
import type { BrandReportingItem } from "@futures-medialab/database/reporting-types";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import type {
  BrandProposal,
  BrandProposalSummary,
} from "@futures-medialab/database/proposal-types";

export type BrandCampaignRoute = "managed" | "open";
export type BrandCompositionPreference = "balanced" | "reach" | "efficient";
export type BrandCampaignBrief = {
  genre: string;
  goal: string;
  contentFormat: string;
  creatorCount: number;
  desiredDate: string;
  note: string;
  compositionPreference: BrandCompositionPreference | null;
};
export type BrandCampaign = CampaignArtwork & {
  id: string;
  title: string;
  summary: string;
  type: "MANAGED" | "OPEN_BIDDING";
  status:
    | "DRAFT"
    | "REVIEW"
    | "RECRUITING"
    | "IN_PROGRESS"
    | "VERIFYING"
    | "SETTLING"
    | "COMPLETED"
    | "CANCELED";
  budgetAmount: string | null;
  currency: "USD" | "KRW" | "CNY";
  platforms: string[];
  regions: string[];
  categories: string[];
  applicationDeadline: string | null;
  contentDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  brief: BrandCampaignBrief | null;
  submittedAt: string | null;
  proposalDueAt: string | null;
  requestId: string | null;
  intakeStatus: string | null;
  intakeWaitingFor: "proposal-decision" | "brief" | "reply" | null;
  originalProposalDueAt: string | null;
  intakeAssigneeName: string | null;
  intakeDueAt: string | null;
  reviewNote: string | null;
  latestProposal: BrandProposalSummary | null;
  productionSummary: {
    total: number;
    awaitingSubmission: number;
    underReview: number;
    awaitingBrand: number;
    changesRequested: number;
    approved: number;
  };
  reportingSummary: {
    total: number;
    published: number;
    pending: number;
    allMetricsPending: number;
  };
  invoiceSummary: { issued: number; paid: number };
};
export type BrandRequestSummary = {
  waitingFor: "proposal-decision" | "brief" | "reply" | null;
  id: string;
  title: string;
  tool: string;
  status: string;
  campaignId: string | null;
  campaignTitle: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};
export type BrandWorkspaceCapabilities = {
  anonymousPreview: false;
  officialProposals: boolean;
  productionReview: boolean;
  campaignPerformance: boolean;
  campaignDocuments: boolean;
};
export type BrandWorkspace = {
  account: WorkspaceAccount;
  permissions: { canManageCampaigns: boolean; canEditAccount: boolean };
  campaigns: BrandCampaign[];
  requests: BrandRequestSummary[];
  links: WorkspaceLink[];
  pendingProposals: BrandProposalSummary[];
  invoices: BrandInvoice[];
  counts: {
    campaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    openRequests: number;
    waitingBrandRequests: number;
    pendingProposals: number;
    waitingContentReviews: number;
  };
  hasMoreCampaigns: boolean;
  hasMoreRequests: boolean;
  capabilities: BrandWorkspaceCapabilities;
};
export type BrandCampaignDetail = {
  campaign: BrandCampaign;
  requests: BrandRequestSummary[];
  proposals: BrandProposal[];
  deliverables: BrandProductionItem[];
  performance: { items: BrandReportingItem[] };
  invoices: BrandInvoice[];
  capabilities: BrandWorkspaceCapabilities;
};
export type BrandCampaignCreateInput = BrandCampaignBrief & {
  title: string;
  budgetAmount: string;
  currency: "USD" | "KRW" | "CNY";
  platforms: string[];
  regions: string[];
  route: BrandCampaignRoute;
  clientRequestId: string;
  applicationDeadline?: string | null;
};
export type BrandCampaignCreated = {
  originalProposalDueAt?: string | null;
  id: string;
  requestId: string;
  submittedAt: string;
  proposalDueAt: string | null;
};

export type BrandCampaignMutationInput =
  | BrandCampaignCreateInput
  | BrandCampaignDraftInput
  | {
      action: "submitDraft";
      id: string;
      expectedUpdatedAt: string;
      clientRequestId: string;
    }
  | {
      action: "cancel";
      id: string;
      expectedUpdatedAt: string;
    };
export type BrandCampaignDraftInput = Partial<BrandCampaignCreateInput> & {
  action: "saveDraft";
  title: string;
  clientRequestId: string;
  id?: string;
  expectedUpdatedAt?: string;
};
export type BrandCampaignDraftSaved = {
  id: string;
  draft: true;
  updatedAt: string;
};
