"use client";
import { AdminButton } from "./_components/admin-button";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Inbox,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import {
  requestPriorities,
  requestStatuses,
  type RequestAssignee,
  type RequestAttachment,
  type RequestDetail,
  type RequestPriority,
  type RequestRow,
  type RequestsResponse,
  type RequestStatus,
} from "../lib/request-types";
import "./request-console.css";

const categoryNames: Record<string, string> = {
  general: "일반 문의",
  campaign: "캠페인 상담",
  revision: "캠페인 변경",
  contract: "계약 문의",
  settlement: "정산 문의",
  "social-data": "크리에이터 데이터",
  "brand-insight": "브랜드 분석",
  comments: "댓글 분석",
};
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
const formatDate = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "미설정";
const formatSize = (size: number) =>
  size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
const isOverdue = (request: RequestRow) =>
  Boolean(
    request.dueAt &&
    !["RESOLVED", "CLOSED"].includes(request.status) &&
    new Date(request.dueAt).getTime() < Date.now(),
  );
const toKoreanDateInput = (value: string | null) =>
  value
    ? new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : "";

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new RequestError(
      typeof body.message === "string"
        ? body.message
        : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      response.status,
    );
  }
  return body as T;
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`ar-status ar-status-${status.toLowerCase()}`}>
      {requestStatuses[status] ?? status}
    </span>
  );
}

