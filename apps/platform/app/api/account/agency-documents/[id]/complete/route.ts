import { completeAgencyDocument } from "../../../../../../lib/agency-documents";

export const runtime = "nodejs";
export const preferredRegion = "sin1";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return completeAgencyDocument(request, (await params).id);
}
