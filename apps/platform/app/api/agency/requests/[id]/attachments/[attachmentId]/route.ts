import { agencyRequestsApi } from "../../../../../../../lib/agency-requests-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await context.params;
  return agencyRequestsApi(request, id, attachmentId);
}
export const DELETE = GET;
