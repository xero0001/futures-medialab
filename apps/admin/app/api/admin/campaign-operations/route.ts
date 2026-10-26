import { campaignOperations, mutateCampaignOperations } from "../../../../lib/campaign-operations";

// Shared access boundary records unexpected failures without sensitive payloads.
export const GET = campaignOperations;
export const POST = mutateCampaignOperations;
