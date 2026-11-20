"use client";

import { VideoPreview } from "@futures-medialab/ui/video-submission";
import { productionVideoSource } from "@futures-medialab/database/production-media-shared";
import { TextButton, Typography } from "@montage-ui/core";
import type { ReactNode } from "react";
import { IconArrowUpRight } from "@montage-ui/icon";
import type {
  BrandReportingItem,
  ReportingMetrics,
  ReportingSnapshot,
  ReportingStatus,
} from "@futures-medialab/database/reporting-types";
import type { Locale } from "../landing-copy";
import { productionText } from "./production-shared";
import { StatusBadge, type StatusTone } from "./status-badge";
import {
  reportMetricsPending,
  reportSnapshotTitle,
  reportingTotalKeys,
  summarizePublishedReports,
} from "../../../lib/reporting-display";
import styles from "./reporting-workspace.module.css";

export {
  reportingMetricKeys,
  reportingLocalDate,
  reportingIsoDate,
} from "../../../lib/reporting-display";
export function metricLabel(key: keyof ReportingMetrics, locale: Locale) {
  const t = productionText(locale);
  return {
    views: t("조회수", "Views", "播放量"),
    impressions: t("노출수", "Impressions", "展示量"),
    reach: t("도달", "Reach", "触达人数"),
    likes: t("좋아요", "Likes", "点赞"),
    comments: t("댓글", "Comments", "评论"),
    shares: t("공유", "Shares", "分享"),
    saves: t("저장", "Saves", "收藏"),
    clicks: t("클릭", "Clicks", "点击"),
  }[key];
}
export function reportingDate(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value))} KST`;
}
export function ReportingBadge({
  status,
  locale,
  hasPublished = false,
  metricsPending = false,
}: {
  status: ReportingStatus;
  locale: Locale;
  hasPublished?: boolean;
  metricsPending?: boolean;
}) {
  const t = productionText(locale);
  const labels: Record<ReportingStatus, string> = {
    AWAITING_SUBMISSION: t(
      "게시·성과 등록 대기",
      "Awaiting report",
      "等待发布报告",
    ),
    ADMIN_REVIEW: hasPublished
      ? t("성과 업데이트 검토 중", "Reviewing report update", "成效更新审核中")
      : t("성과 검토 중", "Reviewing report", "成效审核中"),
    AGENCY_REVISION: t("성과 보완 중", "Report revision", "成效补充中"),
    PUBLISHED: metricsPending
      ? t(
          "게시 확인 · 지표 집계 중",
          "Published · metrics pending",
          "发布已确认 · 指标统计中",
        )
      : t("성과 공개 완료", "Report published", "成效已公开"),
  };
  const tone: Record<ReportingStatus, StatusTone> = {
    AWAITING_SUBMISSION: "neutral",
    ADMIN_REVIEW: "blue",
    AGENCY_REVISION: "amber",
    PUBLISHED: "green",
  };
  return <StatusBadge tone={tone[status]}>{labels[status]}</StatusBadge>;
}
function ReportLink({ url, children }: { url: string; children: ReactNode }) {
  let safe: string | null = null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      parsed.hostname !== "example.invalid"
    )
      safe = parsed.href;
  } catch {
    /* Historical malformed links stay text-only. */
  }
  return safe ? (
    <TextButton
      as="a"
      size="small"
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      trailingContent={<IconArrowUpRight />}
    >
      {children}
    </TextButton>
  ) : (
    <span>{children}</span>
  );
}
type MetricValue = {
  key: keyof ReportingMetrics;
  value: number | bigint | null;
  coverage?: string;
};

function MetricGrid({
  rows,
  locale,
  pending,
  primary = false,
}: {
  rows: MetricValue[];
  locale: Locale;
  pending: boolean;
  primary?: boolean;
}) {
  const t = productionText(locale);
  const missingLabel = pending
    ? t("집계 중", "Pending", "统计中")
    : t("미제공", "Not provided", "未提供");
  return (
    <dl className={styles.metrics}>
      {rows.map(({ key, value, coverage }) => (
        <div key={key}>
          <Typography
            as="dt"
            variant="caption1"
            color="semantic.foreground.neutral.secondary"
          >
            {metricLabel(key, locale)}
          </Typography>
          <Typography
            as="dd"
            variant={
              value === null ? "label1" : primary ? "title3" : "headline1"
            }
            weight={value === null ? "regular" : "bold"}
            color={
              value === null
                ? "semantic.foreground.neutral.secondary"
                : "semantic.foreground.neutral.primary"
            }
          >
            {value === null ? missingLabel : value.toLocaleString(locale)}
          </Typography>
          {coverage && (
            <Typography
              as="dd"
              variant="caption1"
              color="semantic.foreground.neutral.secondary"
            >
              {coverage}
            </Typography>
          )}
        </div>
      ))}
    </dl>
  );
}

const additionalMetricKeys = [
  "impressions",
  "reach",
  "shares",
  "saves",
] as const;
export function ReportSnapshotView({
  data,
  locale,
  version,
  timestamp,
  label,
  productionVideoUrl,
  hideHeading = false,
}: {
  productionVideoUrl?: string | null;
  hideHeading?: boolean;
  data: ReportingSnapshot;
  locale: Locale;
  version: number;
  timestamp: string | null;
  label: string;
}) {
  const t = productionText(locale);
  const title = reportSnapshotTitle(data.title);
  const pending = reportMetricsPending(data);
  const metricValue = (key: keyof ReportingMetrics) => ({
    key,
    value: data.metrics[key],
  });
  return (
    <div className={styles.snapshot}>
      {!hideHeading && (
        <div className={styles.snapshotHeading}>
          <Typography
            variant="caption1"
            color="semantic.foreground.neutral.secondary"
          >
            {label} · v{version} · {reportingDate(timestamp, locale)}
          </Typography>
          <Typography as="h4" variant="headline1" weight="bold">
            {title}
          </Typography>
        </div>
      )}
      <dl className={styles.dates}>
        <div>
          <Typography
            as="dt"
            variant="caption1"
            color="semantic.foreground.neutral.secondary"
          >
            {t("지표 기준 시각", "Metrics as of", "指标截至时间")}
          </Typography>
          <Typography as="dd" variant="label1">
            {data.metricsAsOf ? reportingDate(data.metricsAsOf, locale) : "—"}
          </Typography>
        </div>
        <div>
          <Typography
            as="dt"
            variant="caption1"
            color="semantic.foreground.neutral.secondary"
          >
            {t("게시 시각", "Published", "发布时间")}
          </Typography>
          <Typography as="dd" variant="label1">
            {reportingDate(data.publishedAt, locale)}
          </Typography>
        </div>
      </dl>
      <MetricGrid
        rows={reportingTotalKeys.map(metricValue)}
        locale={locale}
        pending={pending}
        primary
      />
      <VideoPreview
        source={
          productionVideoSource(data.postUrl) ??
          productionVideoSource(productionVideoUrl ?? "")
        }
        title={title}
      />
      <div className={styles.links}>
        <ReportLink url={data.postUrl}>
          {t("게시 콘텐츠 열기", "Open published content", "打开已发布内容")}
        </ReportLink>
        {data.evidenceUrl && (
          <ReportLink url={data.evidenceUrl}>
            {t("근거 자료 열기", "Open supporting evidence", "打开证明资料")}
          </ReportLink>
        )}
      </div>
      <MetricGrid
        rows={additionalMetricKeys.map(metricValue)}
        locale={locale}
        pending={pending}
      />
      {data.note && (
        <Typography as="p" variant="body2" className={styles.note}>
          {data.note}
        </Typography>
      )}
    </div>
  );
}
export function ReportingTotals({
  items,
  locale,
}: {
  items: BrandReportingItem[];
  locale: Locale;
}) {
  const t = productionText(locale);
  const summary = summarizePublishedReports(items);
  if (!summary.count) return null;
  return (
    <section
      className={styles.totals}
      aria-label={t(
        "공개 성과 요약",
        "Published performance summary",
        "公开成效汇总",
      )}
    >
      <div className={styles.summaryHeading}>
        <Typography as="h2" variant="heading2" weight="bold">
          {t("공개 성과 요약", "Published performance summary", "公开成效汇总")}
        </Typography>
        <Typography variant="caption1" className={styles.muted}>
          {t(
            `${summary.count}개 콘텐츠의 최신 공개본 기준`,
            `Latest published snapshots of ${summary.count} content items`,
            `${summary.count} 项内容的最新公开版本`,
          )}
          {summary.commonMetricsAsOf &&
            ` · ${t("집계 기준", "Measured", "统计时间")} ${reportingDate(summary.commonMetricsAsOf, locale)}`}
        </Typography>
      </div>
      <MetricGrid
        rows={reportingTotalKeys.map((key) => {
          const total = summary.totals[key];
          return {
            key,
            value: total.value,
            coverage:
              total.known > 0 && total.known < summary.count
                ? t(
                    `${total.known}/${summary.count}개 콘텐츠 집계`,
                    `${total.known}/${summary.count} items measured`,
                    `${total.known}/${summary.count} 项已统计`,
                  )
                : undefined,
          };
        })}
        locale={locale}
        pending={summary.allPending}
        primary
      />
      <Typography as="p" variant="caption1" className={styles.muted}>
        {t(
          "도달 수는 콘텐츠 간 시청자가 겹칠 수 있어 합계에서 제외합니다.",
          "Reach is excluded from totals because audiences may overlap across content.",
          "各项内容的受众可能重叠，触达人数不计入汇总。",
        )}
      </Typography>
    </section>
  );
}
