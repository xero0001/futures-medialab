"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  ClipboardCopy,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  AdminReportingItem,
  AdminReportingMutation,
  AdminReportingResponse,
  AdminReportingSubmission,
  ReportingMetrics,
  ReportingSnapshot,
  ReportingStatus,
} from "@futures-medialab/database/reporting-types";
import { AdminReportingSubmit } from "./reporting-submit";
import { VideoPreview } from "@futures-medialab/ui/video-submission";
import { productionVideoSource } from "@futures-medialab/database/production-media-shared";
import { AdminButton } from "./_components/admin-button";
import s from "./reporting-review.module.css";

type MutationInput = AdminReportingMutation extends infer T
  ? T extends AdminReportingMutation
    ? Omit<T, "clientRequestId">
    : never
  : never;
type ReviewAction = {
  kind: "release" | "changes";
  item: AdminReportingItem;
  submission: AdminReportingSubmission;
};
const labels: Record<ReportingStatus, string> = {
  AWAITING_SUBMISSION: "게시·성과 등록 대기",
  ADMIN_REVIEW: "운영팀 검토",
  AGENCY_REVISION: "에이전시 수정 중",
  PUBLISHED: "브랜드 공개 완료",
};
const metricLabels: Record<keyof ReportingMetrics, string> = {
  views: "조회수",
  impressions: "노출수",
  reach: "도달수",
  likes: "좋아요",
  comments: "댓글",
  shares: "공유",
  saves: "저장",
  clicks: "클릭",
};
const metricKeys = Object.keys(metricLabels) as (keyof ReportingMetrics)[];
const emptyMetrics = (): ReportingMetrics => ({
  views: null,
  impressions: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  clicks: null,
});
const emptyMetricInputs = () =>
  Object.fromEntries(metricKeys.map((key) => [key, ""])) as Record<
    keyof ReportingMetrics,
    string
  >;
const date = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미등록";
const toInputDate = (value: string | null) =>
  value
    ? new Date(Date.parse(value) + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : "";
const toIsoDate = (value: string) =>
  value ? new Date(`${value}+09:00`).toISOString() : "";

function Status({ value }: { value: ReportingStatus }) {
  return (
    <span
      className={s.badge}
      data-tone={
        value === "PUBLISHED"
          ? "green"
          : value === "ADMIN_REVIEW"
            ? "blue"
            : value === "AGENCY_REVISION"
              ? "amber"
              : undefined
      }
    >
      {labels[value]}
    </span>
  );
}
function ResourceLink({ url, label }: { url: string | null; label: string }) {
  let href: string | null = null;
  try {
    const parsed = new URL(url ?? "");
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hostname.endsWith(".invalid")
    )
      href = parsed.href;
  } catch {
    /* An incomplete preview URL is not a link. */
  }
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  ) : (
    <span className={s.muted}>
      {url ? "시연 자료 · 외부 연결 없음" : `${label} 미등록`}
    </span>
  );
}
function Snapshot({
  value,
  label,
}: {
  value: ReportingSnapshot;
  label: string;
}) {
  const collecting = metricKeys.every((key) => value.metrics[key] === null);
  return (
    <div className={s.snapshot}>
      <span className={s.eyebrow}>{label}</span>
      <h5>{value.title || "공개 제목을 입력하세요"}</h5>
      <VideoPreview
        source={productionVideoSource(value.postUrl)}
        title={value.title || "게시 영상"}
      />
      <div className={s.links}>
        <ResourceLink url={value.postUrl} label="게시물 열기" />
        {value.evidenceUrl ? (
          <ResourceLink url={value.evidenceUrl} label="성과 증빙 열기" />
        ) : null}
      </div>
      <dl className={s.dates}>
        <div>
          <dt>게시 시각 · 한국 시간</dt>
          <dd>{date(value.publishedAt)}</dd>
        </div>
        <div>
          <dt>집계 기준 · 한국 시간</dt>
          <dd>{date(value.metricsAsOf)}</dd>
        </div>
      </dl>
      <dl className={s.metrics}>
        {metricKeys.map((key) => (
          <div key={key}>
            <dt>{metricLabels[key]}</dt>
            <dd>{value.metrics[key]?.toLocaleString("ko-KR") ?? "집계 중"}</dd>
          </div>
        ))}
      </dl>
      {collecting ? (
        <p className={s.muted}>
          아직 성과를 집계하고 있습니다. 미등록 지표는 0으로 계산하지 않습니다.
        </p>
      ) : null}
      {value.note ? <p className={s.pre}>{value.note}</p> : null}
    </div>
  );
}
async function request<T>(
  path: string,
  input?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: input ? "POST" : "GET",
    cache: "no-store",
    signal,
    ...(input
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "게시·성과 검토 요청을 처리하지 못했습니다.",
    );
  }
  return body as T;
}

