"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ExternalLink, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import { canReviewSourcing } from "../lib/sourcing-validation";
import type { AdminSourcingData } from "../lib/sourcing-types";
import s from "./admin-sourcing.module.css";
import { SupplierOfferEditor } from "./supplier-offer-editor";

const labels: Record<string, string> = {
  SUBMITTED: "검토 대기",
  SHORTLISTED: "제안 후보",
  ACCEPTED: "수행 후보 확정",
  REJECTED: "미선정",
  WITHDRAWN: "철회",
};
type Application = AdminSourcingData["applications"][number];
function Candidate({
  item,
  busy,
  onReview,
}: {
  item: Application;
  busy: boolean;
  onReview: (
    status: "SHORTLISTED" | "ACCEPTED" | "REJECTED",
    reason: string,
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"SHORTLISTED" | "ACCEPTED" | "REJECTED">(
    item.status === "SHORTLISTED" ? "ACCEPTED" : "SHORTLISTED",
  );
  const [reason, setReason] = useState("");
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        busy ||
        (editing &&
          reason.trim() &&
          !window.confirm("작성 중인 후보 심사 내용을 버리고 이동할까요?"))
      )
        event.preventDefault();
    };
    window.addEventListener("admin:navigate", guard);
    return () => window.removeEventListener("admin:navigate", guard);
  }, [busy, editing, reason]);

  const available = (["SHORTLISTED", "ACCEPTED", "REJECTED"] as const).filter(
    (value) => canReviewSourcing(item.status, value),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onReview(status, reason)) {
      setEditing(false);
      setReason("");
    }
  }
  return (
    <article className={s.card}>
      <header className={s.row}>
        <div>
          <h4>{item.agencyName}</h4>
          <span className={s.muted}>
            {item.agencyActive ? "승인된 에이전시" : "조직 승인 필요"} ·{" "}
            {item.creators.length}명
          </span>
        </div>
        <span className={s.badge}>{labels[item.status] ?? item.status}</span>
      </header>
      <p className={s.pre}>{item.proposal || "신청 설명이 없습니다."}</p>
      <p>
        <strong>공급 제안 금액</strong>{" "}
        {item.amount
          ? `${item.currency} ${Number(item.amount).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`
          : "미등록"}
      </p>
      <div className={s.creators}>
        {item.creators.map((creator) => (
          <section key={creator.id} className={s.creator}>
            <div className={s.row}>
              <strong>{creator.name}</strong>
              <span className={s.muted}>
                {creator.active
                  ? creator.categories.join(" · ")
                  : "비활성 인물"}
              </span>
            </div>
            {creator.channels.map((channel, index) => (
              <div key={`${channel.platform}:${index}`} className={s.channel}>
                <span>
                  {channel.platform} ·{" "}
                  {channel.followers === null
                    ? "팔로워 미등록"
                    : `팔로워 ${channel.followers.toLocaleString()}명`}
                </span>
                {channel.url ? (
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {channel.label}
                    <ExternalLink size={13} aria-hidden />
                  </a>
                ) : (
                  <span>{channel.label}</span>
                )}
              </div>
            ))}
            {creator.deliverables ? (
              <p className={s.muted}>제안 범위: {creator.deliverables}</p>
            ) : null}
          </section>
        ))}
      </div>
      {item.reviewReason ? (
        <p className={s.note}>최근 검토 사유: {item.reviewReason}</p>
      ) : null}
      {item.lockReason ? (
        <p className={s.note}>{item.lockReason}</p>
      ) : editing ? (
        <form onSubmit={submit} className={s.form}>
          <label>
            검토 결과
            <FormSelect
              value={status}
              disabled={busy}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              {available.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </FormSelect>
          </label>
          <label>
            검토 사유
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              placeholder="브리프 적합성, 가용 일정, 선정 또는 제외 사유를 남겨 주세요."
            />
          </label>
          <label className={s.confirm}>
            <input type="checkbox" required disabled={busy} />
            선택한 신청 항목의 검토 결과를 기록합니다. 브랜드에는 공식 제안을
            발행할 때 인물 정보가 공개됩니다.
          </label>
          <div className={s.actions}>
            <AdminButton
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              취소
            </AdminButton>
            <AdminButton className="primary" disabled={busy}>
              {busy ? "저장 중…" : "검토 결과 저장"}
            </AdminButton>
          </div>
        </form>
      ) : available.length ? (
        <div className={s.actions}>
          <AdminButton
            disabled={busy}
            onClick={() => {
              setStatus(available[0]!);
              setEditing(true);
            }}
          >
            <ShieldCheck size={16} aria-hidden />
            후보 심사
          </AdminButton>
        </div>
      ) : null}
    </article>
  );
}
export function AdminSourcing({
  campaignId,
  onChanged,
  onProposal,
}: {
  campaignId: string;
  onChanged?: () => void;
  onProposal?: () => void;
}) {
  const [data, setData] = useState<AdminSourcingData | null>(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/admin/sourcing?campaignId=${encodeURIComponent(campaignId)}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok)
            throw new Error(body.message || "후보 정보를 읽지 못했습니다.");
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
                : "후보 정보를 읽지 못했습니다.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [campaignId, revision]);
  async function review(
    item: Application,
    status: "SHORTLISTED" | "ACCEPTED" | "REJECTED",
    reason: string,
  ) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          applicationId: item.id,
          ...(item.rowId ? { rowId: item.rowId } : {}),
          expectedUpdatedAt: item.updatedAt,
          status,
          reason,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "심사 결과를 저장하지 못했습니다.");
      setNotice(
        status === "REJECTED"
          ? "미선정 사유를 기록했습니다."
          : "검토 결과를 저장했습니다. 공식 제안에서 후보 인물을 선택할 수 있습니다.",
      );
      setRevision((value) => value + 1);
      onChanged?.();
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "저장하지 못했습니다.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const current = data?.campaignId === campaignId ? data : null;
  const rows =
    current?.applications.filter(
      (item) => filter === "all" || item.status === filter,
    ) ?? [];
  return (
    <section
      className={s.workspace}
      aria-label="내부 소싱·후보 심사"
      aria-busy={loading}
    >
      <header className={s.row}>
        <div>
          <h3>
            <Users size={20} aria-hidden />
            내부 소싱·후보 심사
          </h3>
          <p className={s.muted}>
            신청 인물과 조건을 검토한 뒤, 공식 제안에 포함할 후보를 정하세요.
          </p>
        </div>
        <div className={s.actions}>
          {onProposal ? (
            <AdminButton onClick={onProposal}>공식 제안으로 이동</AdminButton>
          ) : null}
          <AdminButton
            disabled={busy || loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={16} aria-hidden />
            새로고침
          </AdminButton>
        </div>
      </header>
      <SupplierOfferEditor key={campaignId} campaignId={campaignId} />
      <p className={s.note}>
        크리에이터별 신청은 행 단위로 심사합니다. 공식 제안에서는 필요한 인물과
        채널만 선택합니다. 후보 지정·확정만으로 계약이나 브랜드 공개가
        이루어지지 않습니다.
      </p>
      {error ? (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="admin-alert success">
          {notice}
        </p>
      ) : null}
      <label className={s.filter}>
        심사 상태
        <FormSelect
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">전체 신청</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FormSelect>
      </label>
      {loading && !current ? (
        <p role="status">후보 정보를 불러오는 중입니다…</p>
      ) : !rows.length ? (
        <p className={s.empty}>조건에 맞는 신청이 없습니다.</p>
      ) : (
        <div className={s.list}>
          {rows.map((item) => (
            <Candidate
              key={`${item.id}:${item.updatedAt}`}
              item={item}
              busy={busy}
              onReview={(status, reason) => review(item, status, reason)}
            />
          ))}
        </div>
      )}
      {current && current.total > current.applications.length ? (
        <p className={s.note}>
          최근 {current.applications.length}건 / 전체 {current.total}건을
          표시합니다.
        </p>
      ) : null}
    </section>
  );
}
