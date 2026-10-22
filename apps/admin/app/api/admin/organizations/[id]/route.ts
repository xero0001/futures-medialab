import { organizationDetail } from "../../../../../lib/admin-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return organizationDetail(request, (await context.params).id);
}