export function RequestConsole({
  userId,
  refreshToken = 0,
  onCampaign,
}: {
  userId: string;
  refreshToken?: number;
  onCampaign?: (id: string) => void;
}) {
  const [filters, setFilters] = useState({
    query: "",
    status: "all",
    priority: "all",
    assignee: "all",
    page: 1,
  });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<RequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [revision, setRevision] = useState(0);
  const detailSection = useRef<HTMLDivElement>(null);
  const queryString = new URLSearchParams({
    ...filters,
    page: String(filters.page),
  }).toString();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void requestJson<RequestsResponse>(`/api/admin/requests?${queryString}`, {
        signal: controller.signal,
      })
        .then((value) => {
          if (!controller.signal.aborted) {
            setResult(value);
            const lastPage = Math.max(
              1,
              Math.ceil(value.total / value.pageSize),
            );
            if (value.page > lastPage) {
              setFilters((current) => ({ ...current, page: lastPage }));
            }
          }
        })
        .catch((caught) => {
          if (!controller.signal.aborted) setError(errorMessage(caught));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryString, revision, refreshToken]);

  function filter(key: "status" | "priority" | "assignee", value: string) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }
  function searchRequests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({ ...current, query: search.trim(), page: 1 }));
  }
  function selectRequest(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      detailSection.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      detailSection.current?.focus({ preventScroll: true });
    });
  }
  const pageCount = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;

  return (
    <div className="ar-console">
      <section className="ar-metrics" aria-label="요청 처리 현황">
        {[
          { label: "미완료 요청", value: result?.counts.open, icon: Inbox },
          {
            label: "처리 기한 초과",
            value: result?.counts.overdue,
            icon: CalendarClock,
          },
          {
            label: "담당자 미배정",
            value: result?.counts.unassigned,
            icon: UserRound,
          },
        ].map((item) => (
          <div key={item.label}>
            <span className="ar-metric-icon">
              <item.icon size={21} />
            </span>
            <span>
              {item.label}
              <strong>
                {item.value?.toLocaleString() ?? "—"}
                <small>건</small>
              </strong>
            </span>
          </div>
        ))}
      </section>

      <section
        className="admin-panel ar-list"
        aria-label="브랜드 요청 목록"
        aria-busy={loading}
      >
        <form className="ar-filters" onSubmit={searchRequests}>
          <label className="ar-query">
            <span>요청 검색</span>
            <span className="ar-query-control">
              <Search size={19} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="제목, 브랜드 또는 캠페인 검색"
                maxLength={160}
              />
              <AdminButton type="submit" className="primary">
                검색
              </AdminButton>
            </span>
          </label>
          <label>
            <span>처리 상태</span>
            <select
              value={filters.status}
              onChange={(event) => filter("status", event.target.value)}
            >
              <option value="all">전체 상태</option>
              {Object.entries(requestStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>우선순위</span>
            <select
              value={filters.priority}
              onChange={(event) => filter("priority", event.target.value)}
            >
              <option value="all">전체 우선순위</option>
              {Object.entries(requestPriorities).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>담당자</span>
            <select
              value={filters.assignee}
              onChange={(event) => filter("assignee", event.target.value)}
            >
              <option value="all">전체 담당자</option>
              <option value="unassigned">미배정</option>
              {result?.assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                  {assignee.id === userId ? " (나)" : ""}
                </option>
              ))}
            </select>
          </label>
        </form>
        <div className="ar-list-caption">
          <p aria-live="polite">
            {loading
              ? "요청을 불러오는 중…"
              : `총 ${(result?.total ?? 0).toLocaleString()}건의 요청`}
          </p>
          <AdminButton
            type="button"
            className="admin-text-button"
            onClick={() => {
              setSearch("");
              setFilters({
                query: "",
                status: "all",
                priority: "all",
                assignee: "all",
                page: 1,
              });
            }}
          >
            필터 초기화
          </AdminButton>
        </div>
        {error ? (
          <div className="admin-alert error" role="alert">
            {error}
            <AdminButton
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              다시 시도
            </AdminButton>
          </div>
        ) : null}
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr>
                <th scope="col">요청 · 브랜드</th>
                <th scope="col">상태</th>
                <th scope="col">우선순위</th>
                <th scope="col">담당자</th>
                <th scope="col">처리 기한 · 접수일</th>
                <th scope="col">상세</th>
              </tr>
            </thead>
            <tbody>
              {result?.items.map((request) => (
                <tr
                  key={request.id}
                  className={
                    selectedId === request.id ? "ar-selected-row" : undefined
                  }
                >
                  <td>
                    <strong>{request.title}</strong>
                    <span>
                      {request.organizationName} ·{" "}
                      {categoryNames[request.tool] ?? request.tool}
                    </span>
                    {request.campaignTitle ? (
                      <span className="ar-campaign-caption">
                        {request.campaignTitle}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>
                    <span
                      className={`ar-priority ar-priority-${request.priority.toLowerCase()}`}
                    >
                      {requestPriorities[request.priority] ?? request.priority}
                    </span>
                  </td>
                  <td>{request.assigneeName ?? "미배정"}</td>
                  <td>
                    <span
                      className={isOverdue(request) ? "ar-overdue" : undefined}
                    >
                      {isOverdue(request) ? "기한 초과 · " : ""}
                      {formatDate(request.dueAt)}
                    </span>
                    <span>접수 {formatDate(request.createdAt)}</span>
                  </td>
                  <td>
                    <AdminButton
                      type="button"
                      aria-label={`${request.title} 상세 보기`}
                      onClick={() => selectRequest(request.id)}
                    >
                      보기 <ChevronRight size={16} />
                    </AdminButton>
                  </td>
                </tr>
              ))}
              {!result?.items.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="ar-empty">
                      <Inbox size={28} />
                      <strong>
                        {loading
                          ? "브랜드 요청을 불러오고 있습니다."
                          : "조건에 맞는 요청이 없습니다."}
                      </strong>
                      <p>
                        {loading
                          ? "잠시만 기다려 주세요."
                          : "브랜드가 접수한 요청이 이곳에 표시됩니다. 검색 조건도 확인해 주세요."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav className="ar-pagination" aria-label="요청 목록 페이지">
          <span>
            {result?.page ?? filters.page} / {pageCount} 페이지
          </span>
          <div>
            <AdminButton
              type="button"
              disabled={loading || filters.page <= 1}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
            >
              <ChevronLeft size={17} /> 이전
            </AdminButton>
            <AdminButton
              type="button"
              disabled={loading || filters.page >= pageCount}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
            >
              다음 <ChevronRight size={17} />
            </AdminButton>
          </div>
        </nav>
      </section>

      <div ref={detailSection} tabIndex={-1} className="ar-detail-anchor">
        {selectedId ? (
          <RequestWorkspace
            key={selectedId}
            id={selectedId}
            userId={userId}
            assignees={result?.assignees ?? []}
            refreshToken={refreshToken}
            onClose={() => setSelectedId("")}
            onCampaign={onCampaign}
            onChanged={() => setRevision((value) => value + 1)}
          />
        ) : null}
      </div>
    </div>
  );
}

function RequestWorkspace({
  id,
  userId,
  assignees,
  refreshToken,
  onClose,
  onCampaign,
  onChanged,
}: {
  id: string;
  userId: string;
  assignees: RequestAssignee[];
  refreshToken: number;
  onClose: () => void;
  onCampaign?: (id: string) => void;
  onChanged: () => void;
}) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ request: RequestDetail }>(
      `/api/admin/requests/${encodeURIComponent(id)}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setRequest(value.request);
          setError("");
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision, refreshToken]);
  function reload() {
    setLoading(true);
    setRevision((value) => value + 1);
  }
  function changed() {
    reload();
    onChanged();
  }
  return (
    <section className="ar-detail" aria-label="요청 상세" aria-busy={loading}>
      <div className="ar-detail-top">
        <span className="admin-eyebrow">요청 상세</span>
        <div>
          <AdminButton
            type="button"
            className="admin-text-button"
            disabled={loading}
            onClick={reload}
          >
            <RefreshCw size={16} /> 상세 새로고침
          </AdminButton>
          <AdminButton
            type="button"
            className="icon"
            aria-label="요청 상세 닫기"
            onClick={onClose}
          >
            <X size={20} />
          </AdminButton>
        </div>
      </div>
      {error ? (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !request ? (
        <div className="admin-panel admin-empty" role="status">
          요청 내용을 불러오는 중입니다…
        </div>
      ) : null}
      {request ? (
        <>
          <div className="ar-detail-heading">
            <h2>{request.title}</h2>
            <StatusBadge status={request.status} />
            <p>
              {request.organizationName} ·{" "}
              {categoryNames[request.tool] ?? request.tool}
              <span>접수 {formatDate(request.createdAt)}</span>
            </p>
          </div>
          <div className="ar-detail-grid">
            <div className="ar-thread">
              <section className="admin-panel">
                <h3>요청 내용</h3>
                <p className="ar-preserve">
                  {request.description || "추가 요청 내용이 없습니다."}
                </p>
                {request.campaignId ? (
                  <div className="ar-campaign-context">
                    <span>관련 캠페인</span>
                    {onCampaign ? (
                      <AdminButton
                        type="button"
                        className="admin-text-button"
                        onClick={() => onCampaign(request.campaignId!)}
                      >
                        {request.campaignTitle ?? "캠페인 상세"}
                        <ArrowUpRight size={17} />
                      </AdminButton>
                    ) : (
                      <strong>
                        {request.campaignTitle ?? request.campaignId}
                      </strong>
                    )}
                  </div>
                ) : null}
              </section>
              <section className="admin-panel ar-conversation">
                <h3>
                  <MessageSquare size={20} /> 답변 · 내부 메모
                </h3>
                <p className="ar-help">
                  공개 답변은 브랜드에게 표시됩니다. 내부 메모는 운영팀만 확인할
                  수 있습니다.
                </p>
                <div className="ar-messages">
                  {request.messages.length ? (
                    request.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`ar-message${message.internal ? " ar-message-internal" : ""}`}
                      >
                        <header>
                          <strong>{message.authorName}</strong>
                          <span>
                            {message.internal ? (
                              <>
                                <LockKeyhole size={14} /> 내부 메모
                              </>
                            ) : message.authorRole === "BRAND" ? (
                              "브랜드"
                            ) : (
                              "운영팀 답변"
                            )}
                          </span>
                          <time dateTime={message.createdAt}>
                            {formatDate(message.createdAt)}
                          </time>
                        </header>
                        <p className="ar-preserve">{message.body}</p>
                        {message.attachments.length ? (
                          <ul className="ar-attachments">
                            {message.attachments.map((attachment) => (
                              <li key={attachment.id}>
                                <a
                                  href={attachment.downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download size={16} />
                                  <span>{attachment.fileName}</span>
                                  <small>{formatSize(attachment.size)}</small>
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="ar-no-messages">
                      아직 답변이 없습니다. 첫 답변이나 검토 메모를 남겨주세요.
                    </p>
                  )}
                </div>
                <ReplyForm request={request} onChanged={changed} />
              </section>
              <section className="admin-panel ar-history">
                <h3>
                  <Clock3 size={20} /> 처리 이력
                </h3>
                {request.events.length ? (
                  <ol>
                    {request.events.map((event) => (
                      <li key={event.id}>
                        <span className="ar-history-dot" aria-hidden="true" />
                        <div>
                          <strong>{event.actorName}</strong>
                          <p className="ar-preserve">{event.detail}</p>
                          <time dateTime={event.createdAt}>
                            {formatDate(event.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ar-help">아직 처리 이력이 없습니다.</p>
                )}
              </section>
            </div>
            <RequestManagement
              key={`${request.id}:${request.version}`}
              request={request}
              assignees={assignees}
              userId={userId}
              onChanged={changed}
              onReload={reload}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function RequestManagement({
  request,
  assignees,
  userId,
  onChanged,
  onReload,
}: {
  request: RequestDetail;
  assignees: RequestAssignee[];
  userId: string;
  onChanged: () => void;
  onReload: () => void;
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [priority, setPriority] = useState<RequestPriority>(request.priority);
  const [assignee, setAssignee] = useState(request.assigneeId ?? "");
  const [dueAt, setDueAt] = useState(toKoreanDateInput(request.dueAt));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (reason.trim().length < 2) {
      setError("처리 사유를 2자 이상 입력해 주세요.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    setSuccess(false);
    setConflict(false);
    try {
      await requestJson(
        `/api/admin/requests/${encodeURIComponent(request.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            version: request.version,
            status,
            priority,
            assignedToId: assignee || null,
            dueAt: dueAt ? new Date(`${dueAt}:00+09:00`).toISOString() : null,
            reason: reason.trim(),
          }),
        },
      );
      setSuccess(true);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
      setConflict(caught instanceof RequestError && caught.status === 409);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <aside className="admin-panel ar-management">
      <h3>요청 처리</h3>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            처리 상태
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as RequestStatus)
              }
            >
              {Object.entries(requestStatuses).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={request.status === "CLOSED" && value !== "CLOSED"}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            우선순위
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as RequestPriority)
              }
            >
              {Object.entries(requestPriorities).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            담당자
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">미배정</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.id === userId ? " (나)" : ""}
                </option>
              ))}
            </select>
          </label>
          {assignees.some((item) => item.id === userId) &&
          assignee !== userId ? (
            <AdminButton
              type="button"
              className="admin-text-button ar-assign-me"
              onClick={() => setAssignee(userId)}
            >
              <UserRound size={16} /> 나에게 배정
            </AdminButton>
          ) : null}
          <label>
            처리 기한 <span className="ar-optional">(한국 시간)</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <label>
            처리 사유
            <textarea
              rows={4}
              required
              minLength={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="상태 변경 및 담당자 배정 사유를 기록하세요."
            />
          </label>
          <p className="ar-help">
            처리 사유는 내부 이력에 남습니다. 브랜드에게 안내할 내용은 공개
            답변으로 보내주세요.
          </p>
          {status === "CLOSED" && request.status !== "CLOSED" ? (
            <label className="ar-close-confirm">
              <input type="checkbox" required />
              <span>
                종료하면 다시 열거나 답변할 수 없음을 확인했습니다. 후속 논의가
                예상되면 ‘처리 완료’를 선택하세요.
              </span>
            </label>
          ) : null}
          <AdminButton
            type="submit"
            className="primary ar-full"
            disabled={busy || conflict}
          >
            <Check size={17} />
            {busy ? "저장 중…" : "처리 정보 저장"}
          </AdminButton>
        </fieldset>
        {error ? (
          <p className="admin-alert error" role="alert">
            {error}
          </p>
        ) : null}
        {conflict ? (
          <AdminButton type="button" onClick={onReload}>
            최신 내용 다시 불러오기
          </AdminButton>
        ) : null}
        {success ? (
          <p className="admin-alert success" role="status">
            처리 정보를 저장했습니다.
          </p>
        ) : null}
      </form>
    </aside>
  );
}

