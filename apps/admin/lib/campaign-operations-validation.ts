import { z } from "zod";

const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const reason = z.string().trim().min(2).max(1000);
const revision = z.number().int().min(0).max(2_147_483_646).nullable();
export function safeOperationUrl(value: string | null): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const reference = z.string().trim().max(2048).refine((value) => !value || safeOperationUrl(value) !== null);
const amount = z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
const base = { campaignId: id, applicationId: id, reason };
export const campaignOperationsSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...base, action: z.literal("reviewContent"), submissionId: id,
    expectedUpdatedAt: z.iso.datetime(), status: z.enum(["APPROVED", "REVISION_REQUESTED", "VERIFIED"]) }),
  z.strictObject({ ...base, action: z.literal("saveContract"), expectedVersion: revision,
    status: z.enum(["DRAFT", "CONFIRMED"]), referenceUrl: reference, notes: z.string().trim().max(4000) }),
  z.strictObject({ ...base, action: z.literal("prepareSettlement"), expectedVersion: revision,
    grossAmount: amount, platformFeeAmount: amount, withholdingAmount: amount }),
  z.strictObject({ ...base, action: z.literal("reviewSettlement"), expectedVersion: revision,
    status: z.enum(["APPROVED", "REJECTED"]) }),
]);

export function canReviewContent(from: string, to: string) {
  return (from === "SUBMITTED" && (to === "APPROVED" || to === "REVISION_REQUESTED")) ||
    (from === "PUBLISHED" && (to === "VERIFIED" || to === "REVISION_REQUESTED"));
}

/** Exact minor-unit arithmetic; never round or accept exponent notation. */
export function settlementAmounts(gross: string, fee: string, withholding: string) {
  const values = [gross, fee, withholding];
  if (values.some((value) => !amount.safeParse(value).success)) return null;
  const minor = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  };
  const [g, f, w] = values.map(minor) as [bigint, bigint, bigint];
  if (g <= 0n || f + w > g) return null;
  const decimal = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  return { grossAmount: decimal(g), platformFeeAmount: decimal(f), withholdingAmount: decimal(w), netAmount: decimal(g - f - w) };
}

export function matchesSettlementBudget(gross: string, proposal: string | null, budget: string | null, otherGross: string[]) {
  const values = [gross, ...(proposal !== null ? [proposal] : []), ...(budget !== null ? [budget] : []), ...otherGross];
  if (values.some((value) => !amount.safeParse(value).success)) return false;
  const minor = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")); };
  const current = minor(gross);
  if (proposal !== null && current !== minor(proposal)) return false;
  return budget === null || current + otherGross.reduce((sum, value) => sum + minor(value), 0n) <= minor(budget);
}
