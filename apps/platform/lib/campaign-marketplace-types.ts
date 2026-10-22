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
  isDemo: boolean;
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
  isDemo: boolean;
  application: AgencyApplication | null;
};

export type AgencyCampaignBootstrap = {
  campaigns: AgencyCampaign[];
  applications: AgencyApplication[];
  account: { role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "PENDING" };
};

export type BrandCampaignApplication = Omit<
  AgencyApplication,
  "campaignTitle" | "campaignStatus" | "isDemo"
> & {
  agencyLabel: string;
};
