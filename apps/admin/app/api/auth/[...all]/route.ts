import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/auth";
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
export const POST = (request: Request) =>
  allowed(request)
    ? handlers.POST(request)
    : Response.json({ code: "NOT_FOUND" }, { status: 404 });
