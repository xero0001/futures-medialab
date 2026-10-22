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
  summary: string;
  applications: {
    id: string;
    agencyName: string;
    agencyStatus: string;
    status: string;
    proposal: string;
    proposedAmount: string | null;
    currency: string;
    createdAt: string;
  }[];
  total: number;
};
export type AdminAction =
  | "approveOrganization"
  | "requestOrganizationChanges"
  | "suspendOrganization"
  | "publishCampaign"
  | "returnCampaign"
  | "closeCampaign"
  | "revokeUserSessions";
