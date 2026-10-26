"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Inbox,
  MessageSquareText,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import { ProfileSelect } from "../../onboarding/brand/profile-select";
import "./request-workspace.css";

const statuses = [
  "REQUESTED",
  "IN_PROGRESS",
  "WAITING_BRAND",
  "RESOLVED",
  "CLOSED",
] as const;
const categories = [
  "general",
  "campaign",
  "revision",
  "contract",
  "settlement",
  "social-data",
  "brand-insight",
  "comments",
] as const;
type RequestStatus = (typeof statuses)[number];
type RequestCategory = (typeof categories)[number];
type Attachment = {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
  downloadUrl?: string;
};
type RequestRow = {
  id: string;
  title: string;
  tool: string;
  status: RequestStatus;
  priority: string;
  campaignId: string | null;
  campaignTitle: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};
type RequestDetail = RequestRow & {
  description: string;
  messages: {
    id: string;
    body: string;
    internal: false;
    authorName: string;
    authorRole: "ADMIN" | "BRAND";
    createdAt: string;
    attachments: Attachment[];
  }[];
  events: {
    id: string;
    action: string;
    actorName: string;
    createdAt: string;
    detail: string;
  }[];
  attachmentsEnabled: boolean;
  pendingAttachments: Attachment[];
};
type RequestList = {
  items: RequestRow[];
  total: number;
  page: number;
  pageSize: number;
  campaigns: { id: string; title: string }[];
};
type Text = (en: string, ko: string, zh: string) => string;

function statusLabel(status: string, t: Text) {
  const labels: Record<string, string> = {
    REQUESTED: t("Received", "접수됨", "已收到"),
    IN_PROGRESS: t("In progress", "처리 중", "处理中"),
    WAITING_BRAND: t("Your reply needed", "답변 필요", "等待您的回复"),
    RESOLVED: t("Resolved", "처리 완료", "已解决"),
    CLOSED: t("Closed", "종료", "已关闭"),
  };
  return labels[status] ?? status;
}

function categoryLabel(category: string, t: Text) {
  const labels: Record<string, string> = {
    general: t("General inquiry", "일반 문의", "一般咨询"),
    campaign: t("Campaign operation", "캠페인 운영", "推广活动运营"),
    revision: t("Revision request", "수정 요청", "修改请求"),
    contract: t("Contract", "계약", "合同"),
    settlement: t("Settlement", "정산", "结算"),
    "social-data": t(
      "Social data collection",
      "소셜 데이터 수집",
      "社媒数据采集",
    ),
    "brand-insight": t(
      "Brand promotion insights",
      "브랜드 홍보 분석",
      "品牌推广洞察",
    ),
    comments: t("Video comment analysis", "영상 댓글 분석", "视频评论分析"),
  };
  return labels[category] ?? category;
}

function eventLabel(event: RequestDetail["events"][number], t: Text) {
  if (event.action === "request.created")
    return t("Request received.", "요청이 접수되었습니다.", "请求已收到。");
  if (event.action === "request.reply")
    return t("A reply was added.", "답변이 등록되었습니다.", "已添加回复。");
  if (event.action === "request.reopened")
    return `${t("Further review requested", "재검토 요청", "请求重新审核")}: ${event.detail.replace(/^재검토 요청:\s*/, "")}`;
  if (event.action === "request.updated") {
    const labels: Record<string, string> = {
      접수: "REQUESTED",
      "처리 중": "IN_PROGRESS",
      "브랜드 회신 대기": "WAITING_BRAND",
      "처리 완료": "RESOLVED",
      종료: "CLOSED",
    };
    const states = event.detail.replace(/^상태 변경:\s*/, "").split(" → ");
    if (states.length === 2 && labels[states[0]!] && labels[states[1]!])
      return `${t("Status changed", "상태 변경", "状态变更")}: ${statusLabel(labels[states[0]!]!, t)} → ${statusLabel(labels[states[1]!]!, t)}`;
  }
  return event.detail;
}

