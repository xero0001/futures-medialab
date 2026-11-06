"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CheckCheck,
  ClipboardCopy,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  AdminProductionItem,
  AdminProductionMutation,
  AdminProductionResponse,
  AdminProductionSubmission,
  ProductionStatus,
} from "@futures-medialab/database/production-types";
import { AdminButton } from "./_components/admin-button";
import s from "./production-review.module.css";

type MutationInput = AdminProductionMutation extends infer T
  ? T extends AdminProductionMutation
    ? Omit<T, "clientRequestId">
    : never
  : never;
type ReviewAction = {
  kind: "release" | "changes";
  item: AdminProductionItem;
  submission: AdminProductionSubmission;
};
const labels: Record<ProductionStatus, string> = {
  AWAITING_SUBMISSION: "제작물 제출 대기",
  ADMIN_REVIEW: "운영팀 검토",
  AGENCY_REVISION: "에이전시 수정 중",
  BRAND_REVIEW: "브랜드 검토 대기",
  BRAND_REVISION: "브랜드 수정 요청",
  APPROVED: "브랜드 승인 완료",
};
function Status({ value }: { value: ProductionStatus }) {
  const tone =
    value === "APPROVED"
      ? "green"
      : value === "BRAND_REVIEW" || value === "ADMIN_REVIEW"
        ? "blue"
        : value === "AGENCY_REVISION" || value === "BRAND_REVISION"
          ? "amber"
          : undefined;
  return (
    <span className={s.badge} data-tone={tone}>
      {labels[value]}
    </span>
  );
}
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "—";
function externalHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hostname.endsWith(".invalid")
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function ContentLink({ url, label }: { url: string; label: string }) {
  const href = externalHref(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <ExternalLink size={14} />
    </a>
  ) : (
    <span className={s.muted}>
      {url ? "시연용 자료 · 외부 연결 없음" : "자료 링크 미입력"}
    </span>
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
        : "제작물 검토 요청을 처리하지 못했습니다.",
    );
  }
  return body as T;
}

