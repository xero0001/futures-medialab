import { serveCreatorImage } from "../../../../../lib/creator-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await context.params;
  return serveCreatorImage(request, id, version);
}
