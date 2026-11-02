export type AgencyProjectStage =
  "production" | "reporting" | "settlement" | "records";

/** One shared campaign, restricted to this agency's assigned work. No prices. */
export type AgencyAssignedCampaign = {
  campaignId: string;
  campaignTitle: string;
  campaignStatus: string;
  campaignType: "OPEN_BIDDING" | "MANAGED";
  platforms: string[];
  contentDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  isClosed: boolean;
  gameName: string | null;
  coverImageUrl: string | null;
  gameIconUrl: string | null;
  gameSourceUrl: string | null;
  assignment: {
    acceptedApplication: boolean;
    /** Current published proposal items: final production assignee, or initial supplier before preparation. */
    officialProposalItems: number;
    production: boolean;
  };
  production: {
    /** Includes this agency's historical published-proposal tasks. */
    total: number;
    /** All other counters cover only the current approved proposal's approved items. */
    current: number;
    awaitingSubmission: number;
    underReview: number;
    changesRequested: number;
    approved: number;
  };
  reporting: {
    total: number;
    /** Status counters and publicReports cover current approved production only. */
    current: number;
    awaitingSubmission: number;
    underReview: number;
    changesRequested: number;
    published: number;
    /** Retains the last public report while a newer update is being reviewed. */
    publicReports: number;
  };
  /** Unissued payout drafts never affect these counts or available stages. */
  settlement: { issued: number; paid: number };
  /** Read destinations, including history on closed campaigns; not mutation permission. */
  availableStages: AgencyProjectStage[];
};

export type AgencyProjectsResponse = {
  organization: {
    name: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    isTestWorkspace: boolean;
  };
  projects: AgencyAssignedCampaign[];
  limits: { projects: number };
  hasMore: boolean;
};
