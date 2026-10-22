export type AgencyApplication = {
  id: string;
  campaignId: string;
  status: string;
  proposal: string;
  proposedAmount: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  campaignTitle: string;
  campaignStatus: string;
};

export type AgencyCampaign = {
  id: string;
  title: string;
  summary: string;
  platforms: string[];
  regions: string[];
  categories: string[];
  followerMin: number | null;
  followerMax: number | null;
  budgetAmount: string | null;
  currency: string;
  applicationDeadline: string | null;
  publishedAt: string | null;
  status: string;
  application: AgencyApplication | null;
};

export type AgencyCampaignBootstrap = {
  campaigns: AgencyCampaign[];
  applications: AgencyApplication[];
  account: { role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "PENDING" };
};

export type BrandCampaignApplication = Omit<
  AgencyApplication,
  "campaignTitle" | "campaignStatus"
> & {
  agencyLabel: string;
};
