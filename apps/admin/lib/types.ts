export type Organization = {
  id: string;
  name: string;
  type: string;
  status: string;
  countryCode: string | null;
  createdAt: string;
  submitted: boolean;
  testAccess: boolean;
  reviewReason: string;
  memberCount: number;
};
export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  organizations: { name: string; type: string; role: string; status: string }[];
};
export type CampaignRow = {
  id: string;
  title: string;
  summary: string;
  status: string;
  brandName: string;
  brandStatus: string;
  platforms: string[];
  currency: string;
  budgetAmount: string | null;
  applicationDeadline: string | null;
  createdAt: string;
  applicationCount: number;
  reviewReason: string;
};
export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actorName: string;
  reason: string;
};
export type Bootstrap = {
  counts: {
    users: number;
    organizations: number;
    pendingOrganizations: number;
    reviewCampaigns: number;
    recruitingCampaigns: number;
    applications: number;
  };
  users: UserRow[];
  organizations: Organization[];
  campaigns: CampaignRow[];
  audits: AuditRow[];
  limit: number;
};
export type OrganizationDetail = {
  id: string;
  name: string;
  type: string;
  status: string;
  fields: { label: string; value: string }[];
  documents: {
    id: string;
    fileName: string;
    kind: string;
    state: string;
    size: number;
    createdAt: string;
  }[];
};
export type CampaignDetail = {
  id: string;
  campaign: CampaignRow;
  summary: string;
  regions: string[];
  categories: string[];
  followerMin: number | null;
  followerMax: number | null;
  briefUrl: string | null;
  contentDeadline: string | null;
  requirements: unknown;
  settlementPolicy: unknown;
  managedRequest: unknown;
  applications: {
    id: string;
    agencyName: string;
    agencyStatus: string;
    status: string;
    proposal: string;
    proposedAmount: string | null;
    currency: string;
    createdAt: string;
    rosterSnapshot: unknown;
    creators: { id: string; name: string; channels: unknown; categories: string[]; deliverables: unknown }[];
  }[];
  total: number;
};
export type CampaignOperationsData = {
  campaignId: string;
  status: string;
  regions: string[];
  categories: string[];
  followerMin: number | null;
  followerMax: number | null;
  briefUrl: string | null;
  contentDeadline: string | null;
  requirements: unknown;
  settlementPolicy: unknown;
  managedRequest: unknown;
  totalApplications: number;
  applications: {
    id: string;
    agencyName: string;
    status: string;
    proposal: string;
    proposedAmount: string | null;
    currency: string;
    rosterSnapshot: unknown;
    creators: CampaignDetail["applications"][number]["creators"];
    submissions: { id: string; version: number; status: string; draftUrl: string | null; publishedUrl: string | null;
      reviewNotes: string; submittedAt: string | null; reviewedAt: string | null; verifiedAt: string | null; updatedAt: string }[];
    contract: { id: string; status: string; version: number; referenceUrl: string | null; notes: string; confirmedAt: string | null; updatedAt: string } | null;
    settlement: { id: string; status: string; version: number; currency: string; grossAmount: string; platformFeeAmount: string;
      withholdingAmount: string; netAmount: string; reviewNotes: string; requestedAt: string | null; approvedAt: string | null } | null;
  }[];
};
export type AdminAction =
  | "approveOrganization"
  | "requestOrganizationChanges"
  | "suspendOrganization"
  | "publishCampaign"
  | "returnCampaign"
  | "closeCampaign"
  | "revokeUserSessions";
