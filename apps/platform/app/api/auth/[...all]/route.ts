import { toNextJsHandler } from "better-auth/next-js";
import { allowsPlatformWrite } from "../../../../lib/platform-origins";
import { getAuth } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const handlers = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);

export const GET = handlers.GET;
export function POST(request: Request) {
  const headers = request.headers;
  const site = headers.get("sec-fetch-site");
  if (
    site === "cross-site" ||
    site === "same-site" ||
    (headers.has("origin") &&
      !allowsPlatformWrite(headers, getAuth().options.baseURL))
  ) {
    return Response.json(
      { code: "INVALID_ORIGIN", message: "This request is not allowed." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return handlers.POST(request);
}
