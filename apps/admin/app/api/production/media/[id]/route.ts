import { adminProductionMediaApi } from "../../../../../lib/production-media-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return adminProductionMediaApi(request, (await context.params).id); }