function ReleasePreview({
  item,
  title,
  url,
  note,
}: {
  item: AdminProductionItem;
  title: string;
  url: string;
  note: string;
}) {
  return (
    <div className={s.preview}>
      <div className={s.row}>
        <h4>{title || "브랜드에게 보여줄 제목"}</h4>
        <span className={s.badge} data-tone="blue">
          브랜드 공개 미리보기
        </span>
      </div>
      <p>
        {item.creatorName} · {item.platform} · 공식 제안 v{item.proposalVersion}
      </p>
      <ContentLink url={url} label="검토 자료 열기" />
      {note ? (
        <p className={s.pre}>{note}</p>
      ) : (
        <p className={s.muted}>브랜드에게 전달할 검토 안내를 입력하세요.</p>
      )}
    </div>
  );
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
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState(submission.internalNote);
  const [agencyFeedback, setAgencyFeedback] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const base = {
      campaignId: item.campaignId,
      productionItemId: item.id,
      submissionId: submission.id,
      expectedRevision: item.revision,
      internalNote,
    };
    onSubmit(
      release
        ? { ...base, action: "releaseToBrand", title, url, note }
        : { ...base, action: "requestChanges", agencyFeedback },
    );
  }
  function copySource() {
    setTitle(submission.title);
    setUrl(submission.url);
    setNote(submission.note);
  }
  return (
    <form onSubmit={submit}>
      <div className={s.dialogHeader}>
        <div>
          <h2 id="production-review-dialog-title">
            {release ? "브랜드 검토용으로 공개" : "에이전시에 수정 요청"}
          </h2>
          <p>
            {item.creatorName} · 제출 v{submission.version} · 공식 제안 v
            {item.proposalVersion}
          </p>
        </div>
        <AdminButton
          type="button"
          className="icon"
          aria-label="검토 창 닫기"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </AdminButton>
      </div>
      <div className={s.notice}>
        <ShieldCheck size={18} />
        <p>
          {release
            ? "브랜드는 아래 공개 내용만 확인합니다. 에이전시 제출 원문과 내부 메모는 전달되지 않습니다."
            : "수정 요청은 담당 에이전시에 전달됩니다. 새 제출 버전은 다시 운영팀 검토를 거칩니다."}
        </p>
      </div>
      <fieldset className={s.fieldset} disabled={busy}>
        {release ? (
          <>
            <div className={s.row}>
              <strong>브랜드에 공개할 내용</strong>
              <AdminButton type="button" onClick={copySource}>
                <ClipboardCopy size={15} />
                제출 원문에서 가져오기
              </AdminButton>
            </div>
            <label className={s.field}>
              공개 제목
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={2}
                maxLength={160}
                placeholder="브랜드가 확인할 제작물 제목"
              />
            </label>
            <label className={s.field}>
              공개 검토 자료 URL
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                maxLength={2048}
                placeholder="https://"
              />
              <small>
                공개 범위와 접근 권한을 확인한 검토 자료 링크를 입력하세요.
              </small>
            </label>
            <label className={s.field}>
              브랜드 검토 안내
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="반영된 요청과 브랜드가 확인할 부분을 정리하세요."
              />
            </label>
            <ReleasePreview item={item} title={title} url={url} note={note} />
          </>
        ) : (
          <>
            <div className={s.preview}>
              <strong>{submission.title}</strong>
              <ContentLink
                url={submission.url}
                label="에이전시 제출 원문 열기"
              />
              {submission.note ? (
                <p className={s.pre}>{submission.note}</p>
              ) : null}
            </div>
            <label className={s.field}>
              에이전시에 전달할 수정 요청
              <textarea
                value={agencyFeedback}
                onChange={(event) => setAgencyFeedback(event.target.value)}
                rows={4}
                minLength={2}
                maxLength={2000}
                required
                placeholder="수정이 필요한 부분과 이유, 다시 제출할 내용을 구체적으로 적어 주세요."
              />
            </label>
          </>
        )}
        <label className={s.field}>
          <span>
            <LockKeyhole size={14} /> 운영팀 내부 메모
          </span>
          <textarea
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="운영팀이 보관할 검토 내용"
          />
          <small>브랜드와 에이전시에는 공개되지 않습니다.</small>
        </label>
        {release ? (
          <label className={s.check}>
            <input type="checkbox" required />
            이름·자료 링크·검토 안내의 공개 범위를 확인했으며, 이 버전을
            브랜드에 공개합니다.
          </label>
        ) : null}
      </fieldset>
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={s.actions}>
        <AdminButton type="button" disabled={busy} onClick={onClose}>
          취소
        </AdminButton>
        <AdminButton className="primary" disabled={busy}>
          <Send size={16} />
          {busy ? "처리 중…" : release ? "브랜드에 공개" : "수정 요청 전달"}
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
      aria-labelledby="production-review-dialog-title"
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

function SupplierAssignment({
  item,
  suppliers,
  busy,
  onAssign,
}: {
  item: AdminProductionItem;
  suppliers: AdminProductionResponse["suppliers"];
  busy: boolean;
  onAssign: (supplierOrganizationId: string) => void;
}) {
  const [supplier, setSupplier] = useState(item.supplierOrganizationId ?? "");
  const dirty = supplier !== (item.supplierOrganizationId ?? "");
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        busy ||
        (dirty &&
          !window.confirm(
            "저장하지 않은 공급 파트너 선택을 버리고 이동할까요?",
          ))
      )
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("admin:navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("admin:navigate", guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [busy, dirty]);

  return (
    <form
      className={s.internal}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && supplier) onAssign(supplier);
      }}
    >
      <h5>
        <LockKeyhole size={15} />
        담당 공급 파트너 · 브랜드 비공개
      </h5>
      <label className={s.field}>
        담당 에이전시
        <select
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          required
          disabled={busy}
        >
          <option value="">파트너를 선택하세요</option>
          {suppliers.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <small>
          파트너가 제작물 제출을 시작하기 전까지 배정을 변경할 수 있습니다.
        </small>
      </label>
      <div className={s.actions}>
        <AdminButton
          disabled={
            busy || !supplier || supplier === item.supplierOrganizationId
          }
        >
          담당 파트너 배정
        </AdminButton>
      </div>
    </form>
  );
}

