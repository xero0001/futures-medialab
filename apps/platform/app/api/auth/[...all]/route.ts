import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const handlers = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);

export const GET = handlers.GET;
export const POST = handlers.POST;
