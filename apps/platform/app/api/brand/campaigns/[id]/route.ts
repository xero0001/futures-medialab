import { brandCampaignDetail } from "../../../../../lib/brand-workspace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return brandCampaignDetail(request, (await context.params).id);
}
