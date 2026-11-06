"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCheck,
  ExternalLink,
  Eye,
  FileText,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import s from "./official-proposals.module.css";
import { ProposalCostEditor } from "./proposal-cost-editor";

import type {
  AdminProposal,
  AdminProposalMutation,
  AdminProposalsResponse,
  AdminProposalCreatorOption,
  ProposalDraftInput,
} from "@futures-medialab/database/proposal-types";

type Proposal = AdminProposal;
type ProposalData = AdminProposalsResponse;
type CreatorOption = AdminProposalCreatorOption;
type Preview = Pick<
  Proposal,
  | "id"
  | "version"
  | "status"
  | "title"
  | "summary"
  | "currency"
  | "expiresAt"
  | "publishedAt"
  | "terms"
  | "changeSummary"
  | "totalAmount"
  | "items"
  | "decisions"
>;
type MutationInput = AdminProposalMutation extends infer T
  ? T extends AdminProposalMutation
    ? Omit<T, "clientRequestId">
    : never
  : never;
type ItemDraft = {
  key: string;
  creatorId: string;
  creatorName: string;
  platform: string;
  channelLabel: string;
  channelUrl: string;
  followers: string;
  averageViews: string;
  deliverables: string;
  quantity: string;
  unitAmount: string;
  rights: string;
  scheduledAt: string;
  supplierCost: string;
  internalNotes: string;
};
type Draft = {
  title: string;
  summary: string;
  expiresAt: string;
  terms: string;
  changeSummary: string;
  items: ItemDraft[];
};
const labels: Record<string, string> = {
  DRAFT: "비공개 초안",
  PUBLISHED: "브랜드 검토 대기",
  PARTIALLY_APPROVED: "일부 승인",
  APPROVED: "브랜드 승인",
  CHANGES_REQUESTED: "수정 요청",
  REJECTED: "반려",
  SUPERSEDED: "이전 버전",
  PENDING: "검토 대기",
  ACCEPTED: "승인",
};
function Status({
  value,
  expiresAt,
}: {
  value: string;
  expiresAt?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const expired =
    expiresAt &&
    Date.parse(expiresAt) <= now &&
    ["PUBLISHED", "CHANGES_REQUESTED", "REJECTED"].includes(value);
  const tone = ["APPROVED", "ACCEPTED"].includes(value)
    ? "green"
    : ["REJECTED"].includes(value)
      ? "red"
      : ["CHANGES_REQUESTED", "PARTIALLY_APPROVED"].includes(value)
        ? "amber"
        : value === "PUBLISHED"
          ? "blue"
          : undefined;
  return (
    <span className={s.badge} data-tone={tone}>
      {expired ? "기한 만료 · 재제안 필요" : (labels[value] ?? value)}
    </span>
  );
}
const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "—";
const formatMoney = (value: string | number, currency: string) =>
  `${currency} ${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const dateInput = (value: string | null) =>
  value
    ? new Date(new Date(value).getTime() + 9 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
const dateIso = (value: string) =>
  value ? new Date(`${value}:00+09:00`).toISOString() : null;
const blankItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  creatorId: "",
  creatorName: "",
  platform: "youtube",
  channelLabel: "",
  channelUrl: "",
  followers: "",
  averageViews: "",
  deliverables: "",
  quantity: "1",
  unitAmount: "",
  rights: "",
  scheduledAt: "",
  supplierCost: "",
  internalNotes: "",
});
function draftFrom(proposal: Proposal): Draft {
  return {
    title: proposal.title,
    summary: proposal.summary,
    expiresAt: dateInput(proposal.expiresAt),
    terms: proposal.terms,
    changeSummary: proposal.changeSummary,
    items: proposal.items.map((item) => ({
      key: item.id,
      creatorId: item.creatorId ?? "",
      creatorName: item.creatorName,
      platform: item.platform,
      channelLabel: item.channelLabel,
      channelUrl: item.channelUrl,
      followers: item.followers === null ? "" : String(item.followers),
      averageViews: item.averageViews === null ? "" : String(item.averageViews),
      deliverables: item.deliverables,
      quantity: String(item.quantity),
      unitAmount: item.unitAmount,
      rights: item.rights,
      scheduledAt: dateInput(item.scheduledAt),
      supplierCost: item.supplierCost ?? "",
      internalNotes: item.internalNotes,
    })),
  };
}
function toInput(draft: Draft): ProposalDraftInput {
  return {
    title: draft.title,
    summary: draft.summary,
    changeSummary: draft.changeSummary,
    terms: draft.terms,
    expiresAt: dateIso(draft.expiresAt),
    items: draft.items.map((item) => ({
      creatorId: item.creatorId || null,
      creatorName: item.creatorName,
      platform: item.platform,
      channelLabel: item.channelLabel,
      channelUrl: item.channelUrl,
      followers: item.followers === "" ? null : Number(item.followers),
      averageViews: item.averageViews === "" ? null : Number(item.averageViews),
      deliverables: item.deliverables,
      quantity: Number(item.quantity) || 0,
      unitAmount: item.unitAmount || "0",
      scheduledAt: dateIso(item.scheduledAt),
      rights: item.rights,
      supplierCost: item.supplierCost || null,
      internalNotes: item.internalNotes,
    })),
  };
}
function publicPreview(draft: Draft, original: Proposal): Preview {
  const input = toInput(draft);
  return {
    ...original,
    status: "DRAFT",
    title: draft.title,
    summary: draft.summary,
    expiresAt: input.expiresAt,
    publishedAt: null,
    terms: draft.terms,
    changeSummary: draft.changeSummary,
    decisions: [],
    totalAmount: String(
      input.items.reduce(
        (sum, item) => sum + (Number(item.unitAmount) || 0) * item.quantity,
        0,
      ),
    ),
    items: input.items.map((item, index) => ({
      ...item,
      id: draft.items[index]!.key,
      totalAmount: String((Number(item.unitAmount) || 0) * item.quantity),
      supplierOrganizationId: null,
      status: "PENDING",
    })),
  };
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
        : "제안서를 처리하지 못했습니다. 다시 시도해 주세요.",
    );
  }
  return body as T;
}

function demoChannel(value: string) {
  try {
    return new URL(value).hostname.endsWith(".invalid");
  } catch {
    return false;
  }
}

function ProposalPreview({ proposal }: { proposal: Preview }) {
  return (
    <>
      <div className={s.row}>
        <div>
          <span className={s.muted}>공식 제안 · v{proposal.version}</span>
          <h4>{proposal.title || "제안서 제목"}</h4>
        </div>
        <Status value={proposal.status} expiresAt={proposal.expiresAt} />
      </div>
      {proposal.summary ? (
        <p className={s.pre} style={{ marginTop: 16 }}>
          {proposal.summary}
        </p>
      ) : null}
      <dl className={s.summary}>
        <div>
          <dt>총 제안 금액</dt>
          <dd>{formatMoney(proposal.totalAmount, proposal.currency)}</dd>
        </div>
        <div>
          <dt>제안 항목</dt>
          <dd>{proposal.items.length}건</dd>
        </div>
        <div>
          <dt>승인 유효기간 · 한국 시간</dt>
          <dd>{formatDate(proposal.expiresAt)}</dd>
        </div>
      </dl>
      {proposal.changeSummary ? (
        <div className={s.notice}>
          <FileText size={18} />
          <div>
            <strong>이번 버전의 변경 내용</strong>
            <p className={s.pre}>{proposal.changeSummary}</p>
          </div>
        </div>
      ) : null}
      <div className={s.items}>
        {proposal.items.map((item, index) => (
          <article className={s.item} key={item.id}>
            <div className={s.row}>
              <div>
                <h5>{item.creatorName || `크리에이터 ${index + 1}`}</h5>
                <span className={s.muted}>
                  {item.platform}
                  {item.channelLabel ? ` · ${item.channelLabel}` : ""}
                </span>
                {item.followers !== null || item.averageViews !== null ? (
                  <p className={s.muted}>
                    {item.followers !== null
                      ? `팔로워 ${new Intl.NumberFormat("ko-KR").format(item.followers)}명`
                      : ""}
                    {item.followers !== null && item.averageViews !== null
                      ? " · "
                      : ""}
                    {item.averageViews !== null
                      ? `평균 조회 ${new Intl.NumberFormat("ko-KR").format(item.averageViews)}회`
                      : ""}
                  </p>
                ) : null}
                {demoChannel(item.channelUrl) ? (
                  <p className={s.muted}>시연용 채널 · 외부 연결 없음</p>
                ) : item.channelUrl && /^https:\/\//.test(item.channelUrl) ? (
                  <p>
                    <a
                      href={item.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      채널 확인
                      <ExternalLink size={13} />
                    </a>
                  </p>
                ) : null}
              </div>
              <strong className={s.price}>
                {formatMoney(item.totalAmount, proposal.currency)}
              </strong>
            </div>
            <dl>
              <div>
                <dt>제작 구성</dt>
                <dd className={s.pre}>
                  {item.deliverables || "미입력"} · {item.quantity}건
                </dd>
              </div>
              <div>
                <dt>게시 일정</dt>
                <dd>{formatDate(item.scheduledAt)}</dd>
              </div>
              <div>
                <dt>사용권</dt>
                <dd className={s.pre}>{item.rights || "미입력"}</dd>
              </div>
            </dl>
            {proposal.status !== "DRAFT" ? (
              <div className={s.decision}>
                <Status value={item.status} />
                {proposal.decisions
                  .filter((decision) => decision.itemIds.includes(item.id))
                  .map((decision) => (
                    <div key={decision.id}>
                      {decision.message ? (
                        <p className={s.pre}>{decision.message}</p>
                      ) : null}
                      <small>{formatDate(decision.createdAt)}</small>
                    </div>
                  ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {proposal.terms ? (
        <div className={s.terms}>
          <strong>제작·승인 조건</strong>
          <p className={s.pre}>{proposal.terms}</p>
        </div>
      ) : null}
      {proposal.publishedAt ? (
        <div className={s.footer}>
          <p>발행 {formatDate(proposal.publishedAt)}</p>
          <p>발행된 내용을 기준으로 브랜드의 결정을 기록합니다.</p>
        </div>
      ) : null}
    </>
  );
}

function PreviewDialog({
  proposal,
  publish,
  busy,
  error,
  onClose,
  onPublish,
}: {
  proposal: Preview | null;
  publish: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onPublish: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (proposal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [proposal]);
  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="proposal-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {proposal ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (publish && !busy) onPublish();
          }}
        >
          <div className={s.dialogHeader}>
            <div>
              <h2 id="proposal-preview-title">
                {publish ? "공식 제안서 발행" : "브랜드 공개 미리보기"}
              </h2>
              <p>
                {publish
                  ? "발행 즉시 이 캠페인의 브랜드가 아래 내용을 확인할 수 있습니다."
                  : "브랜드에 전달할 제안 내용을 확인하세요."}
              </p>
            </div>
            <AdminButton
              type="button"
              className="icon"
              aria-label="미리보기 닫기"
              disabled={busy}
              onClick={onClose}
            >
              <X size={18} />
            </AdminButton>
          </div>
          {publish &&
          proposal.items.some(
            (item) => !item.supplierCost || Number(item.supplierCost) <= 0,
          ) ? (
            <p className={s.notice}>
              공급가가 미확정인 항목이 있습니다. 발행 후 내부 공급가 보완이
              가능하며 캠페인 완료 전에는 반드시 확정해야 합니다.
            </p>
          ) : null}
          <ProposalPreview proposal={proposal} />
          {publish ? (
            <>
              <div className={s.notice}>
                <ShieldCheck size={18} />
                <p>
                  이름·채널·제작 조건·제안 금액이 공개됩니다. 발행 후 내용은
                  고정되며, 수정하려면 새 버전을 발행해야 합니다.
                </p>
              </div>
              <label className={s.check}>
                <input type="checkbox" required disabled={busy} />
                대상 크리에이터와 공개 금액을 확인했으며, 이 버전을 브랜드에
                발행합니다.
              </label>
            </>
          ) : null}
          {error ? (
            <p className={s.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={s.actions}>
            <AdminButton type="button" disabled={busy} onClick={onClose}>
              {publish ? "돌아가기" : "닫기"}
            </AdminButton>
            {publish ? (
              <AdminButton className="primary" disabled={busy}>
                <Send size={16} />
                {busy ? "발행 중…" : "브랜드에 발행"}
              </AdminButton>
            ) : null}
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

function DraftEditor({
  proposal,
  creators,
  busy,
  onSave,
  onPreview,
  onPublish,
  onDirtyChange,
}: {
  proposal: Proposal;
  creators: CreatorOption[];
  busy: boolean;
  onSave: (draft: Draft) => void;
  onPreview: (proposal: Preview) => void;
  onPublish: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftFrom(proposal));
  const original = draftFrom(proposal);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function setInput(next: Draft) {
    setDraft(next);
    onDirtyChange(JSON.stringify(next) !== JSON.stringify(original));
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setInput({ ...draft, [key]: value });
  }
  function updateItem(key: string, input: Partial<ItemDraft>) {
    setInput({
      ...draft,
      items: draft.items.map((item) =>
        item.key === key ? { ...item, ...input } : item,
      ),
    });
  }
  function selectCreator(key: string, id: string) {
    const creator = creators.find((item) => item.id === id);
    if (!creator) {
      updateItem(key, { creatorId: "" });
      return;
    }
    const channel = creator.channels[0];
    updateItem(key, {
      creatorId: id,
      creatorName: creator.displayName,
      platform: channel?.platform ?? "youtube",
      channelLabel: channel?.name ?? creator.displayName,
      channelUrl: channel?.url ?? "",
      followers:
        channel?.followers === null || channel?.followers === undefined
          ? ""
          : String(channel.followers),
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onSave(draft);
  }
  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.row}>
        <div>
          <span className={s.muted}>공식 제안 · v{proposal.version}</span>
          <h4>제안서 작성</h4>
        </div>
        <Status value="DRAFT" />
      </div>
      <div className={s.notice}>
        <LockKeyhole size={18} />
        <p>
          저장한 초안은 운영팀만 확인합니다. 이름과 채널은 공식 제안서를 발행한
          뒤 해당 브랜드에 공개됩니다.
        </p>
      </div>
      <fieldset disabled={busy} className={s.fieldset}>
        <div className={s.grid}>
          <label className={`${s.field} ${s.fieldWide}`}>
            제안서 제목
            <input
              value={draft.title}
              maxLength={160}
              onChange={(event) => update("title", event.target.value)}
              placeholder="브랜드가 확인할 제안서 제목"
            />
          </label>
          <label className={`${s.field} ${s.fieldWide}`}>
            제안 개요
            <textarea
              value={draft.summary}
              maxLength={3000}
              rows={3}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="구성 의도와 브랜드가 검토할 내용을 설명하세요."
            />
          </label>
          <label className={s.field}>
            승인 유효기간 · 한국 시간
            <input
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(event) => update("expiresAt", event.target.value)}
            />
            <small>이 시각 이후에는 브랜드의 새 승인이 제한됩니다.</small>
          </label>
          <div className={s.field}>
            <span>제안 통화</span>
            <input value={proposal.currency} disabled />
            <small>캠페인에 설정된 통화를 사용합니다.</small>
          </div>
          <label className={`${s.field} ${s.fieldWide}`}>
            이번 버전의 변경 내용
            <textarea
              value={draft.changeSummary}
              maxLength={2000}
              rows={2}
              onChange={(event) => update("changeSummary", event.target.value)}
              placeholder="이전 제안에서 변경한 구성·금액·일정을 적어 주세요."
            />
          </label>
        </div>
        <div className={s.items}>
          <div className={s.row}>
            <h4>제안 크리에이터 · {draft.items.length}명</h4>
            <AdminButton
              type="button"
              onClick={() => update("items", [...draft.items, blankItem()])}
              disabled={draft.items.length >= 50}
            >
              <Plus size={16} />
              항목 추가
            </AdminButton>
          </div>
          {draft.items.length === 0 ? (
            <p className={s.muted}>
              캠페인 후보에서 선택하거나 공개할 인물과 채널을 직접 입력하세요.
            </p>
          ) : null}
          {draft.items.map((item, index) => (
            <article className={s.itemEditor} key={item.key}>
              <div className={s.itemHeading}>
                <div>
                  <h5>크리에이터 {index + 1}</h5>
                  <p>
                    이 항목의 이름·채널·제작 조건·제안가는 발행 후 브랜드에
                    공개됩니다.
                  </p>
                </div>
                <AdminButton
                  type="button"
                  className="icon"
                  aria-label={`크리에이터 ${index + 1} 항목 삭제`}
                  onClick={() =>
                    update(
                      "items",
                      draft.items.filter((entry) => entry.key !== item.key),
                    )
                  }
                >
                  <Trash2 size={16} />
                </AdminButton>
              </div>
              <div className={s.grid}>
                <label className={`${s.field} ${s.fieldWide}`}>
                  캠페인 후보에서 가져오기
                  <select
                    value={item.creatorId}
                    onChange={(event) =>
                      selectCreator(item.key, event.target.value)
                    }
                  >
                    <option value="">직접 입력</option>
                    {item.creatorId &&
                    !creators.some(
                      (creator) => creator.id === item.creatorId,
                    ) ? (
                      <option value={item.creatorId}>
                        {item.creatorName} · 현재 후보에서 제외됨
                      </option>
                    ) : null}
                    {creators.map((creator) => (
                      <option key={creator.id} value={creator.id}>
                        {creator.displayName} · {creator.agencyName}
                      </option>
                    ))}
                  </select>
                  <small>
                    {creators.length
                      ? "이 캠페인에서 검토 후보 또는 선정으로 지정된 인물만 표시됩니다."
                      : "연결된 캠페인 후보가 없습니다. 운영팀이 확인한 공개 정보를 직접 입력할 수 있습니다."}
                  </small>
                </label>
                <label className={s.field}>
                  크리에이터 이름
                  <input
                    value={item.creatorName}
                    maxLength={100}
                    onChange={(event) =>
                      updateItem(item.key, { creatorName: event.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  플랫폼
                  <select
                    value={item.platform}
                    onChange={(event) =>
                      updateItem(item.key, { platform: event.target.value })
                    }
                  >
                    {[
                      "youtube",
                      "instagram",
                      "tiktok",
                      "chzzk",
                      "soop",
                      "twitch",
                      "x",
                      "facebook",
                    ].map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  채널명
                  <input
                    value={item.channelLabel}
                    maxLength={120}
                    onChange={(event) =>
                      updateItem(item.key, { channelLabel: event.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  공개 채널 URL
                  <input
                    type="url"
                    value={item.channelUrl}
                    maxLength={2048}
                    onChange={(event) =>
                      updateItem(item.key, { channelUrl: event.target.value })
                    }
                    placeholder="https://"
                  />
                </label>
                <label className={s.field}>
                  구독자·팔로워 수 · 선택
                  <input
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    value={item.followers}
                    onChange={(event) =>
                      updateItem(item.key, { followers: event.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  평균 조회 수 · 선택
                  <input
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    value={item.averageViews}
                    onChange={(event) =>
                      updateItem(item.key, { averageViews: event.target.value })
                    }
                  />
                  <small>
                    확인된 참고 수치만 입력하세요. 성과를 보장하는 값이
                    아닙니다.
                  </small>
                </label>
                <label className={`${s.field} ${s.fieldWide}`}>
                  제작물 내용
                  <textarea
                    value={item.deliverables}
                    rows={2}
                    maxLength={1000}
                    onChange={(event) =>
                      updateItem(item.key, { deliverables: event.target.value })
                    }
                    placeholder="예: 게임 체험 영상 1편, 8~12분 분량"
                  />
                </label>
                <label className={s.field}>
                  제작물 수량
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.key, { quantity: event.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  1건당 브랜드 제안가 · {proposal.currency}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitAmount}
                    onChange={(event) =>
                      updateItem(item.key, { unitAmount: event.target.value })
                    }
                  />
                  <small>
                    항목 합계:{" "}
                    {formatMoney(
                      (Number(item.unitAmount) || 0) *
                        (Number(item.quantity) || 0),
                      proposal.currency,
                    )}
                  </small>
                </label>
                <label className={s.field}>
                  예정 게시 시각 · 한국 시간
                  <input
                    type="datetime-local"
                    value={item.scheduledAt}
                    onChange={(event) =>
                      updateItem(item.key, { scheduledAt: event.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  사용권·활용 범위
                  <input
                    value={item.rights}
                    maxLength={1000}
                    onChange={(event) =>
                      updateItem(item.key, { rights: event.target.value })
                    }
                    placeholder="예: 브랜드 채널 재게시 3개월"
                  />
                </label>
              </div>
              <details className={s.internal}>
                <summary>
                  <LockKeyhole size={14} />
                  운영팀 내부 정보 · 브랜드 비공개
                </summary>
                <div className={s.grid}>
                  <label className={s.field}>
                    항목 총공급가 · {proposal.currency}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-describedby={`supplier-cost-hint-${item.key}`}
                      value={item.supplierCost}
                      onChange={(event) =>
                        updateItem(item.key, {
                          supplierCost: event.target.value,
                        })
                      }
                    />
                    <small id={`supplier-cost-hint-${item.key}`}>
                      수량과 관계없이 해당 항목 전체의 공급가를 입력하세요.
                    </small>
                  </label>
                  <label className={s.field}>
                    내부 메모
                    <textarea
                      value={item.internalNotes}
                      maxLength={2000}
                      rows={2}
                      onChange={(event) =>
                        updateItem(item.key, {
                          internalNotes: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </details>
            </article>
          ))}
        </div>
        <label className={s.field}>
          제작·승인 조건
          <textarea
            value={draft.terms}
            rows={4}
            maxLength={3000}
            onChange={(event) => update("terms", event.target.value)}
            placeholder="검수·수정 횟수, 광고 표기, 사용권, 제안 승인 범위를 구체적으로 적어 주세요."
          />
        </label>
      </fieldset>
      {!dirty && proposal.publishProblems.length > 0 ? (
        <div className={s.notice}>
          <FileText size={18} />
          <div>
            <strong>발행 전에 보완해 주세요</strong>
            <ul>
              {proposal.publishProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <div className={s.footer}>
        <p>
          {dirty
            ? "저장하지 않은 변경 사항이 있습니다. 저장 후 발행할 수 있습니다."
            : `마지막 저장 ${formatDate(proposal.updatedAt)}`}
        </p>
        <div className={s.actions}>
          <AdminButton
            type="button"
            disabled={busy}
            onClick={() => onPreview(publicPreview(draft, proposal))}
          >
            <Eye size={16} />
            공개 미리보기
          </AdminButton>
          <AdminButton disabled={busy}>
            {busy ? "처리 중…" : "초안 저장"}
          </AdminButton>
          <AdminButton
            type="button"
            className="primary"
            disabled={busy || dirty || !proposal.canPublish}
            onClick={onPublish}
          >
            <Send size={16} />
            발행하기
          </AdminButton>
        </div>
      </div>
    </form>
  );
}

export function OfficialProposals({
  campaignId,
  campaignTitle,
  campaignCurrency,
  campaignStatus,
  brandActive,
  onCommitted,
}: {
  campaignId: string;
  campaignTitle: string;
  campaignCurrency: string;
  campaignStatus: string;
  brandActive: boolean;
  onCommitted: () => void;
}) {
  const [data, setData] = useState<ProposalData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{
    proposal: Preview;
    publish: boolean;
  } | null>(null);
  const busyRef = useRef(false);
  const dirtyRef = useRef(false);
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        busyRef.current ||
        (dirtyRef.current &&
          !window.confirm(
            "저장하지 않은 제안서 변경 사항을 버리고 이동할까요?",
          ))
      )
        event.preventDefault();
    };
    window.addEventListener("admin:navigate", guard);
    return () => window.removeEventListener("admin:navigate", guard);
  }, []);

  const retries = useRef(new Map<string, string>());
  const current = data?.campaign.id === campaignId ? data : null;
  const selected =
    current?.proposals.find((item) => item.id === selectedId) ??
    current?.proposals[0] ??
    null;
  const draft = current?.proposals.find((item) => item.status === "DRAFT");
  const inactive =
    !(current?.campaign.brandActive ?? brandActive) ||
    ["CANCELED", "COMPLETED", "SETTLING"].includes(
      current?.campaign.status ?? campaignStatus,
    );
  useEffect(() => {
    const controller = new AbortController();
    request<ProposalData>(
      `/api/admin/proposals?campaignId=${encodeURIComponent(campaignId)}`,
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
              : "제안서를 읽지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [campaignId, reload]);
  function leaveDraft() {
    if (!dirtyRef.current) return true;
    if (
      !window.confirm(
        "저장하지 않은 변경 사항이 있습니다. 변경 내용을 버리고 이동할까요?",
      )
    )
      return false;
    dirtyRef.current = false;
    return true;
  }
  function refresh() {
    if (busy || !leaveDraft()) return;
    setLoading(true);
    setError("");
    setNotice("");
    setReload((value) => value + 1);
  }
  async function mutate(input: MutationInput) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const fingerprint = JSON.stringify(input);
    const clientRequestId =
      retries.current.get(fingerprint) ?? crypto.randomUUID();
    retries.current.set(fingerprint, clientRequestId);
    try {
      const result = await request<{ proposal: Proposal }>(
        "/api/admin/proposals",
        { ...input, clientRequestId },
      );
      retries.current.delete(fingerprint);
      setData((previous) =>
        previous
          ? {
              ...previous,
              proposals: [
                result.proposal,
                ...previous.proposals.filter(
                  (item) => item.id !== result.proposal.id,
                ),
              ].sort((a, b) => b.version - a.version),
            }
          : previous,
      );
      dirtyRef.current = false;
      setSelectedId(result.proposal.id);
      setPreview(null);
      setNotice(
        input.action === "updateCosts"
          ? "내부 공급가를 보완했습니다. 브랜드의 제안 조건과 승인 이력은 유지됩니다."
          : input.action === "publish"
            ? "공식 제안서를 발행했습니다. 브랜드에서 이 버전을 확인하고 승인할 수 있습니다."
            : input.action === "createDraft"
              ? "비공개 초안을 만들었습니다. 내용을 작성한 뒤 발행하세요."
              : "초안을 저장했습니다. 아직 브랜드에는 공개되지 않았습니다.",
      );
      if (input.action === "publish" || input.action === "updateCosts")
        onCommitted();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "제안서를 저장하지 못했습니다.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function create(source?: string) {
    if (draft) {
      setSelectedId(draft.id);
      return;
    }
    void mutate({
      action: "createDraft",
      campaignId,
      ...(source ? { sourceProposalId: source } : {}),
    });
  }
  return (
    <section
      className={s.workspace}
      aria-label="공식 제안서"
      aria-busy={loading || busy}
    >
      <div className={s.heading}>
        <div>
          <h3>공식 제안서</h3>
          <p>
            브랜드에 전달할 크리에이터와 조건을 검토하고, 확정한 버전을
            발행하세요.
          </p>
        </div>
        <div className={s.actions}>
          <AdminButton
            type="button"
            disabled={busy || loading}
            onClick={refresh}
          >
            <RefreshCw size={16} />
            새로고침
          </AdminButton>
          {current ? (
            <AdminButton
              type="button"
              className="primary"
              disabled={busy || loading || inactive}
              onClick={() => create(selected?.id)}
            >
              <Plus size={16} />
              {draft
                ? "작성 중인 초안"
                : current.proposals.length
                  ? "새 버전 작성"
                  : "제안서 작성"}
            </AdminButton>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className={s.error} role="alert">
          <p>{error}</p>
          <p>
            입력 내용은 화면에 유지됩니다. 다른 담당자가 수정했다면 최신 내용을
            새로 불러온 뒤 다시 진행하세요.
          </p>
          {!busy ? (
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
          제안서와 캠페인 후보를 불러오는 중입니다…
        </p>
      ) : null}
      {inactive ? (
        <p className={s.notice}>
          종료된 캠페인이거나 브랜드가 이용 중지 상태여서 새 제안서를 발행할 수
          없습니다.
        </p>
      ) : null}
      {current && !current.proposals.length ? (
        <div className={s.empty}>
          <FileText size={30} />
          <h4>아직 공식 제안서가 없습니다</h4>
          <p>
            {campaignTitle}의 크리에이터 구성과 {campaignCurrency} 제안 금액을
            작성하세요. 초안은 운영팀만 볼 수 있습니다.
          </p>
          <AdminButton
            type="button"
            disabled={busy || inactive}
            onClick={() => create()}
          >
            <Plus size={16} />첫 제안서 작성
          </AdminButton>
        </div>
      ) : null}
      {current && selected ? (
        <div className={s.layout}>
          <nav className={s.versions} aria-label="제안서 버전">
            {current.proposals.map((proposal) => (
              <button
                key={proposal.id}
                type="button"
                disabled={busy}
                aria-current={selected.id === proposal.id ? "true" : undefined}
                onClick={() => {
                  if (selected.id !== proposal.id && !leaveDraft()) return;
                  setSelectedId(proposal.id);
                  setError("");
                  setNotice("");
                }}
              >
                <span className={s.versionTop}>
                  <strong>v{proposal.version}</strong>
                  <Status
                    value={proposal.status}
                    expiresAt={proposal.expiresAt}
                  />
                </span>
                <span className={s.versionTitle}>{proposal.title}</span>
                <small>
                  {proposal.publishedAt
                    ? `발행 ${formatDate(proposal.publishedAt)}`
                    : `저장 ${formatDate(proposal.updatedAt)}`}
                </small>
              </button>
            ))}
          </nav>
          <div className={`${s.body} ${s.card}`}>
            {selected.status === "DRAFT" && selected.canEdit ? (
              <DraftEditor
                key={`${selected.id}:${selected.revision}:${reload}`}
                proposal={selected}
                creators={current.creators}
                busy={busy || loading}
                onDirtyChange={(value) => {
                  dirtyRef.current = value;
                }}
                onSave={(input) =>
                  void mutate({
                    action: "saveDraft",
                    campaignId,
                    proposalId: selected.id,
                    expectedRevision: selected.revision,
                    data: toInput(input),
                  })
                }
                onPreview={(proposal) =>
                  setPreview({ proposal, publish: false })
                }
                onPublish={() =>
                  setPreview({ proposal: selected, publish: true })
                }
              />
            ) : (
              <>
                <ProposalPreview proposal={selected} />
                {selected.status !== "DRAFT" ? (
                  <ProposalCostEditor
                    key={`${selected.id}:${selected.revision}`}
                    proposal={selected}
                    busy={busy}
                    onSave={(items, reason) =>
                      mutate({
                        action: "updateCosts",
                        campaignId,
                        proposalId: selected.id,
                        expectedRevision: selected.revision,
                        items,
                        reason,
                      })
                    }
                  />
                ) : null}
                <div className={s.notice}>
                  <CheckCheck size={18} />
                  <p>
                    {selected.status === "DRAFT"
                      ? "이 캠페인의 초안을 현재 수정할 수 없습니다."
                      : "발행된 제안은 기록을 보존합니다. 내용 변경이 필요하면 새 버전을 작성해 주세요."}
                  </p>
                </div>
                {selected.status !== "DRAFT" ? (
                  <div className={s.actions}>
                    <AdminButton
                      type="button"
                      disabled={busy || inactive}
                      onClick={() => create(selected.id)}
                    >
                      <Plus size={16} />
                      {draft
                        ? "작성 중인 초안 열기"
                        : "이 제안으로 새 버전 작성"}
                    </AdminButton>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
      <PreviewDialog
        proposal={preview?.proposal ?? null}
        publish={preview?.publish ?? false}
        busy={busy}
        error={preview ? error : ""}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        onPublish={() => {
          if (preview?.publish && selected)
            void mutate({
              action: "publish",
              campaignId,
              proposalId: selected.id,
              expectedRevision: selected.revision,
            });
        }}
      />
    </section>
  );
}
