import {
  lookupDelegatedIntake,
  submitDelegatedIntake,
} from "../../../../lib/delegated-intake";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const GET = lookupDelegatedIntake;
export const POST = submitDelegatedIntake;
