import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/auth";
import { allowsAdminWrite } from "../../../../lib/admin-origins";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
const handlers = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);
// Keep the internal auth surface minimal: no public signup, password-reset, or account mutation endpoints.
function allowed(request: Request) {
  return [
    "/api/auth/sign-in/email",
    "/api/auth/sign-out",
    "/api/auth/get-session",
    "/api/auth/ok",
  ].includes(new URL(request.url).pathname);
}
export const GET = (request: Request) =>
  allowed(request)
    ? handlers.GET(request)
    : Response.json({ code: "NOT_FOUND" }, { status: 404 });
export const POST = (request: Request) => {
  if (!allowed(request))
    return Response.json({ code: "NOT_FOUND" }, { status: 404 });
  const site = request.headers.get("sec-fetch-site");
  if (
    (site !== null && site !== "same-origin") ||
    (request.headers.has("origin") &&
      !allowsAdminWrite(request.headers, getAuth().options.baseURL))
  )
    return Response.json({ code: "INVALID_ORIGIN" }, { status: 403 });
  // Better Auth retains Referer validation for clients without an Origin header.
  return handlers.POST(request);
};
