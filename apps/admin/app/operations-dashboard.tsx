"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import {
  operationKinds,
  operationKindLabels,
  type AdminCampaignSection,
  type OperationsResponse,
} from "../lib/operations-types";
import type { OperationsFilter } from "../lib/operations-query";
import s from "./operations-dashboard.module.css";
const initial: OperationsFilter = {
  kind: "all",
  assignee: "all",
  deadline: "all",
  q: "",
  page: 1,
};
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
export function OperationsDashboard({
  userId,
  onCampaign,
  onRequest,
  refreshToken = 0,
  campaignId,
  compact = false,
}: {
  userId: string;
  onCampaign: (id: string, section: AdminCampaignSection) => void;
  onRequest: (id: string) => void;
  refreshToken?: number;
  campaignId?: string;
  compact?: boolean;
}) {
  const [filters, setFilters] = useState(initial),
    [search, setSearch] = useState(""),
    [data, setData] = useState<OperationsResponse | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const query = new URLSearchParams({
    ...filters,
    ...(campaignId ? { campaignId } : {}),
    page: String(filters.page),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/admin/operations?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            if (response.status === 401) window.location.assign("/login");
            throw new Error(body.message || "운영 업무를 불러오지 못했습니다.");
          }
          if (!controller.signal.aborted) setData(body);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "업무를 불러오지 못했습니다.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision, refreshToken]);
  const update = (values: Partial<OperationsFilter>) =>
    setFilters((current) => ({ ...current, ...values, page: 1 }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: search.trim() });
  };
  const now = data ? Date.parse(data.asOf) : 0;
  return (
    <div className={s.workspace}>
      {!compact ? (
        <section className={s.stats} aria-label="전체 운영 업무 현황">
          {[
            {
              key: "total",
              label: "전체 운영 업무",
              icon: ClipboardCheck,
              active: filters.assignee === "all" && filters.deadline === "all",
              action: () => update({ assignee: "all", deadline: "all" }),
            },
            {
              key: "mine",
              label: "내 담당 업무",
              icon: UserRound,
              active: filters.assignee === "mine",
              action: () => update({ assignee: "mine", deadline: "all" }),
            },
            {
              key: "unassigned",
              label: "담당자 미배정",
              icon: Users,
              active: filters.assignee === "unassigned",
              action: () => update({ assignee: "unassigned", deadline: "all" }),
            },
            {
              key: "overdue",
              label: "기한 초과",
              icon: CalendarClock,
              active: filters.deadline === "overdue",
              action: () => update({ assignee: "all", deadline: "overdue" }),
            },
            {
              key: "soon",
              label: "48시간 이내",
              icon: CalendarClock,
              active: filters.deadline === "soon",
              action: () => update({ assignee: "all", deadline: "soon" }),
            },
          ].map(({ key, label, icon: Icon, active, action }) => (
            <button
              key={key}
              type="button"
              className={active ? s.activeStat : undefined}
              onClick={action}
              aria-pressed={active}
            >
              <span>
                <Icon size={20} />
                {label}
              </span>
              <strong>
                {data
                  ? data.counts[
                      key as keyof Omit<OperationsResponse["counts"], "byKind">
                    ].toLocaleString()
                  : "—"}
                <small>건</small>
              </strong>
            </button>
          ))}
        </section>
      ) : null}
      <section
        className={s.panel}
        aria-labelledby="operations-heading"
        aria-busy={loading}
      >
        <div className={s.heading}>
          <div>
            <h2 id="operations-heading">지금 확인할 운영 업무</h2>
            <p>
              기한이 빠른 업무부터 확인하고 해당 캠페인에서 이어서 처리하세요.
            </p>
          </div>
          <AdminButton
            type="button"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw size={16} />
            새로고침
          </AdminButton>
        </div>
        {!compact ? (
          <>
            <div className={s.kinds} aria-label="업무 종류">
              <button
                type="button"
                aria-pressed={filters.kind === "all"}
                onClick={() => update({ kind: "all" })}
              >
                전체 <span>{data?.counts.total ?? "—"}</span>
              </button>
              {operationKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={filters.kind === kind}
                  onClick={() => update({ kind })}
                >
                  {operationKindLabels[kind]}{" "}
                  <span>{data?.counts.byKind[kind] ?? "—"}</span>
                </button>
              ))}
            </div>
            <form className={s.filters} onSubmit={submit}>
              <label className={s.search}>
                <span className={s.srOnly}>캠페인·브랜드·담당자 검색</span>
                <Search size={18} />
                <input
                  value={search}
                  maxLength={160}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="캠페인·브랜드·담당자 검색"
                />
              </label>
              <label>
                <span className={s.srOnly}>담당자 필터</span>
                <FormSelect
                  aria-label="담당자 필터"
                  value={filters.assignee}
                  onChange={(e) =>
                    update({
                      assignee: e.target.value as OperationsFilter["assignee"],
                    })
                  }
                >
                  <option value="all">전체 담당자</option>
                  <option value="mine">내 담당</option>
                  <option value="unassigned">미배정</option>
                </FormSelect>
              </label>
              <label>
                <span className={s.srOnly}>기한 필터</span>
                <FormSelect
                  aria-label="기한 필터"
                  value={filters.deadline}
                  onChange={(e) =>
                    update({
                      deadline: e.target.value as OperationsFilter["deadline"],
                    })
                  }
                >
                  <option value="all">전체 기한</option>
                  <option value="overdue">기한 초과</option>
                  <option value="soon">48시간 이내</option>
                </FormSelect>
              </label>
              <AdminButton type="submit" disabled={loading}>
                검색
              </AdminButton>
              <button
                type="button"
                className={s.textButton}
                onClick={() => {
                  setFilters(initial);
                  setSearch("");
                }}
              >
                초기화
              </button>
            </form>
          </>
        ) : null}
        <p className={s.count}>
          검색 결과 {data?.total.toLocaleString() ?? "—"}건{" "}
          <span>
            {compact
              ? "기한은 한국 시간"
              : "상단 숫자는 전체 운영 업무 기준입니다. · 기한은 한국 시간"}
          </span>
        </p>
        {error ? (
          <p role="alert" className={s.error}>
            {error}
          </p>
        ) : null}
        {!data && loading ? (
          <p className={s.empty} role="status">
            운영 업무를 불러오는 중입니다…
          </p>
        ) : null}
        {data && !data.items.length ? (
          <div className={s.empty}>
            <ClipboardCheck size={28} />
            <strong>해당 조건의 업무가 없습니다</strong>
            <p>필터를 바꾸거나 새로운 접수·제출 내용을 확인해 주세요.</p>
          </div>
        ) : null}
        <ul className={s.tasks}>
          {data?.items.map((task) => {
            const overdue = Boolean(task.dueAt && Date.parse(task.dueAt) < now);
            return (
              <li key={task.id}>
                <div className={s.taskMain}>
                  <span className={s.kind}>
                    {operationKindLabels[task.kind]}
                  </span>
                  <h3>{task.title}</h3>
                  <p>
                    {task.campaignTitle
                      ? `${task.brandName} · ${task.campaignTitle}`
                      : task.brandName}
                  </p>
                  <p className={s.description}>{task.description}</p>
                </div>
                <div className={s.taskMeta}>
                  <span
                    className={task.assigneeId === userId ? s.mine : undefined}
                  >
                    {task.assigneeName ?? "담당자 미배정"}
                    {task.assigneeId === userId ? " · 나" : ""}
                  </span>
                  <small>{task.deadlineLabel}</small>
                  <strong className={overdue ? s.overdue : undefined}>
                    {task.dueAt ? date(task.dueAt) : "미설정"}
                  </strong>
                  {overdue ? (
                    <span className={s.overdue}>기한 초과</span>
                  ) : null}
                </div>
                <AdminButton
                  type="button"
                  onClick={() =>
                    task.requestId
                      ? onRequest(task.requestId)
                      : task.campaignId &&
                        onCampaign(task.campaignId, task.section)
                  }
                >
                  {task.requestId ? "요청 확인" : "캠페인에서 처리"}
                  <ArrowRight size={16} />
                </AdminButton>
              </li>
            );
          })}
        </ul>
        {data ? (
          <div className={s.pagination}>
            <span>
              {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}{" "}
              페이지 · 총 {data.total.toLocaleString()}건
            </span>
            <div>
              <AdminButton
                type="button"
                disabled={loading || data.page <= 1}
                onClick={() =>
                  setFilters((v) => ({ ...v, page: data.page - 1 }))
                }
              >
                이전
              </AdminButton>
              <AdminButton
                type="button"
                disabled={loading || !data.hasMore}
                onClick={() =>
                  setFilters((v) => ({ ...v, page: data.page + 1 }))
                }
              >
                다음
              </AdminButton>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
