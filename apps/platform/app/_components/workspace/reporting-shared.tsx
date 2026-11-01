"use client";

import { Typography } from "@montage-ui/core";
import type { ReactNode } from "react";
import { IconArrowUpRight } from "@montage-ui/icon";
import type { BrandReportingItem, ReportingMetrics, ReportingSnapshot, ReportingStatus } from "@futures-medialab/database/reporting-types";
import type { Locale } from "../landing-copy";
import { productionText } from "./production-shared";
import { StatusBadge, type StatusTone } from "./status-badge";
import { reportingMetricKeys, reportingTotalKeys, summarizePublishedReports } from "../../../lib/reporting-display";
import styles from "./reporting-workspace.module.css";

export { reportingMetricKeys, reportingLocalDate, reportingIsoDate } from "../../../lib/reporting-display";
export function metricLabel(key: keyof ReportingMetrics, locale: Locale) {
  const t = productionText(locale);
  return {
    views: t("조회수", "Views", "播放量"), impressions: t("노출수", "Impressions", "展示量"), reach: t("도달", "Reach", "触达人数"),
    likes: t("좋아요", "Likes", "点赞"), comments: t("댓글", "Comments", "评论"), shares: t("공유", "Shares", "分享"), saves: t("저장", "Saves", "收藏"), clicks: t("클릭", "Clicks", "点击"),
  }[key];
}
export function reportingDate(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value))} KST`;
}
export function ReportingBadge({ status, locale, hasPublished = false, metricsPending = false }: { status: ReportingStatus; locale: Locale; hasPublished?: boolean; metricsPending?: boolean }) {
  const t = productionText(locale);
  const labels: Record<ReportingStatus, string> = { AWAITING_SUBMISSION: t("게시·성과 등록 대기", "Awaiting report", "等待发布报告"), ADMIN_REVIEW: hasPublished ? t("성과 업데이트 검토 중", "Reviewing report update", "成效更新审核中") : t("성과 검토 중", "Reviewing report", "成效审核中"), AGENCY_REVISION: t("성과 보완 중", "Report revision", "成效补充中"), PUBLISHED: metricsPending ? t("게시 확인 · 지표 집계 중", "Published · metrics pending", "发布已确认 · 指标统计中") : t("성과 공개 완료", "Report published", "成效已公开") };
  const tone: Record<ReportingStatus, StatusTone> = { AWAITING_SUBMISSION: "neutral", ADMIN_REVIEW: "blue", AGENCY_REVISION: "amber", PUBLISHED: "green" };
  return <StatusBadge tone={tone[status]}>{labels[status]}</StatusBadge>;
}
function ReportLink({ url, children }: { url: string; children: ReactNode }) {
  let safe: string | null = null;
  try { const parsed = new URL(url); if (parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.hostname !== "example.invalid") safe = parsed.href; } catch { /* Historical malformed links stay text-only. */ }
  return safe ? <a className={styles.link} href={safe} target="_blank" rel="noopener noreferrer">{children}<IconArrowUpRight /></a> : <span>{children}</span>;
}
export function ReportMetrics({ metrics, locale }: { metrics: ReportingMetrics; locale: Locale }) {
  const t = productionText(locale);
  return <dl className={styles.metrics}>{reportingMetricKeys.map(key => <div key={key}><dt>{metricLabel(key, locale)}</dt><dd>{metrics[key] === null ? <span className={styles.unknown}>{t("집계 중", "Pending", "统计中")}</span> : metrics[key].toLocaleString(locale)}</dd></div>)}</dl>;
}
export function ReportSnapshotView({ data, locale, version, timestamp, label }: { data: ReportingSnapshot; locale: Locale; version: number; timestamp: string | null; label: string }) {
  const t = productionText(locale);
  return <div className={styles.snapshot}>
    <Typography variant="caption1" className={styles.muted}>{label} · v{version} · {reportingDate(timestamp, locale)}</Typography>
    <Typography as="h3" variant="heading2" weight="bold">{data.title}</Typography>
    <div className={styles.links}><ReportLink url={data.postUrl}>{t("게시 콘텐츠 열기", "Open published content", "打开已发布内容")}</ReportLink>{data.evidenceUrl && <ReportLink url={data.evidenceUrl}>{t("근거 자료 열기", "Open supporting evidence", "打开证明资料")}</ReportLink>}</div>
    <dl className={styles.dates}><div><dt>{t("게시 시각", "Published", "发布时间")}</dt><dd>{reportingDate(data.publishedAt, locale)}</dd></div><div><dt>{t("지표 기준 시각", "Metrics as of", "指标截至时间")}</dt><dd>{data.metricsAsOf ? reportingDate(data.metricsAsOf, locale) : t("아직 집계되지 않았습니다", "Not measured yet", "尚未统计")}</dd></div></dl>
    <ReportMetrics metrics={data.metrics} locale={locale} />
    {data.note && <Typography as="p" variant="body2" className={styles.note}>{data.note}</Typography>}
  </div>;
}
export function ReportingTotals({ items, locale }: { items: BrandReportingItem[]; locale: Locale }) {
  const t = productionText(locale);
  const summary = summarizePublishedReports(items);
  if (!summary.count) return null;
  return <section className={styles.totals} aria-label={t("공개 성과 요약", "Published performance summary", "公开成效汇总")}>
    <div className={styles.summaryHeading}><Typography as="h2" variant="heading2" weight="bold">{t("공개 성과 요약", "Published performance summary", "公开成效汇总")}</Typography><Typography variant="caption1" className={styles.muted}>{t(`${summary.count}개 콘텐츠의 최신 공개본 기준`, `Latest published snapshots of ${summary.count} content items`, `${summary.count} 项内容的最新公开版本`)}</Typography></div>
    <div className={styles.totalGrid}>{reportingTotalKeys.map(key => {
      const total = summary.totals[key];
      return <div key={key}><Typography variant="caption1" className={styles.muted}>{metricLabel(key, locale)}</Typography><Typography as="strong" variant="title3" weight="bold">{total.value === null ? t("집계 중", "Pending", "统计中") : total.value.toLocaleString(locale)}</Typography><Typography variant="caption1" className={styles.muted}>{t(`${total.known}/${summary.count}개 지표 확인`, `${total.known}/${summary.count} items measured`, `${total.known}/${summary.count} 项已统计`)}</Typography></div>;
    })}</div>
    <Typography as="p" variant="caption1" className={styles.muted}>{t("콘텐츠마다 집계 시점이 다를 수 있습니다. 이전 버전은 합계에서 제외하며, 도달은 이용자 중복을 확인할 수 없어 합산하지 않습니다.", "Measurement times may differ. Earlier versions are excluded, and reach is not added because audiences may overlap.", "各内容统计时间可能不同；汇总不包含历史版本，触达人数因可能重复而不合计。")}</Typography>
  </section>;
}
