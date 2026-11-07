import type { CampaignRow } from "./types";
export type CampaignListResponse = {
  campaigns: (CampaignRow & {
    gameName: string | null;
    gameIconUrl: string | null;
    assigneeName: string | null;
    dueAt: string | null;
    requestId: string | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
};