function ItemDetail({
  item,
  suppliers,
  busy,
  onReview,
  onAssign,
}: {
  item: AdminProductionItem;
  suppliers: AdminProductionResponse["suppliers"];
  busy: boolean;
  onReview: (action: ReviewAction) => void;
  onAssign: (supplierOrganizationId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const submission =
    item.submissions.find((entry) => entry.id === selectedId) ??
    item.latestSubmission;
  const isLatest = !!submission && submission.id === item.latestSubmission?.id;
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
      <dl className={s.context}>
        <div>
          <dt>승인된 제작 범위</dt>
          <dd className={s.pre}>
            {item.deliverables} · {item.quantity}건
          </dd>
        </div>
        <div>
          <dt>예정 게시 시각 · 한국 시간</dt>
          <dd>{date(item.scheduledAt)}</dd>
        </div>
        <div>
          <dt>사용권</dt>
          <dd className={s.pre}>{item.rights}</dd>
        </div>
        <div>
          <dt>담당 공급 파트너 · 내부</dt>
          <dd>{item.supplierName || "배정 대기"}</dd>
        </div>
      </dl>
      {item.canAssign ? (
        <SupplierAssignment
          key={`${item.id}:${item.revision}`}
          item={item}
          suppliers={suppliers}
          busy={busy}
          onAssign={onAssign}
        />
      ) : null}
      {item.submissions.length ? (
        <>
          <div className={s.row} style={{ marginTop: 24 }}>
            <h4>제출 버전</h4>
            <span className={s.muted}>
              원문과 공개 기록은 버전별로 보관됩니다.
            </span>
          </div>
          <div
            className={s.versions}
            role="group"
            aria-label="제작물 제출 버전"
          >
            {item.submissions.map((entry) => (
              <button
                type="button"
                key={entry.id}
                disabled={busy}
                aria-pressed={submission?.id === entry.id}
                onClick={() => setSelectedId(entry.id)}
              >
                v{entry.version}
                {entry.id === item.latestSubmission?.id ? " · 최신" : ""}
              </button>
            ))}
          </div>
          {submission ? (
            <>
              <div className={s.preview}>
                <div className={s.row}>
                  <strong>에이전시 제출 원문 · v{submission.version}</strong>
                  <Status value={submission.status} />
                </div>
                <h5>{submission.title}</h5>
                <ContentLink url={submission.url} label="제출 자료 열기" />
                {submission.note ? (
                  <p className={s.pre}>{submission.note}</p>
                ) : null}
                <small className={s.muted}>
                  제출 {date(submission.submittedAt)} · 운영팀만 검토하는
                  원문입니다.
                </small>
              </div>
              {submission.internalNote || submission.agencyFeedback ? (
                <div className={s.internal}>
                  <h5>
                    <LockKeyhole size={15} />
                    운영팀 검토 기록
                  </h5>
                  {submission.internalNote ? (
                    <div>
                      <strong>내부 메모</strong>
                      <p className={s.pre}>{submission.internalNote}</p>
                      <small className={s.muted}>브랜드·에이전시 비공개</small>
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
              {submission.releasedAt ? (
                <>
                  <div className={s.notice}>
                    <ShieldCheck size={18} />
                    <p>
                      브랜드 공개 {date(submission.releasedAt)} · 아래 내용이
                      브랜드에게 전달된 버전입니다.
                    </p>
                  </div>
                  <ReleasePreview
                    item={item}
                    title={submission.releasedTitle ?? ""}
                    url={submission.releasedUrl ?? ""}
                    note={submission.releasedNote ?? ""}
                  />
                  {submission.brandDecision ? (
                    <div className={s.internal}>
                      <h5>
                        <CheckCheck size={16} />
                        {submission.brandDecision === "APPROVE"
                          ? "브랜드 승인"
                          : "브랜드 수정 요청"}
                      </h5>
                      {submission.brandMessage ? (
                        <p className={s.pre}>{submission.brandMessage}</p>
                      ) : null}
                      <small className={s.muted}>
                        {date(submission.brandDecidedAt)}
                      </small>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className={s.footer}>
                {isLatest && item.canReview ? (
                  <>
                    <p className={s.muted}>
                      원문을 검토한 뒤 수정 요청을 보내거나, 브랜드가 검토할
                      내용을 별도로 공개하세요.
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
                        브랜드 검토용으로 공개
                      </AdminButton>
                    </div>
                  </>
                ) : (
                  <p className={s.muted}>
                    {!isLatest
                      ? "이전 제출 버전입니다. 최신 버전에서 검토를 진행해 주세요."
                      : item.reviewDisabledReason ||
                        "현재 단계의 다음 작업을 기다리고 있습니다."}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className={s.empty}>
          <FileCheck2 size={28} />
          <h4>첫 제작물 제출을 기다리고 있습니다</h4>
          <p>
            {item.supplierOrganizationId
              ? "담당 에이전시가 제출하면 운영팀 검토를 시작할 수 있습니다. 검토 후 공개하기 전까지 브랜드에는 제출 원문이 보이지 않습니다."
              : "담당 공급 파트너를 배정하면 에이전시가 승인된 제작 범위에 맞춰 자료를 제출할 수 있습니다."}
          </p>
        </div>
      )}
    </>
  );
}

export function ProductionReview({ campaignId }: { campaignId: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const [data, setData] = useState<AdminProductionResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<ReviewAction | null>(null);
  const pending = useRef(false);
  const retries = useRef(new Map<string, string>());
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
    request<AdminProductionResponse>(
      `/api/admin/production?campaignId=${encodeURIComponent(campaignId)}`,
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
              : "제작물을 불러오지 못했습니다.",
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
      const result = await request<AdminProductionResponse>(
        "/api/admin/production",
        { ...input, clientRequestId },
      );
      retries.current.delete(fingerprint);
      setData(result);
      setAction(null);
      setNotice(
        input.action === "prepare"
          ? "승인된 제안의 제작 항목을 준비했습니다."
          : input.action === "assign"
            ? "담당 공급 파트너를 배정했습니다."
            : input.action === "requestChanges"
              ? "에이전시에 수정 요청을 전달했습니다. 새 제출 버전은 다시 운영팀 검토를 거칩니다."
              : "브랜드 검토용 제작물을 공개했습니다. 브랜드가 이 버전을 확인하고 결정할 수 있습니다.",
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
      id="admin-production-review"
      className={s.workspace}
      aria-label="제작·검수"
      aria-busy={loading || busy}
    >
      <div className={s.heading}>
        <div>
          <h3>제작·검수</h3>
          <p>
            에이전시의 제출물을 먼저 검토하고, 공개한 버전만 브랜드가 승인하도록
            전달합니다.
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
              승인 항목 불러오기
            </AdminButton>
          ) : null}
        </div>
      </div>
      {current?.coverImageUrl ? (
        <div className={s.campaignArt}>
          <Image
            src={current.coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 900px"
            className={s.coverImage}
            unoptimized
          />
          <div className={s.artLabel}>
            {current.gameIconUrl ? (
              <Image
                src={current.gameIconUrl}
                alt=""
                width={44}
                height={44}
                className={s.gameIcon}
                unoptimized
              />
            ) : null}
            <strong>{current.campaignTitle}</strong>
          </div>
        </div>
      ) : null}
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
          제작물과 검토 내역을 불러오는 중입니다…
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
            <span className={s.stat}>
              현재 제안 항목<strong>{currentItems.length}</strong>
            </span>
            <span className={s.stat}>
              운영팀 검토
              <strong>
                {
                  currentItems.filter(
                    (item) => item.status === "ADMIN_REVIEW" && item.canReview,
                  ).length
                }
              </strong>
            </span>
            <span className={s.stat}>
              브랜드 검토
              <strong>
                {
                  currentItems.filter((item) => item.status === "BRAND_REVIEW")
                    .length
                }
              </strong>
            </span>
            <span className={s.stat}>
              승인 완료
              <strong>
                {
                  currentItems.filter((item) => item.status === "APPROVED")
                    .length
                }
              </strong>
            </span>
          </div>
          <div className={s.layout}>
            <nav className={s.tasks} aria-label="제작 항목">
              {visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={s.task}
                  disabled={busy}
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
                    {item.platform} · {item.quantity}건 · 제안 v
                    {item.proposalVersion}
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
                  suppliers={current.suppliers}
                  busy={busy || loading}
                  onReview={setAction}
                  onAssign={(supplierOrganizationId) =>
                    void mutate({
                      action: "assign",
                      campaignId,
                      productionItemId: selected.id,
                      expectedRevision: selected.revision,
                      supplierOrganizationId,
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        </>
      ) : current ? (
        <div className={s.empty}>
          <FileCheck2 size={30} />
          <h4>제작을 시작할 승인 항목이 없습니다</h4>
          <p>
            공식 제안의 전체 항목이 승인되면 제작 항목이 준비됩니다. 기존 승인
            제안이 있다면 승인 항목을 불러와 이어갈 수 있습니다.
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
