import { requestsApi } from "../../../../lib/requests-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const GET = (request: Request) => requestsApi(request);
