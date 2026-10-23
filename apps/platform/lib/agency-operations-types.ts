export type AgencyContentSubmission = {
  id: string;
  version: number;
  status: string;
  draftUrl: string | null;
  publishedUrl: string | null;
  reviewNotes: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string;
};

export type AgencyProject = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignStatus: string;
  platforms: string[];
  contentDeadline: string | null;
  proposedAmount: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  creators: {
    id: string;
    displayName: string;
    countryCode: string | null;
    isActive: boolean;
  }[];
  /** Latest five application-level versions, newest first; not per-creator tasks. */
  submissions: AgencyContentSubmission[];
};

export type AgencySettlement = {
  id: string;
  applicationId: string;
  campaignTitle: string;
  status: string;
  currency: string;
  grossAmount: string;
  platformFeeAmount: string;
  withholdingAmount: string;
  netAmount: string;
  createdAt: string;
  updatedAt: string;
  requestedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  isDemo: boolean;
};

export type AgencyActivity = {
  id: string;
  kind: "application_created" | "application_status" | "submission_status" | "settlement_status" | "organization_review";
  entityId: string;
  campaignTitle: string | null;
  /** Empty for creation records because status-at-creation history is not stored. */
  status: string;
  occurredAt: string;
  isDemo: boolean;
};

export type AgencyOperationsBootstrap = {
  organization: {
    name: string;
    agencyType: "agency" | "studio";
    status: "ACTIVE";
    role: "OWNER" | "ADMIN" | "MEMBER";
    countryCode: string | null;
    submittedAt: string | null;
    isTestWorkspace: boolean;
    profile: {
      address: string;
      establishedOn: string;
      contactName: string;
      contactMethod: "email" | "phone" | "wechat";
      contactValue: string;
      businessLicenseId: string;
      scopeOfBusiness: string;
      platformContact: string;
    };
  };
  projects: AgencyProject[];
  settlements: AgencySettlement[];
  /** Derived from current records, not a complete event history or read/unread inbox. */
  activity: AgencyActivity[];
  capabilities: {
    invitations: false;
    payouts: false;
    contentSubmission: false;
    activityHistory: false;
  };
  limits: { projects: number; settlements: number; activity: number };
};
