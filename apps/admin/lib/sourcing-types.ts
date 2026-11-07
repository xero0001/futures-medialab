export type AdminSourcingData = {
  campaignId: string;
  total: number;
  applications: {
    id: string;
    rowId?: string;
    agencyName: string;
    agencyActive: boolean;
    status: string;
    proposal: string;
    amount: string | null;
    currency: string;
    updatedAt: string;
    lockReason: string | null;
    reviewReason: string;
    creators: {
      id: string;
      name: string;
      active: boolean;
      categories: string[];
      channels: {
        platform: string;
        label: string;
        url: string | null;
        followers: number | null;
      }[];
      deliverables: string;
    }[];
  }[];
};
