import { z } from "zod";
import {
  productionIdSchema,
  productionPublicUrl,
} from "@futures-medialab/database/production-validation";

export const reportingIdSchema = productionIdSchema;
export const reportingMetricKeys = [
  "views",
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
] as const;
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
export const reportingMetricsSchema = z.strictObject({
  views: counter,
  impressions: counter,
  reach: counter,
  likes: counter,
  comments: counter,
  shares: counter,
  saves: counter,
  clicks: counter,
});
const publicUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(productionPublicUrl);
export const reportingSnapshotSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(160),
    postUrl: publicUrl,
    publishedAt: z.iso.datetime({ offset: true }),
    metricsAsOf: z.iso.datetime({ offset: true }).nullable(),
    metrics: reportingMetricsSchema,
    evidenceUrl: publicUrl.nullable(),
    note: z.string().trim().max(4000),
  })
  .superRefine((value, ctx) => {
    const published = Date.parse(value.publishedAt),
      now = Date.now();
    if (published > now)
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "게시 시각은 현재 이전이어야 합니다.",
      });
    const known = reportingMetricKeys.some(
      (key) => value.metrics[key] !== null,
    );
    if (known && !value.metricsAsOf)
      ctx.addIssue({
        code: "custom",
        path: ["metricsAsOf"],
        message: "지표의 집계 시각을 입력해 주세요.",
      });
    if (value.metricsAsOf) {
      const asOf = Date.parse(value.metricsAsOf);
      if (asOf < published || asOf > now)
        ctx.addIssue({
          code: "custom",
          path: ["metricsAsOf"],
          message: "집계 시각은 게시 이후부터 현재까지여야 합니다.",
        });
    }
  });
const revision = z.number().int().min(0).max(2_147_483_647);
const itemMutation = {
  reportingItemId: reportingIdSchema,
  expectedRevision: revision,
  clientRequestId: z.uuid(),
};
const adminReview = {
  ...itemMutation,
  campaignId: reportingIdSchema,
  submissionId: reportingIdSchema,
  internalNote: z.string().trim().max(2000),
};
export const agencyReportingMutationSchema = z.strictObject({
  action: z.literal("submit"),
  ...itemMutation,
  data: reportingSnapshotSchema,
});
export const adminReportingMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("prepare"),
    campaignId: reportingIdSchema,
    clientRequestId: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("requestChanges"),
    ...adminReview,
    agencyFeedback: z.string().trim().min(2).max(2000),
  }),
  z.strictObject({
    action: z.literal("releaseToBrand"),
    ...adminReview,
    data: reportingSnapshotSchema,
  }),
]);
