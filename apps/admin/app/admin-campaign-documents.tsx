"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  FileText,
  LockKeyhole,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import type {
  AdminCampaignDocument,
  AdminCampaignDocumentsResponse,
  AdminCampaignSection,
  AdminDocumentKind,
} from "../lib/operations-types";
import s from "./admin-campaign-documents.module.css";
const names: Record<AdminDocumentKind, string> = {
  proposal: "공식 제안",
  report: "성과 보고",
  invoice: "브랜드 청구",
  payout: "파트너 지급",
  attachment: "공유 첨부",
};
const scopeNames = {
  internal: "운영팀 내부",
  brand: "브랜드 공개",
  partner: "파트너 공개",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
function DocumentDetail({
  document,
  onClose,
  onSource,
}: {
  document: AdminCampaignDocument | null;
  onClose: () => void;
  onSource: (document: AdminCampaignDocument) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!document) return;
    const el = ref.current;
    const before = window.document.body.style.overflow;
    el?.showModal();
    window.document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      window.document.body.style.overflow = before;
    };
  }, [document]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="admin-document-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {document ? (
        <>
          <div className={s.dialogHead}>
            <div>
              <span className={s.eyebrow}>
                {names[document.kind]}
                {document.version !== null ? ` · v${document.version}` : ""}
              </span>
              <h2 id="admin-document-title">{document.title}</h2>
            </div>
            <AdminButton
              type="button"
              aria-label="문서 상세 닫기"
              onClick={onClose}
            >
              <X size={20} />
            </AdminButton>
          </div>
          <div className={s.dialogBody}>
            <div
              className={`${s.scopeNotice} ${document.scope === "internal" ? s.private : ""}`}
            >
              <LockKeyhole size={18} />
              <div>
                <strong>{scopeNames[document.scope]}</strong>
                <p>
                  {document.scope === "internal"
                    ? "이 자료는 브랜드 자료실에 공개되지 않습니다."
                    : `${document.recipient}에 공유된 자료입니다.`}
                </p>
              </div>
            </div>
            <dl className={s.metadata}>
              <div>
                <dt>상태</dt>
                <dd>
                  {document.status}
                  {!document.isLatest ? " · 이전 버전" : ""}
                </dd>
              </div>
              <div>
                <dt>{document.sharedAt ? "공개 시각" : "최근 저장"}</dt>
                <dd>{date(document.sharedAt ?? document.updatedAt)}</dd>
              </div>
            </dl>
            <dl className={s.details}>
              {document.details.map((entry, i) => (
                <div key={`${i}:${entry.label}`}>
                  <dt>{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
            {!document.file ? (
              <p className={s.help}>
                별도 원본 파일이 등록되지 않은 자료입니다. 발행·검토 화면에서
                내용을 확인할 수 있습니다.
              </p>
            ) : null}
          </div>
          <div className={s.dialogFoot}>
            {document.file ? (
              <a
                href={document.file.url}
                target="_blank"
                rel="noopener noreferrer"
                className={s.file}
              >
                <Download size={16} />
                {document.kind === "attachment" ? "첨부 다운로드" : "원본 열기"}
              </a>
            ) : null}
            <AdminButton
              type="button"
              onClick={() => {
                onClose();
                onSource(document);
              }}
            >
              {document.requestId ? "공유 요청 보기" : "발행·검토 화면"}
              <ArrowRight size={16} />
            </AdminButton>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
export function AdminCampaignDocuments({
  campaignId,
  onNavigate,
  onRequest,
}: {
  campaignId: string;
  onNavigate: (section: AdminCampaignSection) => void;
  onRequest: (id: string) => void;
}) {
  const [data, setData] = useState<AdminCampaignDocumentsResponse | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [scope, setScope] = useState("all"),
    [versions, setVersions] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<AdminCampaignDocument | null>(null);
  const previousId = useRef(campaignId);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (previousId.current !== campaignId) {
        previousId.current = campaignId;
        setQuery("");
        setKind("all");
        setScope("all");
        setVersions("all");
        setPage(1);
        setSelected(null);
      }
      setLoading(true);
      setError("");
      fetch(
        `/api/admin/campaign-documents?campaignId=${encodeURIComponent(campaignId)}`,
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            if (response.status === 401) window.location.assign("/login");
            throw new Error(body.message || "문서를 불러오지 못했습니다.");
          }
          if (!controller.signal.aborted) setData(body);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "문서를 불러오지 못했습니다.",
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
  }, [campaignId, revision]);
  const current = data?.campaignId === campaignId ? data : null;
  const documents =
    current?.documents.filter(
      (d) =>
        (kind === "all" || d.kind === kind) &&
        (scope === "all" || d.scope === scope) &&
        (versions === "all" ||
          (versions === "latest" ? d.isLatest : !d.isLatest)) &&
        `${d.title} ${d.recipient}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    ) ?? [];
  const pageSize = 12,
    pageCount = Math.max(1, Math.ceil(documents.length / pageSize)),
    currentPage = Math.min(page, pageCount),
    visible = documents.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
  const go = (d: AdminCampaignDocument) =>
    d.requestId ? onRequest(d.requestId) : onNavigate(d.section);
  return (
    <section
      className={s.panel}
      aria-labelledby="campaign-documents-title"
      aria-busy={loading}
    >
      <div className={s.heading}>
        <div>
          <h2 id="campaign-documents-title">문서·공유 관리</h2>
          <p>
            공개된 자료와 내부 초안을 함께 확인하고 발행·공유 업무로 이동하세요.
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
      <div className={s.notice}>
        브랜드 자료실에는 브랜드 공개 자료만 표시됩니다. 파트너 지급 문서와 내부
        첨부는 별도로 구분합니다.
      </div>
      <div className={s.filters}>
        <label className={s.search}>
          <Search size={18} />
          <span className={s.srOnly}>문서·수신 조직 검색</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="문서·수신 조직 검색"
            maxLength={160}
          />
        </label>
        <label>
          <span>문서 종류</span>
          <select
            aria-label="문서 종류"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">전체 종류</option>
            {Object.entries(names).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>공개 범위</span>
          <select
            aria-label="공개 범위"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">전체 범위</option>
            {Object.entries(scopeNames).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>버전</span>
          <select
            aria-label="버전"
            value={versions}
            onChange={(e) => {
              setVersions(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">모든 버전</option>
            <option value="latest">현재 문서</option>
            <option value="previous">이전 버전</option>
          </select>
        </label>
        <button
          type="button"
          className={s.textButton}
          onClick={() => {
            setQuery("");
            setKind("all");
            setScope("all");
            setVersions("all");
            setPage(1);
          }}
        >
          초기화
        </button>
      </div>
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
      {current?.hasMore ? (
        <p className={s.notice}>
          종류별 최근 {current.perKindLimit}건을 표시합니다. 더 오래된
          제안·성과·공유 기록은 각 발행·검토 화면과 요청함에서 확인하세요.
        </p>
      ) : null}
      <div className={s.count}>
        {documents.length.toLocaleString()}개 문서{" "}
        <span>최근 공개·저장 순 · 한국 시간</span>
      </div>
      {loading && !current ? (
        <p className={s.empty} role="status">
          문서를 불러오는 중입니다…
        </p>
      ) : current && !documents.length ? (
        <div className={s.empty}>
          <FileText size={28} />
          <strong>해당 조건의 문서가 없습니다</strong>
          <p>
            필터를 변경하거나 제안·성과·청구 발행 및 요청함의 자료 공유를 확인해
            주세요.
          </p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>문서</th>
                <th>공개 범위·수신 조직</th>
                <th>상태</th>
                <th>공개·저장 시각</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className={s.kind}>
                      {names[d.kind]}
                      {d.version !== null ? ` · v${d.version}` : ""}
                      {!d.isLatest ? " · 이전 버전" : ""}
                    </span>
                    <button
                      type="button"
                      className={s.documentTitle}
                      onClick={() => setSelected(d)}
                    >
                      {d.title}
                    </button>
                  </td>
                  <td>
                    <span
                      className={`${s.badge} ${d.scope === "internal" ? s.internal : d.scope === "brand" ? s.brand : s.partner}`}
                    >
                      {scopeNames[d.scope]}
                    </span>
                    <small className={s.recipient}>{d.recipient}</small>
                  </td>
                  <td>{d.status}</td>
                  <td>
                    <small>{d.sharedAt ? "공개" : "저장"}</small>
                    <span className={s.time}>
                      {date(d.sharedAt ?? d.updatedAt)}
                    </span>
                  </td>
                  <td>
                    <AdminButton type="button" onClick={() => setSelected(d)}>
                      상세 보기
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={s.pagination}>
        <span>
          {currentPage} / {pageCount} 페이지
        </span>
        <div>
          <AdminButton
            type="button"
            disabled={currentPage <= 1 || loading}
            onClick={() => setPage(currentPage - 1)}
          >
            이전
          </AdminButton>
          <AdminButton
            type="button"
            disabled={currentPage >= pageCount || loading}
            onClick={() => setPage(currentPage + 1)}
          >
            다음
          </AdminButton>
        </div>
      </div>
      <DocumentDetail
        document={selected}
        onClose={() => setSelected(null)}
        onSource={go}
      />
    </section>
  );
}
