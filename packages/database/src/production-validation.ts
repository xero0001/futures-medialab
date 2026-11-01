import { z } from "zod";
import { isIP } from "node:net";

export const productionIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
/** Links are stored, never fetched. Reject local/private destinations and credentials. */
export function productionPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return false;
    const host = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
    if (
      !host.includes(".") ||
      /(?:^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(
        host,
      )
    )
      return false;
    if (isIP(host) === 6) return false;
    if (isIP(host) === 4) {
      const [a, b] = host.split(".").map(Number);
      if (
        a === undefined ||
        b === undefined ||
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || b === 0)) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 198 && (b === 18 || b === 19 || b === 51)) ||
        (a === 203 && b === 0)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
const url = z.string().trim().min(1).max(2048).refine(productionPublicUrl);
const title = z.string().trim().min(2).max(160);
const note = z.string().trim().max(4000);
const message = z.string().trim().max(2000);
const idempotency = { clientRequestId: z.uuid() };
const item = {
  ...idempotency,
  productionItemId: productionIdSchema,
  expectedRevision: z.number().int().min(0).max(2_147_483_647),
};
const review = {
  ...item,
  campaignId: productionIdSchema,
  submissionId: productionIdSchema,
};
export const agencyProductionMutationSchema = z.strictObject({
  action: z.literal("submit"),
  ...item,
  title,
  url,
  note,
});
export const adminProductionMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("prepare"),
    campaignId: productionIdSchema,
    ...idempotency,
  }),
  z.strictObject({
    action: z.literal("assign"),
    campaignId: productionIdSchema,
    ...item,
    supplierOrganizationId: productionIdSchema,
  }),
  z.strictObject({
    action: z.literal("requestChanges"),
    ...review,
    agencyFeedback: message.min(2),
    internalNote: message,
  }),
  z.strictObject({
    action: z.literal("releaseToBrand"),
    ...review,
    title,
    url,
    note,
    internalNote: message,
  }),
]);
export const brandProductionMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("approve"),
    ...item,
    submissionId: productionIdSchema,
    message,
  }),
  z.strictObject({
    action: z.literal("requestChanges"),
    ...item,
    submissionId: productionIdSchema,
    message: message.min(2),
  }),
]);
