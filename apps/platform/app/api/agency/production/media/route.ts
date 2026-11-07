import { platformProductionMediaApi } from "../../../../../lib/production-media-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => platformProductionMediaApi(request);