function ReviewForm({
  action,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  action: ReviewAction;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MutationInput) => void;
}) {
  const { item, submission } = action;
  const release = action.kind === "release";
  const [title, setTitle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [metricsAsOf, setMetricsAsOf] = useState("");
  const [metricInputs, setMetricInputs] = useState(emptyMetricInputs);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState(submission.internalNote);
  const [agencyFeedback, setAgencyFeedback] = useState("");
  const [localError, setLocalError] = useState("");
  const metrics = emptyMetrics();
  for (const key of metricKeys)
    metrics[key] = metricInputs[key] === "" ? null : Number(metricInputs[key]);
  const hasMetrics = metricKeys.some((key) => metrics[key] !== null);
  const preview: ReportingSnapshot = {
    title,
    postUrl,
    publishedAt: publishedAt ? `${publishedAt}+09:00` : "",
    metricsAsOf: metricsAsOf ? `${metricsAsOf}+09:00` : null,
    metrics,
    evidenceUrl: evidenceUrl || null,
    note,
  };
  function copySource() {
    setTitle(submission.title);
    setPostUrl(submission.postUrl);
    setPublishedAt(toInputDate(submission.publishedAt));
    setMetricsAsOf(toInputDate(submission.metricsAsOf));
    setMetricInputs(
      Object.fromEntries(
        metricKeys.map((key) => [
          key,
          submission.metrics[key]?.toString() ?? "",
        ]),
      ) as Record<keyof ReportingMetrics, string>,
    );
    setEvidenceUrl(submission.evidenceUrl ?? "");
    setNote(submission.note);
    setLocalError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setLocalError("");
    const base = {
      campaignId: item.campaignId,
      reportingItemId: item.id,
      submissionId: submission.id,
      expectedRevision: item.revision,
      internalNote,
    };
    if (!release) {
      onSubmit({ ...base, action: "requestChanges", agencyFeedback });
      return;
    }
    if (
      metricKeys.some(
        (key) =>
          metrics[key] !== null &&
          (!Number.isSafeInteger(metrics[key]) || metrics[key]! < 0),
      )
    ) {
      setLocalError(
        "지표는 0 이상의 정수로 입력하세요. 미등록 지표는 비워 두세요.",
      );
      return;
    }
    const posted = Date.parse(`${publishedAt}+09:00`),
      measured = metricsAsOf ? Date.parse(`${metricsAsOf}+09:00`) : null;
    if (
      !Number.isFinite(posted) ||
      posted > Date.now() ||
      (hasMetrics && measured === null) ||
      (measured !== null &&
        (!Number.isFinite(measured) ||
          measured < posted ||
          measured > Date.now()))
    ) {
      setLocalError(
        "게시 시각은 현재 이전으로, 집계 기준은 게시 이후부터 현재 사이로 입력하세요. 등록된 지표가 있으면 집계 기준이 필요합니다.",
      );
      return;
    }
    onSubmit({
      ...base,
      action: "releaseToBrand",
      data: {
        ...preview,
        publishedAt: toIsoDate(publishedAt),
        metricsAsOf: metricsAsOf ? toIsoDate(metricsAsOf) : null,
      },
    });
  }
  return (
    <form onSubmit={submit}>
      <div className={s.dialogHeader}>
        <div>
          <h2 id="reporting-review-dialog-title">
            {release
              ? "검토한 게시·성과를 브랜드에 공개"
              : "에이전시에 성과 수정 요청"}
          </h2>
          <p>
            {item.creatorName} · 제출 v{submission.version}
          </p>
        </div>
        <AdminButton
          type="button"
          className="icon"
          disabled={busy}
          onClick={onClose}
          aria-label="성과 검토 창 닫기"
        >
          <X size={18} />
        </AdminButton>
      </div>
      <div className={s.notice}>
        <ShieldCheck size={18} />
        <p>
          {release
            ? "공개본의 링크·지표·안내를 확인하세요. 원문과 내부 메모는 공개되지 않습니다. 브랜드는 공개된 성과를 조회하며 추가 승인은 필요하지 않습니다."
            : "수정 요청은 담당 에이전시만 확인합니다. 이미 공개한 성과는 유지되고, 새 버전을 다시 검토합니다."}
        </p>
      </div>
      <fieldset className={s.fieldset} disabled={busy}>
        {release ? (
          <>
            <div className={s.comparison}>
              <div className={s.privatePanel}>
                <Snapshot
                  value={submission}
                  label={`에이전시 제출 원문 · v${submission.version} · 브랜드 비공개`}
                />
              </div>
              <div className={s.editor}>
                <div className={s.row}>
                  <strong>브랜드 공개본 작성</strong>
                  <AdminButton type="button" onClick={copySource}>
                    <ClipboardCopy size={15} />
                    원문에서 가져오기
                  </AdminButton>
                </div>
                <label className={s.field}>
                  공개 제목
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="브랜드에 보여줄 게시·성과 제목"
                  />
                </label>
                <label className={s.field}>
                  공개 게시물 URL
                  <input
                    type="url"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    required
                    maxLength={2048}
                    placeholder="https://"
                  />
                </label>
                <div className={s.grid}>
                  <label className={s.field}>
                    게시 시각 · 한국 시간
                    <input
                      type="datetime-local"
                      value={publishedAt}
                      onChange={(e) => setPublishedAt(e.target.value)}
                      required
                    />
                  </label>
                  <label className={s.field}>
                    집계 기준 · 한국 시간
                    <input
                      type="datetime-local"
                      value={metricsAsOf}
                      onChange={(e) => setMetricsAsOf(e.target.value)}
                      required={hasMetrics}
                    />
                    <small>지표를 등록하면 필수입니다.</small>
                  </label>
                </div>
                <div className={s.metricInputs}>
                  {metricKeys.map((key) => (
                    <label className={s.field} key={key}>
                      {metricLabels[key]}
                      <input
                        type="number"
                        min={0}
                        max={Number.MAX_SAFE_INTEGER}
                        step={1}
                        inputMode="numeric"
                        value={metricInputs[key]}
                        placeholder="집계 중"
                        onChange={(e) =>
                          setMetricInputs((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className={s.muted}>
                  미등록 지표는 비워 두세요. 0은 실제 집계 결과가 0일 때만
                  입력합니다.
                </p>
                <label className={s.field}>
                  공개 성과 증빙 URL · 선택
                  <input
                    type="url"
                    maxLength={2048}
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://"
                  />
                  <small>브랜드가 접근해도 되는 증빙만 입력하세요.</small>
                </label>
                <label className={s.field}>
                  브랜드 안내
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="집계 범위와 참고사항"
                  />
                </label>
              </div>
            </div>
            <div className={s.publicPanel}>
              <Snapshot value={preview} label="브랜드 공개 미리보기" />
            </div>
          </>
        ) : (
          <label className={s.field}>
            에이전시에 전달할 수정 요청
            <textarea
              rows={4}
              value={agencyFeedback}
              onChange={(e) => setAgencyFeedback(e.target.value)}
              required
              minLength={2}
              maxLength={2000}
              placeholder="보완할 게시 링크, 지표 또는 증빙을 구체적으로 입력하세요."
            />
          </label>
        )}
        <label className={s.field}>
          <span>
            <LockKeyhole size={15} aria-hidden="true" /> 내부 메모 · 운영팀 전용
          </span>
          <textarea
            rows={3}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            maxLength={2000}
            placeholder="브랜드와 에이전시에 전달되지 않는 검토 기록"
          />
        </label>
        {release ? (
          <label className={s.check}>
            <input type="checkbox" required />
            공개할 게시 링크·집계 기준·지표·증빙·안내를 확인했으며, 이 버전을
            브랜드에 공개합니다.
          </label>
        ) : null}
      </fieldset>
      {localError || error ? (
        <p className={s.error} role="alert">
          {localError || error}
        </p>
      ) : null}
      <div className={s.actions}>
        <AdminButton type="button" disabled={busy} onClick={onClose}>
          취소
        </AdminButton>
        <AdminButton className="primary" disabled={busy}>
          <Send size={16} />
          {busy
            ? "처리 중…"
            : release
              ? "브랜드에 성과 공개"
              : "수정 요청 전달"}
        </AdminButton>
      </div>
    </form>
  );
}
function ReviewDialog({
  action,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  action: ReviewAction | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: MutationInput) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);
  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="reporting-review-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {action ? (
        <ReviewForm
          key={`${action.kind}:${action.item.id}:${action.submission.id}:${action.item.revision}`}
          action={action}
          busy={busy}
          error={error}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </dialog>
  );
}
function ItemDetail({
  item,
  busy,
  onReview,
  onSubmit,
}: {
  item: AdminReportingItem;
  busy: boolean;
  onReview: (action: ReviewAction) => void;
  onSubmit: (input: MutationInput) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const submission =
    item.submissions.find((entry) => entry.id === selectedId) ??
    item.latestSubmission;
  const isLatest = !!submission && submission.id === item.latestSubmission?.id;
  const latestPublic = item.submissions.find(
    (entry) => entry.releasedSnapshot !== null,
  );
  return (
    <>
      <div className={s.row}>
        <div>
          <span className={s.muted}>
            공식 제안 v{item.proposalVersion} · {item.platform}
          </span>
          <h4>{item.creatorName}</h4>
        </div>
        <Status value={item.status} />
      </div>
      <AdminReportingSubmit item={item} busy={busy} onSubmit={onSubmit} />
      <p className={s.context}>
        {item.deliverables} · {item.quantity}건<br />
        담당 공급 파트너 · {item.supplierName ?? "미배정"}
      </p>
      {!item.isCurrent ? (
        <p className={s.notice}>
          이전 제안 또는 제작 항목의 기록입니다. 기존 공개본은 보관되며 새
          제출·검토는 진행할 수 없습니다.
        </p>
      ) : null}
      {item.submissions.length ? (
        <>
          <div className={s.versions} role="group" aria-label="성과 제출 버전">
            {item.submissions.map((entry) => (
              <button
                type="button"
                key={entry.id}
                disabled={busy}
                aria-pressed={submission?.id === entry.id}
                onClick={() => setSelectedId(entry.id)}
              >
                v{entry.version}
                {entry.id === item.latestSubmission?.id ? " · 최신 제출" : ""}
                {entry.id === latestPublic?.id ? " · 최신 공개" : ""}
              </button>
            ))}
          </div>
          {submission ? (
            <>
              <div className={s.comparison}>
                <div className={s.privatePanel}>
                  <Snapshot
                    value={submission}
                    label={`에이전시 제출 원문 · v${submission.version} · 브랜드 비공개`}
                  />
                  <small className={s.meta}>
                    제출 {date(submission.submittedAt)}
                  </small>
                </div>
                <div className={s.publicPanel}>
                  {submission.releasedSnapshot ? (
                    <>
                      <Snapshot
                        value={submission.releasedSnapshot}
                        label={`브랜드 공개본 · v${submission.version}`}
                      />
                      <small className={s.meta}>
                        공개 {date(submission.releasedAt)}
                      </small>
                    </>
                  ) : (
                    <div className={s.waiting}>
                      <ShieldCheck size={24} />
                      <strong>
                        이 버전은 아직 브랜드에 공개되지 않았습니다
                      </strong>
                      <p>
                        {latestPublic
                          ? `브랜드는 기존 공개 v${latestPublic.version}을 계속 확인합니다. 새 원문은 검토 후 별도로 공개하세요.`
                          : "검토 후 공개한 내용만 브랜드가 확인합니다."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {submission.internalNote || submission.agencyFeedback ? (
                <div className={s.internal}>
                  <h5>
                    <LockKeyhole size={15} />
                    운영팀 검토 기록
                  </h5>
                  {submission.internalNote ? (
                    <div>
                      <strong>내부 메모 · 브랜드·에이전시 비공개</strong>
                      <p className={s.pre}>{submission.internalNote}</p>
                    </div>
                  ) : null}
                  {submission.agencyFeedback ? (
                    <div>
                      <strong>에이전시에 전달한 수정 요청</strong>
                      <p className={s.pre}>{submission.agencyFeedback}</p>
                    </div>
                  ) : null}
                  <small className={s.muted}>
                    검토 {date(submission.adminReviewedAt)}
                  </small>
                </div>
              ) : null}
              <div className={s.footer}>
                {isLatest && item.canReview ? (
                  <>
                    <p className={s.muted}>
                      원문을 검토하고, 브랜드에 공유할 게시·성과 내용을 별도로
                      확정하세요.
                    </p>
                    <div className={s.actions}>
                      <AdminButton
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onReview({ kind: "changes", item, submission })
                        }
                      >
                        에이전시에 수정 요청
                      </AdminButton>
                      <AdminButton
                        type="button"
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          onReview({ kind: "release", item, submission })
                        }
                      >
                        <Send size={16} />
                        브랜드 공개본 검토
                      </AdminButton>
                    </div>
                  </>
                ) : (
                  <p className={s.muted}>
                    {!isLatest
                      ? "이전 제출 버전입니다. 최신 버전에서 검토를 진행하세요."
                      : item.reviewDisabledReason ||
                        "다음 성과 업데이트를 기다리고 있습니다."}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className={s.empty}>
          <BarChart3 size={28} />
          <h4>게시·성과 등록을 기다리고 있습니다</h4>
          <p>
            담당 에이전시가 게시 링크와 집계 결과를 제출하면 운영팀 검토를
            시작합니다. 미등록 지표는 집계 중으로 표시됩니다.
          </p>
        </div>
      )}
    </>
  );
}
export function ReportingReview({ campaignId }: { campaignId: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const [data, setData] = useState<AdminReportingResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<ReviewAction | null>(null);
  const pending = useRef(false),
    retries = useRef(new Map<string, string>());
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        busy ||
        (action && !window.confirm("작성 중인 검수 내용을 닫고 이동할까요?"))
      )
        event.preventDefault();
    };
    window.addEventListener("admin:navigate", guard);
    return () => window.removeEventListener("admin:navigate", guard);
  }, [busy, action]);
  const current = data?.campaignId === campaignId ? data : null;
  const currentItems = current?.items.filter((item) => item.isCurrent) ?? [];
  const visibleItems = showHistory ? (current?.items ?? []) : currentItems;
  const selected =
    visibleItems.find((item) => item.id === selectedId) ??
    visibleItems[0] ??
    null;
  useEffect(() => {
    const controller = new AbortController();
    request<AdminReportingResponse>(
      `/api/admin/reporting?campaignId=${encodeURIComponent(campaignId)}`,
      undefined,
      controller.signal,
    )
      .then((body) => {
        if (!controller.signal.aborted) {
          setData(body);
          setError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "게시·성과를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [campaignId, reload]);
  function refresh() {
    if (busy) return;
    setLoading(true);
    setNotice("");
    setError("");
    setReload((value) => value + 1);
  }
  async function mutate(input: MutationInput) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const fingerprint = JSON.stringify(input),
      clientRequestId = retries.current.get(fingerprint) ?? crypto.randomUUID();
    retries.current.set(fingerprint, clientRequestId);
    try {
      const result = await request<AdminReportingResponse>(
        "/api/admin/reporting",
        { ...input, clientRequestId },
      );
      retries.current.delete(fingerprint);
      setData(result);
      setAction(null);
      setNotice(
        input.action === "submit"
          ? "게시·성과를 새 버전으로 등록했습니다. 검토 후 브랜드에 공개해 주세요."
          : input.action === "prepare"
            ? "콘텐츠 승인이 완료된 게시·성과 항목을 준비했습니다."
            : input.action === "requestChanges"
              ? "담당 에이전시에 성과 수정 요청을 전달했습니다."
              : "검토한 게시·성과를 브랜드에 공개했습니다. 다음 업데이트도 새 버전으로 검토합니다.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "검토 결과를 저장하지 못했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="admin-reporting-review"
      className={s.workspace}
      aria-label="게시·성과 검토"
      aria-busy={loading || busy}
    >
      <div className={s.heading}>
        <div>
          <h3>게시·성과 검토</h3>
          <p>
            콘텐츠 승인 후 등록된 게시 링크와 성과를 검토하고, 확인한 공개본을
            브랜드에 공유합니다.
          </p>
        </div>
        <div className={s.actions}>
          <AdminButton
            type="button"
            disabled={loading || busy}
            onClick={refresh}
          >
            <RefreshCw size={16} />
            새로고침
          </AdminButton>
          {current && current.unpreparedApprovedItemCount > 0 ? (
            <AdminButton
              type="button"
              disabled={loading || busy}
              onClick={() => void mutate({ action: "prepare", campaignId })}
            >
              <ArrowRight size={16} />
              승인 콘텐츠 불러오기
            </AdminButton>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className={s.error} role="alert">
          <p>{error}</p>
          <p>다른 담당자가 처리했다면 최신 내용을 불러온 뒤 다시 검토하세요.</p>
          {!busy && !action ? (
            <AdminButton type="button" onClick={refresh}>
              최신 내용 불러오기
            </AdminButton>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p className={s.success} role="status">
          {notice}
        </p>
      ) : null}
      {loading && !current ? (
        <p className={s.empty} role="status">
          게시·성과 내역을 불러오는 중입니다…
        </p>
      ) : null}
      {current && current.items.some((item) => !item.isCurrent) ? (
        <label className={s.historyFilter}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(event) => setShowHistory(event.target.checked)}
            disabled={busy}
          />
          이전 제안 기록 포함 (
          {current.items.filter((item) => !item.isCurrent).length}건)
        </label>
      ) : null}
      {current && visibleItems.length ? (
        <>
          <div className={s.stats}>
            <span>
              현재 제안 항목<strong>{currentItems.length}</strong>
            </span>
            <span>
              운영팀 검토
              <strong>
                {
                  currentItems.filter(
                    (item) => item.status === "ADMIN_REVIEW" && item.canReview,
                  ).length
                }
              </strong>
            </span>
            <span>
              공개본 있음
              <strong>
                {
                  currentItems.filter((item) =>
                    item.submissions.some(
                      (entry) => entry.releasedSnapshot !== null,
                    ),
                  ).length
                }
              </strong>
            </span>
          </div>
          <div className={s.layout}>
            <nav className={s.tasks} aria-label="게시·성과 항목">
              {visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={s.task}
                  style={{ display: "grid", whiteSpace: "normal" }}
                  disabled={busy || loading}
                  aria-current={selected?.id === item.id ? "true" : undefined}
                  onClick={() => {
                    setSelectedId(item.id);
                    setNotice("");
                    setError("");
                  }}
                >
                  <Status value={item.status} />
                  <strong>{item.creatorName}</strong>
                  <small>
                    {item.platform} · 제안 v{item.proposalVersion}
                    {!item.isCurrent ? " · 이전 기록" : ""}
                  </small>
                  <small>
                    {item.latestSubmission
                      ? `최신 제출 v${item.latestSubmission.version}`
                      : "제출 대기"}
                  </small>
                </button>
              ))}
            </nav>
            <div className={s.panel}>
              {selected ? (
                <ItemDetail
                  key={`${selected.id}:${selected.revision}`}
                  item={selected}
                  busy={busy || loading}
                  onReview={setAction}
                  onSubmit={(input) => void mutate(input)}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : current ? (
        <div className={s.empty}>
          <BarChart3 size={28} />
          <h4>콘텐츠 승인 후 성과 등록을 시작합니다</h4>
          <p>
            브랜드가 최종 콘텐츠를 승인하면 담당 에이전시가 게시·성과를 등록할
            수 있습니다.
          </p>
        </div>
      ) : null}
      <ReviewDialog
        action={action}
        busy={busy}
        error={action ? error : ""}
        onClose={() => {
          if (!busy) {
            setAction(null);
            setError("");
          }
        }}
        onSubmit={(input) => void mutate(input)}
      />
    </section>
  );
}
