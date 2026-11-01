import { z } from "zod";
import {
  productionIdSchema,
  productionPublicUrl,
} from "@futures-medialab/database/production-validation";
export const settlementIdSchema = productionIdSchema;
export const settlementAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
export const settlementDocumentSchema = z.strictObject({
  title: z.string().trim().min(2).max(160),
  note: z.string().trim().max(4000),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  documentUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(productionPublicUrl)
    .nullable(),
  internalNote: z.string().trim().max(2000),
});
const payment = z.strictObject({
  paidAt: z.iso
    .datetime({ offset: true })
    .refine((value) => Date.parse(value) <= Date.now()),
  reference: z.string().trim().min(2).max(200),
  amount: settlementAmountSchema,
  currency: z.enum(["KRW", "USD", "CNY"]),
  internalNote: z.string().trim().max(2000),
});
const mutation = { campaignId: settlementIdSchema, clientRequestId: z.uuid() };
const revision = z.number().int().min(0).max(2_147_483_647);
const invoice = {
  ...mutation,
  invoiceId: settlementIdSchema,
  expectedRevision: revision,
};
const payout = {
  ...mutation,
  payoutId: settlementIdSchema,
  expectedRevision: revision,
};
export const adminSettlementMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("completeCampaign"),
    ...mutation,
    expectedReadinessToken: z.string().regex(/^[a-f0-9]{64}$/),
    note: z.string().trim().min(2).max(2000),
  }),
  z.strictObject({
    action: z.literal("prepare"),
    ...mutation,
    completionId: settlementIdSchema,
    supplierCostBasis: z.literal("ITEM_TOTAL"),
  }),
  z.strictObject({
    action: z.literal("saveBrandInvoice"),
    ...invoice,
    data: settlementDocumentSchema,
  }),
  z.strictObject({
    action: z.literal("saveAgencyPayout"),
    ...payout,
    data: settlementDocumentSchema,
  }),
  z.strictObject({ action: z.literal("issueBrandInvoice"), ...invoice }),
  z.strictObject({ action: z.literal("issueAgencyPayout"), ...payout }),
  z.strictObject({
    action: z.literal("recordBrandPayment"),
    ...invoice,
    data: payment,
  }),
  z.strictObject({
    action: z.literal("recordAgencyPayment"),
    ...payout,
    data: payment,
  }),
]);
