import type { Creator, DemoBrand } from "./creator-directory";

export type WorkspaceCollection = {
  id: string;
  name: string;
  creatorIds: string[];
};
export type WorkspaceLink = {
  id: string;
  code: string;
  title: string;
  targetUrl: string;
  active: boolean;
  clickCount: number;
  createdAt: string;
};
export type WorkspaceCampaign = {
  id: string;
  title: string;
  summary: string;
  platforms: string[];
  currency: string;
  budgetAmount: string | null;
  status: string;
  createdAt: string;
};
export type WorkspaceRequest = {
  id: string;
  tool: string;
  title: string;
  input: string;
  status: string;
  createdAt: string;
};
export type WorkspaceAccount = {
  name: string;
  email: string;
  countryCode: string | null;
  websiteUrl: string | null;
  contactName: string;
  industry: string;
  companySize: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE";
};
export type WorkspaceBootstrap = {
  creators: Creator[];
  brands: DemoBrand[];
  collections: WorkspaceCollection[];
  links: WorkspaceLink[];
  campaigns: WorkspaceCampaign[];
  requests: WorkspaceRequest[];
  recentSearches: {
    id: string;
    mode: string;
    query: string;
    createdAt: string;
  }[];
  account: WorkspaceAccount;
};
export type WorkspaceSearchResult = {
  creators: Creator[];
  seed: Creator | null;
  brands: DemoBrand[];
  searchId: string;
};
