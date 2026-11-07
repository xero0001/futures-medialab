"use client";
import { useState } from "react";
import type {
  AdminReportingItem,
  AgencyReportingMutation,
  ReportingMetrics,
} from "@futures-medialab/database/reporting-types";
import { VideoPreview } from "@futures-medialab/ui/video-submission";
import { productionVideoSource } from "@futures-medialab/database/production-media-shared";
import { AdminButton } from "./_components/admin-button";
import s from "./reporting-review.module.css";
const metricLabels = {
  views: "조회수",
  impressions: "노출수",
  reach: "도달수",
  likes: "좋아요",
  comments: "댓글",
  shares: "공유",
  saves: "저장",
  clicks: "클릭",
};
const keys = Object.keys(metricLabels) as (keyof ReportingMetrics)[];
export function AdminReportingSubmit({
  item,
  busy,
  onSubmit,
}: {
  item: AdminReportingItem;
  busy: boolean;
  onSubmit: (
    input: Omit<AgencyReportingMutation, "clientRequestId"> & {
      campaignId: string;
    },
  ) => void;
}) {
  const [title, setTitle] = useState(""),
    [postUrl, setPostUrl] = useState(""),
    [publishedAt, setPublishedAt] = useState(""),
    [metricsAsOf, setMetricsAsOf] = useState(""),
    [note, setNote] = useState(""),
    [evidenceUrl, setEvidenceUrl] = useState("");
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  if (!item.isManaged) return null;
  return (
    <section className={s.internal}>
      <h4>매니지드 게시·성과 직접 등록</h4>
      <p className={s.muted}>
        게시 링크와 집계 결과를 새 버전으로 등록합니다. 운영 검토에서 공개하면
        브랜드 화면에 반영됩니다.
      </p>
      {!item.canSubmit ? (
        <p>{item.submitDisabledReason}</p>
      ) : (
        <form
          style={{ display: "grid", gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            onSubmit({
              action: "submit",
              campaignId: item.campaignId,
              reportingItemId: item.id,
              expectedRevision: item.revision,
              data: {
                title: title.trim(),
                postUrl: postUrl.trim(),
                publishedAt: new Date(`${publishedAt}+09:00`).toISOString(),
                metricsAsOf: metricsAsOf
                  ? new Date(`${metricsAsOf}+09:00`).toISOString()
                  : null,
                metrics: Object.fromEntries(
                  keys.map((key) => [
                    key,
                    metrics[key] ? Number(metrics[key]) : null,
                  ]),
                ) as ReportingMetrics,
                evidenceUrl: evidenceUrl.trim() || null,
                note: note.trim(),
              },
            });
          }}
        >
          <label className={s.field}>
            콘텐츠 제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={160}
              disabled={busy}
            />
          </label>
          <label className={s.field}>
            게시물 URL
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              required
              maxLength={2048}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={busy}
            />
          </label>
          <VideoPreview
            source={
              productionVideoSource(postUrl) ??
              productionVideoSource(item.productionVideoUrl ?? "")
            }
            title={title || "게시·제출 영상"}
          />
          <div className={s.grid}>
            <label className={s.field}>
              게시 시각 · 한국 시간
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <label className={s.field}>
              집계 기준 · 한국 시간
              <input
                type="datetime-local"
                value={metricsAsOf}
                onChange={(e) => setMetricsAsOf(e.target.value)}
                required={keys.some((key) => Boolean(metrics[key]))}
                disabled={busy}
              />
            </label>
          </div>
          <div className={s.metricInputs}>
            {keys.map((key) => (
              <label className={s.field} key={key}>
                {metricLabels[key]}
                <input
                  type="number"
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  value={metrics[key] ?? ""}
                  onChange={(e) =>
                    setMetrics((previous) => ({
                      ...previous,
                      [key]: e.target.value,
                    }))
                  }
                  placeholder="집계 중"
                  disabled={busy}
                />
              </label>
            ))}
          </div>
          <p className={s.muted}>
            집계하지 않은 지표는 비워 두세요. 0은 실제 집계 결과가 0일 때
            입력합니다.
          </p>
          <label className={s.field}>
            성과 증빙 URL (선택)
            <input
              type="url"
              maxLength={2048}
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className={s.field}>
            전달 사항 (선택)
            <textarea
              rows={3}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className={s.actions}>
            <AdminButton type="submit" disabled={busy}>
              새 성과 버전 등록
            </AdminButton>
          </div>
        </form>
      )}
    </section>
  );
}
