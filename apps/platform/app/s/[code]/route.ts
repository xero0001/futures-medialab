import { getDatabase } from "@futures-medialab/database";
import {
  safeExternalUrl,
  workspaceBoundary,
  workspaceHeaders,
} from "../../../lib/workspace-api";

export const preferredRegion = "sin1";
export const dynamic = "force-dynamic";

async function resolveLink(code: string, countVisit: boolean) {
  return workspaceBoundary(async () => {
    if (!/^[a-zA-Z0-9_-]{12}$/.test(code))
      return new Response(null, { status: 404, headers: workspaceHeaders });
    const db = getDatabase();
    const link = await db.shortLink.findFirst({
      where: {
        code,
        active: true,
        organization: { status: { not: "SUSPENDED" } },
      },
      select: { id: true, targetUrl: true },
    });
    const target = link && safeExternalUrl(link.targetUrl);
    if (!link || !target)
      return new Response(null, { status: 404, headers: workspaceHeaders });
    if (countVisit) {
      // Recheck active/status atomically: a disabled link must not keep counting.
      const updated = await db.shortLink.updateMany({
        where: {
          id: link.id,
          active: true,
          organization: { status: { not: "SUSPENDED" } },
        },
        data: { clickCount: { increment: 1 } },
      });
      if (!updated.count)
        return new Response(null, { status: 404, headers: workspaceHeaders });
    }
    // No URL is fetched server-side, and HEAD/preview checks never count as clicks.
    return new Response(null, {
      status: 302,
      headers: {
        ...workspaceHeaders,
        Location: target,
        "Referrer-Policy": "no-referrer",
      },
    });
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  return resolveLink((await context.params).code, true);
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  return resolveLink((await context.params).code, false);
}