function ReplyForm({
  request,
  onChanged,
}: {
  request: RequestDetail;
  onChanged: () => void;
}) {
  const [internal, setInternal] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<RequestAttachment[]>(
    request.pendingAttachments,
  );
  const [discarding, setDiscarding] = useState("");
  const [cleanupPending, setCleanupPending] = useState<RequestAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const closed = request.status === "CLOSED";
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!working.current) setAttachments(request.pendingAttachments);
    }, 0);
    return () => clearTimeout(timer);
  }, [request.pendingAttachments]);
  async function discard(attachment: RequestAttachment) {
    if (working.current) return;
    working.current = true;
    setDiscarding(attachment.id);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<{
        success: true;
        cleanupPending: boolean;
      }>(
        `/api/admin/requests/${encodeURIComponent(request.id)}/attachments/${encodeURIComponent(attachment.id)}`,
        { method: "DELETE" },
      );
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      setCleanupPending((current) =>
        result.cleanupPending
          ? [...current.filter((item) => item.id !== attachment.id), attachment]
          : current.filter((item) => item.id !== attachment.id),
      );
      setNotice(
        result.cleanupPending
          ? "첨부 접근을 차단했습니다. 저장소 정리는 아래에서 다시 시도할 수 있습니다."
          : "미전송 첨부파일을 취소하고 저장소에서 삭제했습니다.",
      );
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      working.current = false;
      setDiscarding("");
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || working.current) return;
    setError("");
    setNotice("");
    if (file.size > 4 * 1024 * 1024 || file.size === 0) {
      setError("0바이트보다 크고 4MB 이하인 파일을 선택해 주세요.");
      return;
    }
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
      setError("PDF, PNG, JPG 파일만 첨부할 수 있습니다.");
      return;
    }
    working.current = true;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await requestJson<{ attachment: RequestAttachment }>(
        `/api/admin/requests/${encodeURIComponent(request.id)}/attachments`,
        { method: "POST", body: form },
      );
      setAttachments((current) => [...current, result.attachment]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      working.current = false;
      setUploading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working.current) return;
    if (!body.trim()) {
      setError("답변 내용을 입력해 주세요.");
      return;
    }
    if (attachments.length > 5) {
      setError(
        "답변 한 건에는 최대 5개 파일을 첨부할 수 있습니다. 불필요한 미전송 첨부를 취소해 주세요.",
      );
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson(
        `/api/admin/requests/${encodeURIComponent(request.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "message",
            body: body.trim(),
            internal,
            attachmentIds: attachments.map((attachment) => attachment.id),
          }),
        },
      );
      setBody("");
      setAttachments([]);
      setNotice(
        internal
          ? "내부 메모를 저장했습니다."
          : "브랜드에게 공개 답변을 전달했습니다.",
      );
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="ar-reply" onSubmit={submit}>
      {attachments.length ? (
        <div className="ar-pending-files">
          <strong>내 미전송 첨부 ({attachments.length})</strong>
          <p className="ar-help">
            새로고침 후에도 복원됩니다. 아래 파일은 아직 브랜드나 다른
            운영자에게 공개되지 않았습니다.
          </p>
          <ul className="ar-upload-list">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <Paperclip size={16} />
                <span>
                  {attachment.downloadUrl ? (
                    <a
                      href={attachment.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.fileName}
                    </a>
                  ) : (
                    attachment.fileName
                  )}{" "}
                  <small>{formatSize(attachment.size)}</small>
                </span>
                <AdminButton
                  type="button"
                  className="icon"
                  aria-label={`${attachment.fileName} 첨부 취소`}
                  disabled={busy || uploading || Boolean(discarding)}
                  onClick={() => void discard(attachment)}
                >
                  {discarding === attachment.id ? (
                    <RefreshCw size={16} className="admin-spin" />
                  ) : (
                    <X size={16} />
                  )}
                </AdminButton>
              </li>
            ))}
          </ul>
          {attachments.length > 5 ? (
            <p className="ar-help">
              한 답변에는 최대 5개까지 전송할 수 있습니다. 불필요한 첨부를
              취소해 주세요.
            </p>
          ) : null}
        </div>
      ) : null}
      {cleanupPending.length ? (
        <div className="ar-pending-files">
          <strong>저장소 정리 대기</strong>
          <p className="ar-help">
            아래 파일은 접근이 차단되어 답변에 첨부할 수 없습니다.
          </p>
          <ul className="ar-upload-list">
            {cleanupPending.map((attachment) => (
              <li key={attachment.id}>
                <span>{attachment.fileName}</span>
                <AdminButton
                  type="button"
                  disabled={busy || uploading || Boolean(discarding)}
                  onClick={() => void discard(attachment)}
                >
                  {discarding === attachment.id ? "정리 중…" : "정리 재시도"}
                </AdminButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <fieldset disabled={busy || uploading || Boolean(discarding) || closed}>
        <legend className="ar-sr-only">답변 작성</legend>
        <div
          className="ar-reply-modes"
          role="group"
          aria-label="답변 공개 범위"
        >
          <AdminButton
            type="button"
            aria-pressed={!internal}
            onClick={() => setInternal(false)}
          >
            <MessageSquare size={17} /> 공개 답변
          </AdminButton>
          <AdminButton
            type="button"
            aria-pressed={internal}
            onClick={() => setInternal(true)}
          >
            <LockKeyhole size={17} /> 내부 메모
          </AdminButton>
        </div>
        <label>
          <span>
            {internal ? "운영팀에 남길 메모" : "브랜드에게 보낼 답변"}
          </span>
          <textarea
            required
            maxLength={5000}
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              internal
                ? "검토 내용과 운영팀 협의 사항을 남겨주세요."
                : "문의에 대한 안내나 추가로 필요한 정보를 작성해 주세요."
            }
          />
        </label>
        <p className="ar-help">
          {internal
            ? "이 메모와 첨부파일은 브랜드에게 보이지 않습니다."
            : "이 답변과 첨부파일은 요청한 브랜드에게 표시됩니다."}
        </p>
        <input
          ref={fileInput}
          className="ar-sr-only"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(event) => void upload(event)}
          tabIndex={-1}
          aria-label="답변 첨부파일 선택"
          disabled={!request.attachmentsEnabled || busy || uploading || closed}
        />
        <div className="ar-reply-actions">
          <AdminButton
            type="button"
            disabled={!request.attachmentsEnabled || attachments.length >= 5}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={17} />
            {uploading ? "업로드 중…" : "파일 첨부"}
          </AdminButton>
          <AdminButton
            type="submit"
            className="primary"
            disabled={!body.trim()}
          >
            <Send size={16} />
            {busy
              ? "저장 중…"
              : internal
                ? "내부 메모 저장"
                : "공개 답변 보내기"}
          </AdminButton>
        </div>
        <p className="ar-help">
          {request.attachmentsEnabled
            ? "PDF · PNG · JPG, 파일당 최대 4MB · 최대 5개"
            : "파일 저장소가 연결되지 않아 첨부할 수 없습니다. 텍스트 답변은 가능합니다."}
        </p>
      </fieldset>
      {closed ? (
        <p className="ar-help">
          종료된 요청은 다시 열거나 답변할 수 없습니다. 후속 문의는 브랜드가 새
          요청으로 접수해야 합니다.
        </p>
      ) : null}
      {error ? (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="admin-alert success" role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
