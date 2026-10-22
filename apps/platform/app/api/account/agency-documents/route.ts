import { allocateAgencyDocument, listAgencyDocuments } from "../../../../lib/agency-documents";

export const runtime = "nodejs";
export const preferredRegion = "sin1";
export const GET = listAgencyDocuments;
export const POST = allocateAgencyDocument;
