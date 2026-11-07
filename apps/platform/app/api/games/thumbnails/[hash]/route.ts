import { platformGameThumbnail } from "../../../../../lib/game-thumbnail-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export async function GET(
  request: Request,
  context: { params: Promise<{ hash: string }> },
) {
  return platformGameThumbnail(request, (await context.params).hash);
}
