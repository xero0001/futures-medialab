import { requestsApi } from "../../../../../lib/requests-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return requestsApi(request, (await context.params).id);
}
export const POST = GET;
