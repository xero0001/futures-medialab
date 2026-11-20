import type { BrandReportingItem, ReportingMetrics, ReportingSnapshot } from "@futures-medialab/database/reporting-types";

export const reportingMetricKeys = ["views", "impressions", "reach", "likes", "comments", "shares", "saves", "clicks"] as const;
export const reportingTotalKeys = ["views", "likes", "comments", "clicks"] as const;

/** Older demo titles included the metric scenario number, which can differ from the published version. */
export function reportSnapshotTitle(title: string) {
  return title.startsWith("[시연] ") ? title.replace(/( · 성과 보고) v\d+$/, "$1") : title;
}

export function reportMetricsPending(snapshot: Pick<ReportingSnapshot, "metrics" | "metricsAsOf">) {
  return !snapshot.metricsAsOf && reportingMetricKeys.every(key => snapshot.metrics[key] === null);
}

/** Forms label KST explicitly so a reviewer's device timezone cannot shift it. */
export function reportingLocalDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function reportingIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isFinite(date.getTime()) && reportingLocalDate(date.toISOString()) === value ? date.toISOString() : null;
}
export function summarizePublishedReports(items: BrandReportingItem[]) {
  const snapshots = [...new Map(items.filter(item => item.isCurrent && item.latestSubmission).map(item => [item.productionItemId, item.latestSubmission!])).values()];
  const totals = Object.fromEntries(reportingTotalKeys.map(key => {
    const known = snapshots.filter(snapshot => snapshot.metrics[key] !== null);
    return [key, { known: known.length, value: known.length ? known.reduce((sum, snapshot) => sum + BigInt(snapshot.metrics[key]!), 0n) : null }];
  })) as Record<typeof reportingTotalKeys[number], { known: number; value: bigint | null }>;
  const measurementTimes = new Set(snapshots.map(snapshot => snapshot.metricsAsOf));
  return {
    count: snapshots.length,
    totals,
    allPending: snapshots.every(reportMetricsPending),
    commonMetricsAsOf: measurementTimes.size === 1 ? snapshots[0]?.metricsAsOf ?? null : null,
  };
}
export function reportingInputMetrics(values: Record<keyof ReportingMetrics, string>): ReportingMetrics | null {
  const metrics = {} as ReportingMetrics;
  for (const key of reportingMetricKeys) {
    const value = values[key].trim();
    if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return null;
    metrics[key] = value ? Number(value) : null;
  }
  return metrics;
}
