import { adminProductionMediaApi } from "../../../../../lib/production-media-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => adminProductionMediaApi(request);