function displayDate(value: string, locale: Locale, withTime = false) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime
      ? { hour: "2-digit" as const, minute: "2-digit" as const }
      : {}),
  }).format(new Date(value));
}

function fileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function Status({ value, t }: { value: string; t: Text }) {
  return (
    <span className={`cwr-status cwr-status-${value.toLowerCase()}`}>
      {statusLabel(value, t)}
    </span>
  );
}

function Files({ attachments }: { attachments: Attachment[] }) {
  return (
    <ul className="cwr-files">
      {attachments.map((file) => (
        <li key={file.id}>
          {file.downloadUrl ? (
            <a href={file.downloadUrl} target="_blank" rel="noreferrer">
              <Download size={17} aria-hidden="true" />
              <span>{file.fileName}</span>
              <span>{fileSize(file.size)}</span>
            </a>
          ) : (
            <span>
              {file.fileName} · {fileSize(file.size)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PendingFiles({
  attachments,
  busy,
  t,
  onRemove,
}: {
  attachments: Attachment[];
  busy: boolean;
  t: Text;
  onRemove: (file: Attachment) => Promise<void>;
}) {
  return (
    <ul className="cwr-pending-files">
      {attachments.map((file) => (
        <li key={file.id}>
          <Paperclip size={16} aria-hidden="true" />
          <span>
            {file.fileName} · {fileSize(file.size)}
          </span>
          <button
            type="button"
            disabled={busy}
            aria-label={t(
              `Remove ${file.fileName}`,
              `${file.fileName} 첨부 취소`,
              `移除 ${file.fileName}`,
            )}
            onClick={() => void onRemove(file)}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RequestWorkspace({ locale }: { locale: Locale }) {
  const t: Text = (en, ko, zh) =>
    locale === "ko" ? ko : locale === "zh" ? zh : en;
  const [data, setData] = useState<RequestList | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<RequestCategory>("general");
  const [campaignId, setCampaignId] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    // The effect synchronizes the loading indicator with an abortable API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      query: appliedQuery,
      status,
      page: String(page),
    });
    fetch(`/api/workspace/requests?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        const result = (await response.json()) as RequestList;
        setData(result);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            locale === "ko"
              ? "요청함을 불러오지 못했습니다. 새로고침하거나 다시 로그인해 주세요."
              : locale === "zh"
                ? "无法加载请求，请刷新或重新登录。"
                : "Could not load requests. Refresh or sign in again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [appliedQuery, status, page, revision, locale]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    // Request selection clears the previous detail; this tracks the new external fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    setDetailError("");
    fetch(`/api/workspace/requests/${encodeURIComponent(selectedId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("detail");
        const result = (await response.json()) as { request: RequestDetail };
        setDetail(result.request);
        setAttachments(result.request.pendingAttachments ?? []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setDetail(null);
          setDetailError(
            locale === "ko"
              ? "요청 내용을 불러오지 못했습니다. 새로고침해 주세요."
              : locale === "zh"
                ? "无法加载请求详情，请刷新。"
                : "Could not load request details. Please refresh.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, revision, locale]);

  useEffect(() => {
    if (compose) titleRef.current?.focus();
  }, [compose]);

  async function checked(response: Response) {
    if (response.ok) return response;
    const failure = await response.json().catch(() => null);
    if (response.status === 409)
      throw new Error(
        t(
          "This request changed. Refresh to see the latest status, then try again.",
          "요청 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
          "请求状态已更改，请刷新后重试。",
        ),
      );
    if (response.status === 401 || response.status === 403)
      throw new Error(
        t(
          "Please sign in again or check your workspace permissions.",
          "다시 로그인하거나 작업 공간 권한을 확인해 주세요.",
          "请重新登录或检查工作区权限。",
        ),
      );
    if (response.status === 429)
      throw new Error(
        t(
          "Too many requests. Try again shortly.",
          "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
          "请求过多，请稍后重试。",
        ),
      );
    if (failure?.code === "INVALID_INPUT" || response.status === 400)
      throw new Error(
        t(
          "Check the required fields and file requirements.",
          "필수 입력값과 첨부파일 조건을 확인해 주세요.",
          "请检查必填字段及附件要求。",
        ),
      );
    throw new Error(
      t(
        "Could not save. Refresh to check whether it was saved before retrying.",
        "저장하지 못했습니다. 새로고침으로 저장 여부를 확인한 후 다시 시도해 주세요.",
        "保存失败，请刷新确认保存状态后重试。",
      ),
    );
  }

  function chooseRequest(id: string) {
    setSelectedId(id);
    setDetail(null);
    setReply("");
    setAttachments([]);
    setReopening(false);
    setReopenReason("");
    setNotice("");
    requestAnimationFrame(() =>
      detailHeading.current?.focus({ preventScroll: true }),
    );
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || title.trim().length < 2 || !body.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await checked(
        await fetch("/api/workspace/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            tool: category,
            campaignId: campaignId || null,
            body: body.trim(),
          }),
        }),
      );
      const result = (await response.json()) as { id: string };
      setTitle("");
      setBody("");
      setCompose(false);
      setPage(1);
      setQuery("");
      setAppliedQuery("");
      setStatus("all");
      chooseRequest(result.id);
      setNotice(
        t(
          "Your request has been received. You can add files in a reply below.",
          "요청을 접수했습니다. 아래 답변란에서 파일을 추가할 수 있습니다.",
          "请求已收到，可在下方回复中添加文件。",
        ),
      );
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("Please try again.", "다시 시도해 주세요.", "请重试。"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy || !reply.trim() || attachments.length > 5) return;
    setBusy(true);
    setDetailError("");
    setNotice("");
    try {
      await checked(
        await fetch(
          `/api/workspace/requests/${encodeURIComponent(detail.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "message",
              body: reply.trim(),
              attachmentIds: attachments.map((file) => file.id),
            }),
          },
        ),
      );
      setReply("");
      setAttachments([]);
      setNotice(
        t(
          "Reply sent to the operations team.",
          "운영팀에 답변을 전달했습니다.",
          "回复已发送给运营团队。",
        ),
      );
      setRevision((value) => value + 1);
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : t(
              "Could not send the reply.",
              "답변을 보내지 못했습니다.",
              "无法发送回复。",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file || !detail || busy) return;
    if (
      file.size > 4 * 1024 * 1024 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type)
    ) {
      setDetailError(
        t(
          "Choose a PDF, PNG or JPEG file of up to 4 MB.",
          "4MB 이하의 PDF, PNG, JPEG 파일을 선택해 주세요.",
          "请选择不超过 4 MB 的 PDF、PNG 或 JPEG 文件。",
        ),
      );
      return;
    }
    setBusy(true);
    setDetailError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await checked(
        await fetch(
          `/api/workspace/requests/${encodeURIComponent(detail.id)}/attachments`,
          { method: "POST", body: form },
        ),
      );
      const result = (await response.json()) as { attachment: Attachment };
      setAttachments((items) => [...items, result.attachment]);
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : t(
              "Could not upload the file.",
              "파일을 업로드하지 못했습니다.",
              "无法上传文件。",
            ),
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAttachment(file: Attachment) {
    if (!detail || busy) return;
    setBusy(true);
    setDetailError("");
    try {
      const response = await checked(
        await fetch(
          `/api/workspace/requests/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(file.id)}`,
          { method: "DELETE" },
        ),
      );
      const result = (await response.json()) as {
        success: boolean;
        cleanupPending?: boolean;
      };
      setAttachments((items) => items.filter((item) => item.id !== file.id));
      if (result.cleanupPending) {
        setNotice(
          t(
            "The attachment was removed from the request. Storage cleanup is delayed and needs an operations check.",
            "요청에서 첨부를 취소했습니다. 저장소 파일 정리가 지연되어 운영팀의 확인이 필요합니다.",
            "附件已从请求中移除，存储清理延迟，需要运营团队检查。",
          ),
        );
      }
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : t(
              "Could not remove the attachment. Please retry.",
              "첨부를 취소하지 못했습니다. 다시 시도해 주세요.",
              "无法移除附件，请重试。",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy || reopenReason.trim().length < 2) return;
    setBusy(true);
    setDetailError("");
    try {
      await checked(
        await fetch(
          `/api/workspace/requests/${encodeURIComponent(detail.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reopen",
              version: detail.version,
              reason: reopenReason.trim(),
            }),
          },
        ),
      );
      setReopening(false);
      setReopenReason("");
      setNotice(
        t(
          "Requested further review from the operations team.",
          "운영팀에 재검토를 요청했습니다.",
          "已向运营团队请求重新审核。",
        ),
      );
      setRevision((value) => value + 1);
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : t(
              "Could not reopen the request.",
              "재검토를 요청하지 못했습니다.",
              "无法重新打开请求。",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)),
  );
  const activeDetail = detail?.id === selectedId ? detail : null;

  return (
    <div className="cwr-workspace">
      <div className="cwr-intro">
        <p>
          {t(
            "Keep campaign questions, files and operations replies in one place.",
            "캠페인 문의부터 자료 전달, 운영팀 답변까지 한곳에서 확인하세요.",
            "在同一处管理推广咨询、资料及运营团队回复。",
          )}
        </p>
        <button
          className="cw-button cw-button-primary"
          type="button"
          disabled={busy}
          aria-expanded={compose}
          onClick={() => setCompose(!compose)}
        >
          {compose ? (
            <X size={18} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          {compose
            ? t("Cancel", "취소", "取消")
            : t("New request", "새 요청", "新建请求")}
        </button>
      </div>
      <div className="cwr-delivery-note">
        <MessageSquareText size={19} aria-hidden="true" />
        <span>
          {t(
            "Replies are delivered here. Email notifications are not connected yet. Analysis requests are reviewed by the team, not processed automatically.",
            "답변은 이 요청함으로 전달됩니다. 이메일 알림은 아직 연결되지 않았으며, 분석 요청은 자동 실행되지 않고 운영팀이 검토합니다.",
            "回复将在此处提供，尚未连接电子邮件通知。分析请求由团队审核，不会自动执行。",
          )}
        </span>
      </div>
      {error && (
        <div className="cw-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="cw-success" role="status">
          <Check size={18} aria-hidden="true" /> {notice}
        </div>
      )}
      {compose && (
        <section
          className="cw-panel cwr-compose"
          aria-labelledby="request-create-heading"
        >
          <h2 id="request-create-heading">
            {t("Send a request", "운영팀에 요청하기", "向运营团队提交请求")}
          </h2>
          <form onSubmit={createRequest}>
            <fieldset disabled={busy}>
              <label className="cw-field">
                <span>{t("Title", "제목", "标题")} *</span>
                <input
                  ref={titleRef}
                  required
                  minLength={2}
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className="cwr-form-row">
                <ProfileSelect
                  id="request-category"
                  label={t("Category", "요청 유형", "请求类型")}
                  placeholder=""
                  required
                  value={category}
                  onChange={(value) => setCategory(value as RequestCategory)}
                  options={categories.map((value) => ({
                    value,
                    label: categoryLabel(value, t),
                  }))}
                />
                <ProfileSelect
                  id="request-campaign"
                  label={t("Related campaign", "관련 캠페인", "相关推广活动")}
                  placeholder={t("No campaign", "캠페인 없음", "无推广活动")}
                  value={campaignId}
                  onChange={setCampaignId}
                  options={[
                    {
                      value: "",
                      label: t("No campaign", "캠페인 없음", "无推广活动"),
                    },
                    ...(data?.campaigns ?? []).map((campaign) => ({
                      value: campaign.id,
                      label: campaign.title,
                    })),
                  ]}
                />
              </div>
              <label className="cw-field">
                <span>{t("Details", "상세 내용", "详细内容")} *</span>
                <textarea
                  required
                  rows={5}
                  maxLength={5000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={t(
                    "Tell us what you need, with any relevant dates or context.",
                    "요청 사항과 필요한 일정, 참고 내용을 알려주세요.",
                    "请说明您的需求、相关日期及背景。",
                  )}
                />
              </label>
              <p className="cwr-muted">
                {t(
                  "You can attach files to a reply after the request is created.",
                  "요청을 등록한 뒤 답변에 파일을 첨부할 수 있습니다.",
                  "创建请求后，可在回复中添加附件。",
                )}
              </p>
              <button
                type="submit"
                className="cw-button cw-button-primary"
                disabled={title.trim().length < 2 || !body.trim()}
              >
                <Send size={17} aria-hidden="true" />
                {busy
                  ? t("Sending…", "전송 중…", "发送中…")
                  : t("Submit request", "요청 접수", "提交请求")}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      <div className="cwr-layout">
        <section
          className="cw-panel cwr-inbox"
          aria-label={t("Request list", "요청 목록", "请求列表")}
        >
          <form
            className="cwr-search"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(query.trim());
              setPage(1);
            }}
          >
            <label className="cwr-search-input">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label={t("Search requests", "요청 검색", "搜索请求")}
                placeholder={t("Search requests", "요청 검색", "搜索请求")}
                maxLength={160}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button type="submit" className="cw-button" disabled={busy}>
              {t("Search", "검색", "搜索")}
            </button>
          </form>
          <ProfileSelect
            id="request-filter-status"
            label={t("Status", "진행 상태", "状态")}
            placeholder=""
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              {
                value: "all",
                label: t("All statuses", "전체 상태", "全部状态"),
              },
              ...statuses.map((value) => ({
                value,
                label: statusLabel(value, t),
              })),
            ]}
          />
          <div className="cwr-list-heading">
            <span>
              {t(
                `${data?.total ?? 0} requests`,
                `총 ${data?.total ?? 0}건`,
                `共 ${data?.total ?? 0} 个请求`,
              )}
            </span>
            <button
              type="button"
              className="cwr-icon-button"
              aria-label={t("Refresh requests", "요청 새로고침", "刷新请求")}
              disabled={busy || loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="cwr-list" aria-busy={loading}>
            {loading ? (
              <div className="cwr-empty" role="status">
                {t("Loading requests…", "요청을 불러오는 중…", "正在加载请求…")}
              </div>
            ) : !data?.items.length ? (
              <div className="cwr-empty">
                <Inbox size={32} aria-hidden="true" />
                <strong>
                  {t("No requests found", "요청이 없습니다", "暂无请求")}
                </strong>
                <p>
                  {t(
                    "Create a request, or try another filter.",
                    "새 요청을 작성하거나 검색 조건을 변경해 주세요.",
                    "请创建请求或更改筛选条件。",
                  )}
                </p>
              </div>
            ) : (
              data.items.map((item) => (
                <button
                  className={`cwr-list-item${selectedId === item.id ? " is-selected" : ""}`}
                  type="button"
                  disabled={busy}
                  key={item.id}
                  aria-pressed={selectedId === item.id}
                  onClick={() => chooseRequest(item.id)}
                >
                  <div>
                    <Status value={item.status} t={t} />
                    <span className="cwr-category">
                      {categoryLabel(item.tool, t)}
                    </span>
                  </div>
                  <strong>{item.title}</strong>
                  {item.campaignTitle && (
                    <span className="cwr-campaign-name">
                      {item.campaignTitle}
                    </span>
                  )}
                  <time dateTime={item.updatedAt}>
                    {t("Updated", "최근 변경", "更新于")}{" "}
                    {displayDate(item.updatedAt, locale)}
                  </time>
                </button>
              ))
            )}
          </div>
          <div className="cwr-pagination">
            <button
              type="button"
              className="cwr-icon-button"
              aria-label={t("Previous page", "이전 페이지", "上一页")}
              disabled={busy || loading || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              type="button"
              className="cwr-icon-button"
              aria-label={t("Next page", "다음 페이지", "下一页")}
              disabled={busy || loading || page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
        <section
          className="cw-panel cwr-detail"
          aria-label={t("Request details", "요청 상세", "请求详情")}
          aria-busy={detailLoading}
        >
          <h2
            className={!selectedId ? "cwr-visually-hidden" : "cwr-detail-label"}
            ref={detailHeading}
            tabIndex={-1}
          >
            {t("Request details", "요청 상세", "请求详情")}
          </h2>
          {detailError && (
            <div className="cw-error" role="alert">
              {detailError}
            </div>
          )}
          {!selectedId ? (
            <div className="cwr-empty cwr-detail-placeholder">
              <MessageSquareText size={40} aria-hidden="true" />
              <h3>
                {t(
                  "A single conversation, from request to resolution",
                  "요청부터 해결까지, 하나의 대화로",
                  "从请求到解决，一处完成",
                )}
              </h3>
              <p>
                {t(
                  "Choose a request to see progress and talk to the operations team.",
                  "목록에서 요청을 선택해 진행 상황을 확인하고 운영팀과 대화하세요.",
                  "请选择请求，查看进度并与运营团队沟通。",
                )}
              </p>
            </div>
          ) : detailLoading ? (
            <div className="cwr-empty" role="status">
              {t("Loading details…", "내용을 불러오는 중…", "正在加载详情…")}
            </div>
          ) : activeDetail ? (
            <>
              <div className="cwr-detail-header">
                <div>
                  <Status value={activeDetail.status} t={t} />
                  <span className="cwr-category">
                    {categoryLabel(activeDetail.tool, t)}
                  </span>
                </div>
                <h3>{activeDetail.title}</h3>
              </div>
              <dl className="cwr-metadata">
                <div>
                  <dt>{t("Campaign", "캠페인", "推广活动")}</dt>
                  <dd>
                    {activeDetail.campaignTitle ??
                      t("Not linked", "연결 안 됨", "未关联")}
                  </dd>
                </div>
                <div>
                  <dt>{t("Assignee", "담당자", "负责人")}</dt>
                  <dd>
                    {activeDetail.assigneeName ??
                      t("Awaiting assignment", "배정 대기", "等待分配")}
                  </dd>
                </div>
                <div>
                  <dt>{t("Received", "접수일", "提交日期")}</dt>
                  <dd>{displayDate(activeDetail.createdAt, locale)}</dd>
                </div>
                <div>
                  <dt>{t("Target date", "처리 목표일", "目标日期")}</dt>
                  <dd>
                    {activeDetail.dueAt
                      ? displayDate(activeDetail.dueAt, locale)
                      : t("Not set", "미정", "待定")}
                  </dd>
                </div>
              </dl>
              <div className="cwr-description">
                <h4>{t("Original request", "접수 내용", "请求内容")}</h4>
                <p>
                  {activeDetail.description ||
                    t(
                      "See the conversation below.",
                      "아래 대화 내용을 확인해 주세요.",
                      "请查看下方对话。",
                    )}
                </p>
              </div>
              <div className="cwr-conversation">
                <h4>
                  {t("Conversation", "운영팀과의 대화", "与运营团队的对话")}
                </h4>
                {activeDetail.messages.filter((message) => !message.internal)
                  .length === 0 ? (
                  <p className="cwr-muted">
                    {t(
                      "The operations team has received your request. Replies will appear here.",
                      "운영팀에 요청이 접수되었습니다. 답변이 등록되면 이곳에서 확인할 수 있습니다.",
                      "运营团队已收到您的请求，回复将显示在此处。",
                    )}
                  </p>
                ) : (
                  activeDetail.messages
                    .filter((message) => !message.internal)
                    .map((message) => (
                      <article
                        className={`cwr-message${message.authorRole === "ADMIN" ? " is-operations" : ""}`}
                        key={message.id}
                      >
                        <header>
                          <strong>{message.authorName}</strong>
                          <span>
                            {message.authorRole === "ADMIN"
                              ? t("Operations", "운영팀", "运营团队")
                              : t("Brand", "브랜드", "品牌")}
                          </span>
                          <time dateTime={message.createdAt}>
                            {displayDate(message.createdAt, locale, true)}
                          </time>
                        </header>
                        <p>{message.body}</p>
                        {message.attachments.length > 0 && (
                          <Files attachments={message.attachments} />
                        )}
                      </article>
                    ))
                )}
              </div>
              {activeDetail.status === "CLOSED" ? (
                <p className="cwr-delivery-note">
                  {t(
                    "This request is closed. For further help, create a new request.",
                    "종료된 요청입니다. 추가 도움이 필요하면 새 요청을 등록해 주세요.",
                    "此请求已关闭，如需更多帮助请创建新请求。",
                  )}
                </p>
              ) : (
                <>
                  {activeDetail.status === "RESOLVED" && (
                    <div className="cwr-resolved">
                      <p>
                        {t(
                          "Resolved by the operations team. Need further review?",
                          "운영팀이 처리를 완료했습니다. 추가 검토가 필요하신가요?",
                          "运营团队已完成处理，需要进一步审核吗？",
                        )}
                      </p>
                      <button
                        type="button"
                        className="cw-button"
                        disabled={busy}
                        aria-expanded={reopening}
                        onClick={() => setReopening(!reopening)}
                      >
                        {t(
                          "Request another review",
                          "재검토 요청",
                          "请求重新审核",
                        )}
                      </button>
                    </div>
                  )}
                  {reopening && activeDetail.status === "RESOLVED" && (
                    <form className="cwr-reply" onSubmit={reopen}>
                      <label className="cw-field">
                        <span>
                          {t(
                            "Reason for another review",
                            "재검토 요청 사유",
                            "重新审核原因",
                          )}
                        </span>
                        <textarea
                          required
                          rows={3}
                          minLength={2}
                          maxLength={1000}
                          value={reopenReason}
                          disabled={busy}
                          onChange={(event) =>
                            setReopenReason(event.target.value)
                          }
                        />
                      </label>
                      <button
                        type="submit"
                        className="cw-button cw-button-primary"
                        disabled={busy || reopenReason.trim().length < 2}
                      >
                        {t(
                          "Submit review request",
                          "재검토 요청하기",
                          "提交审核请求",
                        )}
                      </button>
                    </form>
                  )}
                  {activeDetail.status !== "RESOLVED" && (
                    <form className="cwr-reply" onSubmit={sendReply}>
                      <label className="cw-field">
                        <span>{t("Add a reply", "답변 작성", "添加回复")}</span>
                        <textarea
                          rows={4}
                          required
                          maxLength={5000}
                          value={reply}
                          disabled={busy}
                          onChange={(event) => setReply(event.target.value)}
                          placeholder={t(
                            "Add details or a question for the operations team.",
                            "운영팀에 전달할 내용이나 질문을 작성해 주세요.",
                            "请填写需要发送给运营团队的内容或问题。",
                          )}
                        />
                      </label>
                      {attachments.length > 0 && (
                        <PendingFiles
                          attachments={attachments}
                          busy={busy}
                          t={t}
                          onRemove={removeAttachment}
                        />
                      )}
                      <div className="cwr-reply-actions">
                        <div>
                          <input
                            ref={fileRef}
                            type="file"
                            className="cwr-visually-hidden"
                            aria-label={t(
                              "Attach a file",
                              "파일 첨부",
                              "添加附件",
                            )}
                            tabIndex={-1}
                            accept="application/pdf,image/png,image/jpeg"
                            disabled={
                              busy ||
                              !activeDetail.attachmentsEnabled ||
                              attachments.length >= 5
                            }
                            onChange={(event) =>
                              void upload(event.target.files?.[0])
                            }
                          />
                          <button
                            type="button"
                            className="cw-button"
                            disabled={
                              busy ||
                              !activeDetail.attachmentsEnabled ||
                              attachments.length >= 5
                            }
                            onClick={() => fileRef.current?.click()}
                          >
                            <Paperclip size={17} aria-hidden="true" />
                            {t("Attach file", "파일 첨부", "添加附件")}
                          </button>
                          <p className="cwr-muted">
                            {activeDetail.attachmentsEnabled
                              ? t(
                                  "PDF, PNG, JPEG · up to 4 MB each, 5 files",
                                  "PDF, PNG, JPEG · 파일당 4MB, 최대 5개",
                                  "PDF、PNG、JPEG · 每个最多 4 MB，最多 5 个",
                                )
                              : t(
                                  "File uploads are not available yet.",
                                  "파일 첨부가 아직 연결되지 않았습니다.",
                                  "尚未启用文件上传。",
                                )}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="cw-button cw-button-primary"
                          disabled={
                            busy || !reply.trim() || attachments.length > 5
                          }
                        >
                          <Send size={17} aria-hidden="true" />
                          {busy
                            ? t("Processing…", "처리 중…", "处理中…")
                            : t("Send reply", "답변 보내기", "发送回复")}
                        </button>
                      </div>
                      {attachments.length > 0 && (
                        <p className="cwr-muted">
                          {t(
                            "Uploaded files are shared with the team only when you send this reply.",
                            "업로드한 파일은 답변을 보낼 때 운영팀에 전달됩니다.",
                            "上传的文件仅在发送此回复时与团队共享。",
                          )}
                        </p>
                      )}
                      {attachments.length > 5 && (
                        <p className="cw-error" role="alert">
                          {t(
                            "More than 5 pending files were restored. Remove extra attachments before sending.",
                            "전송하지 않은 첨부가 5개 넘게 복구되었습니다. 답변 전송 전 초과 파일을 취소해 주세요.",
                            "已恢复超过 5 个待发送文件，请先移除多余附件再发送。",
                          )}
                        </p>
                      )}
                    </form>
                  )}
                </>
              )}
              {(activeDetail.status === "RESOLVED" ||
                activeDetail.status === "CLOSED") &&
                attachments.length > 0 && (
                  <div className="cwr-reply">
                    <h4>
                      {t(
                        "Unsent attachments",
                        "전송하지 않은 첨부",
                        "未发送的附件",
                      )}
                    </h4>
                    <p className="cwr-muted">
                      {t(
                        "These files have not been sent. You can remove them here.",
                        "이 파일들은 아직 전달되지 않았습니다. 필요하지 않은 첨부를 취소할 수 있습니다.",
                        "这些文件尚未发送，您可以移除不需要的附件。",
                      )}
                    </p>
                    <PendingFiles
                      attachments={attachments}
                      busy={busy}
                      t={t}
                      onRemove={removeAttachment}
                    />
                  </div>
                )}
              {activeDetail.events.length > 0 && (
                <details className="cwr-history">
                  <summary>
                    {t("Progress history", "진행 이력", "进度记录")}
                  </summary>
                  <ol>
                    {activeDetail.events.map((event) => (
                      <li key={event.id}>
                        <span>{eventLabel(event, t)}</span>
                        <span>
                          {event.actorName} ·{" "}
                          <time dateTime={event.createdAt}>
                            {displayDate(event.createdAt, locale, true)}
                          </time>
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          ) : (
            <button
              type="button"
              className="cw-button"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("Retry", "다시 시도", "重试")}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
