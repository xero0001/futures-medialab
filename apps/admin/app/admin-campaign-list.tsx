"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";
import { useEffect, useState, type FormEvent } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import type { CampaignListResponse } from "../lib/campaign-list-types";
import type { AdminLocation } from "../lib/admin-navigation";
const statuses: Record<string, string> = {
  DRAFT: "초안·보완",
  REVIEW: "접수 검토",
  RECRUITING: "소싱·모집",
  IN_PROGRESS: "진행 중",
  VERIFYING: "콘텐츠 검수",
  SETTLING: "정산",
  COMPLETED: "완료",
  CANCELED: "취소",
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미설정";
export function AdminCampaignList({
  scope,
  status,
  refreshToken,
  onFilter,
  onSelect,
}: {
  scope: AdminLocation["scope"];
  status: string;
  refreshToken: number;
  onFilter: (scope: AdminLocation["scope"], status: string) => void;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CampaignListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const key = `${scope}:${status}:${q}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({
        q,
        type: scope,
        status,
        page: String(page),
      });
      fetch(`/api/admin/campaigns?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) {
            if (r.status === 401) window.location.assign("/login");
            throw new Error(body.message || "캠페인 목록을 읽지 못했습니다.");
          }
          return body as CampaignListResponse;
        })
        .then((body) => {
          if (!controller.signal.aborted) setData(body);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scope, status, q, page, refreshToken]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setQ(search.trim());
    setPage(1);
  }
  function filter(nextScope: AdminLocation["scope"], nextStatus: string) {
    setPage(1);
    onFilter(nextScope, nextStatus);
  }
  return (
    <section className="admin-panel admin-campaign-list" aria-busy={loading}>
      <div className="admin-scope-tabs" aria-label="캠페인 진행 방식">
        {(
          [
            ["all", "전체 캠페인"],
            ["MANAGED", "맞춤 의뢰"],
            ["OPEN_BIDDING", "오픈 모집"],
          ] as const
        ).map(([value, label]) => (
          <AdminButton
            key={value}
            type="button"
            aria-pressed={scope === value}
            className={scope === value ? "primary" : ""}
            onClick={() => filter(value, status)}
          >
            {label}
          </AdminButton>
        ))}
      </div>
      <form className="admin-toolbar" onSubmit={submit}>
        <label className="admin-search">
          <Search size={18} />
          <input
            maxLength={160}
            aria-label="전체 캠페인 검색"
            placeholder="캠페인 또는 브랜드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <AdminButton type="submit">검색</AdminButton>
        <label className="admin-filter">
          상태
          <FormSelect
            aria-label="캠페인 상태"
            value={status}
            onChange={(e) => filter(scope, e.target.value)}
          >
            <option value="all">전체 상태</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FormSelect>
        </label>
      </form>
      <div className="admin-list-caption">
        <span>
          {loading
            ? "목록을 불러오는 중…"
            : `검색 결과 ${(data?.total ?? 0).toLocaleString()}건`}
        </span>
        <span>최근 변경순 · 전체 캠페인에서 검색</span>
      </div>
      {error ? (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>캠페인 / 브랜드</th>
              <th>상태</th>
              <th>담당자</th>
              <th>현재 기한</th>
              <th>신청</th>
              <th>운영</th>
            </tr>
          </thead>
          <tbody>
            {!data?.campaigns.length ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  {loading
                    ? "캠페인을 불러오고 있습니다."
                    : "조건에 맞는 캠페인이 없습니다."}
                </td>
              </tr>
            ) : (
              data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.title}</strong>
                    <span className="admin-sub">
                      {c.brandName} ·{" "}
                      {c.type === "MANAGED" ? "맞춤 의뢰" : "오픈 모집"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge state-${c.status.toLowerCase()}`}
                    >
                      {c.status === "RECRUITING"
                        ? c.type === "MANAGED"
                          ? "소싱 중"
                          : "모집 중"
                        : (statuses[c.status] ?? c.status)}
                    </span>
                  </td>
                  <td>{c.assigneeName ?? "미배정"}</td>
                  <td>
                    {date(
                      c.type === "OPEN_BIDDING" && c.status === "RECRUITING"
                        ? c.applicationDeadline
                        : c.dueAt,
                    )}
                    <span className="admin-sub">
                      {c.type === "OPEN_BIDDING" && c.status === "RECRUITING"
                        ? "모집 마감"
                        : "연결 요청 처리 기한"}
                    </span>
                  </td>
                  <td>{c.applicationCount}</td>
                  <td>
                    <AdminButton
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-label={`${c.title} 운영 상세`}
                    >
                      운영 상세
                      <ArrowRight size={16} />
                    </AdminButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination" key={key}>
        <span>
          {data?.page ?? page} /{" "}
          {Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)))}{" "}
          페이지
        </span>
        <div>
          <AdminButton
            type="button"
            disabled={loading || (data?.page ?? page) <= 1}
            onClick={() => setPage((data?.page ?? page) - 1)}
          >
            <ChevronLeft size={16} />
            이전
          </AdminButton>
          <AdminButton
            type="button"
            disabled={
              loading || !data || data.page * data.pageSize >= data.total
            }
            onClick={() => setPage((data?.page ?? page) + 1)}
          >
            다음
            <ChevronRight size={16} />
          </AdminButton>
        </div>
      </div>
    </section>
  );
}
