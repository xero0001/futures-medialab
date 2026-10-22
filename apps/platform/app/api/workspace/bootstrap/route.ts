import { bootstrapWorkspace } from "../../../../lib/workspace-api";

export const preferredRegion = "sin1";
export const dynamic = "force-dynamic";

// Shared boundary enforces access, validation, no-store and safe error logging.
export const GET = bootstrapWorkspace;
