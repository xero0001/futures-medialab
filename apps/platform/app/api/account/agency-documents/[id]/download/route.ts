import { downloadAgencyDocument } from "../../../../../../lib/agency-documents";

export const runtime = "nodejs";
export const preferredRegion = "sin1";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return downloadAgencyDocument(request, (await params).id);
}
