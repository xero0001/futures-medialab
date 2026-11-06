import type { CampaignRow } from "./types";
export type CampaignListResponse = {
  campaigns: (CampaignRow & {
    assigneeName: string | null;
    dueAt: string | null;
    requestId: string | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
};
