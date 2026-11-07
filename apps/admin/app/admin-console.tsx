"use client";

import {
  AdminShell,
  adminNavigation as tabs,
  type AdminTab as Tab,
} from "./_components/admin-shell";
import { AdminButton } from "./_components/admin-button";
import { RequestConsole } from "./request-console";
import { OperationsDashboard } from "./operations-dashboard";
import { AdminCampaignList } from "./admin-campaign-list";
import { AdminAccountWorkspace } from "./admin-account-workspace";
import { AdminCampaignWorkspace } from "./admin-campaign-workspace";
import { AdminDelegatedIntake } from "./admin-delegated-intake";
import { AdminGameCatalog } from "./admin-game-catalog";
import { AdminCreatorCatalog } from "./admin-creator-catalog";
import {
  parseAdminLocation,
  adminLocationHref,
  type AdminLocation,
  type CampaignSection,
} from "../lib/admin-navigation";
import "./admin-workspace.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowUpRight, Building2, RefreshCw, Search, X } from "lucide-react";
import type { AdminAction, Bootstrap, CampaignDetail } from "../lib/types";

type Operation = {
  action: AdminAction;
  id: string;
  title: string;
  message: string;
};
const descriptions: Record<Tab, string> = {
  intake: "브랜드가 전달한 브리프를 실제 의뢰자 명의로 접수합니다.",
  games: "언어별 공식 게임명과 썸네일, 브랜드 검색 공개 상태를 관리합니다.",
  creators: "후보의 채널, 가용 일정과 견적 이력을 관리합니다.",
  overview: "기한이 임박한 업무와 담당자별 처리할 일을 확인하세요.",
  users: "브랜드·에이전시 계정의 소속 회사와 권한, 이용 상태를 관리하세요.",
  organizations:
    "승인 대기 중인 브랜드·에이전시의 제출 정보를 확인하고 심사하세요.",
  campaigns:
    "맞춤 의뢰와 오픈 모집의 후보 선정부터 제작·성과·청구까지 이어서 관리하세요.",
  requests:
    "브랜드의 문의부터 캠페인 변경 요청까지, 담당자를 정하고 답변을 이어가세요.",
  audit: "담당자의 검토 사유부터 처리 결과까지, 운영의 흐름을 확인하세요.",
};
const actionLabels: Record<string, string> = {
  "campaign.delegated_intake": "브랜드 의뢰 대리 접수",
  "settlement.reissueBrandInvoice": "청구서 정정 발행",
  "game.create": "게임 DB 등록",
  "game.update": "게임 DB 수정",
  "game.thumbnail_upload": "게임 썸네일 업로드",
  "creator.create": "내부 크리에이터 등록",
  "creator.update": "내부 크리에이터 수정",
  "creator.rates": "크리에이터 단가표 개정",
  approveOrganization: "조직 승인",
  requestOrganizationChanges: "조직 보완 요청",
  suspendOrganization: "조직 이용 정지",
  publishCampaign: "캠페인 승인 · 공개",
  returnCampaign: "캠페인 보완 요청",
  closeCampaign: "캠페인 모집 마감",
  revokeUserSessions: "사용자 세션 종료",
  downloadDocument: "증빙 문서 다운로드",
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "미설정";
async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "요청을 처리하지 못했습니다.",
    );
  }
  return body as T;
}

function ConfirmOperation({
  operation,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  operation: Operation | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (operation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [operation]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(String(new FormData(event.currentTarget).get("reason") ?? ""));
  }
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="admin-operation-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {operation && (
        <form
          className="admin-form"
          onSubmit={submit}
          key={`${operation.action}:${operation.id}`}
        >
          <div className="admin-row">
            <h2 id="admin-operation-title">{operation.title}</h2>
            <AdminButton
              type="button"
              className="icon"
              aria-label="닫기"
              disabled={busy}
              onClick={onClose}
            >
              <X size={22} />
            </AdminButton>
          </div>
          <p>{operation.message}</p>
          {error && (
            <p role="alert" className="admin-alert error">
              {error}
            </p>
          )}
          <label>
            조치 사유
            <textarea
              name="reason"
              required
              minLength={2}
              maxLength={1000}
              rows={4}
              placeholder="검토 결과와 사유를 남겨주세요. 변경 이력에 보관됩니다."
              disabled={busy}
            />
          </label>
          <label className="admin-check">
            <input type="checkbox" required disabled={busy} />
            내용을 확인했으며 이 변경을 적용합니다.
          </label>
          <div className="admin-actions">
            <AdminButton type="button" onClick={onClose} disabled={busy}>
              취소
            </AdminButton>
            <AdminButton className="primary" disabled={busy}>
              {busy ? "처리 중…" : "확인 · 적용"}
            </AdminButton>
          </div>
        </form>
      )}
    </dialog>
  );
}

export function AdminConsole({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("");
  const [section, setSection] = useState<CampaignSection>("overview");
  const [scope, setScope] = useState<AdminLocation["scope"]>("all");
  const [requestId, setRequestId] = useState("");
  const [viewRefresh, setViewRefresh] = useState(0);
  const locationRef = useRef<AdminLocation>(parseAdminLocation(""));
  const [accountType, setAccountType] =
    useState<AdminLocation["accountType"]>("all");
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [requestRefresh, setRequestRefresh] = useState(0);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson<Bootstrap>("/api/admin/bootstrap"));
      setViewRefresh((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<Bootstrap>("/api/admin/bootstrap", {
      signal: controller.signal,
    })
      .then(setData)
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "데이터를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!selected || tab !== "campaigns") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDetailLoading(true);
      setCampaignDetail(null);
      void fetchJson<CampaignDetail>(`/api/admin/${tab}/${selected}`, {
        signal: controller.signal,
      })
        .then(setCampaignDetail)
        .catch((caught) => {
          if (!controller.signal.aborted)
            setError(
              caught instanceof Error
                ? caught.message
                : "상세 정보를 읽지 못했습니다.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selected, tab, data]);
  const applyLocation = useCallback((next: AdminLocation, push = true) => {
    if (
      push &&
      !window.dispatchEvent(new Event("admin:navigate", { cancelable: true }))
    )
      return;
    const previous = locationRef.current;
    locationRef.current = next;
    setTab(next.tab);
    setFilter(next.status);
    setSelected(next.selected);
    setSection(next.section);
    setScope(next.scope);
    setAccountType(next.accountType);
    setRequestId(next.request);
    setNotice("");
    setError("");
    if (previous.tab !== next.tab || previous.selected !== next.selected) {
      setCampaignDetail(null);
      setQuery("");
    }
    if (push) {
      window.history.pushState(null, "", adminLocationHref(next));
      if (previous.tab !== next.tab || previous.selected !== next.selected) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "instant" });
          document
            .getElementById("admin-content")
            ?.focus({ preventScroll: true });
        });
      }
    }
  }, []);
  useEffect(() => {
    const read = () =>
      applyLocation(parseAdminLocation(window.location.search), false);
    read();
    const pop = () => {
      if (
        !window.dispatchEvent(new Event("admin:navigate", { cancelable: true }))
      ) {
        window.history.pushState(
          null,
          "",
          adminLocationHref(locationRef.current),
        );
        return;
      }
      read();
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [applyLocation]);
  function navigate(value: Tab, status = "all") {
    applyLocation({ ...parseAdminLocation(""), tab: value, status });
  }
  function openDetail(id: string) {
    applyLocation({
      ...locationRef.current,
      selected: id,
      section: "overview",
    });
  }
  function openCampaign(id: string, target: CampaignSection = "overview") {
    applyLocation({
      ...parseAdminLocation(""),
      tab: "campaigns",
      selected: id,
      section: target,
    });
  }
  function openRequest(id: string) {
    applyLocation({ ...parseAdminLocation(""), tab: "requests", request: id });
  }
  function changeSection(target: CampaignSection) {
    applyLocation({ ...locationRef.current, section: target });
  }
  async function mutate(reason: string) {
    if (!operation || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: operation.action,
          id: operation.id,
          reason,
        }),
      });
      setNotice(`${operation.title} 처리 완료`);
      setOperation(null);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "변경을 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      !window.dispatchEvent(new Event("admin:navigate", { cancelable: true }))
    )
      return;
    setBusy(true);
    try {
      await fetchJson("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      window.location.assign("/login");
    } catch {
      setError("로그아웃에 실패했습니다. 다시 시도하세요.");
      setBusy(false);
    }
  }
  const match = (value: string) =>
    value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const campaign =
    campaignDetail?.id === selected
      ? campaignDetail.campaign
      : data?.campaigns.find((value) => value.id === selected);
  const title =
    tab === "campaigns" && selected
      ? (campaign?.title ?? "캠페인 운영")
      : tabs.find((value) => value.key === tab)!.label;
  const usesBootstrapView =
    tab !== "requests" &&
    tab !== "intake" &&
    tab !== "creators" &&
    tab !== "games";
  return (
    <AdminShell
      name={name}
      tab={tab}
      busy={busy}
      onNavigate={navigate}
      onLogout={() => void logout()}
    >
      <main id="admin-content" tabIndex={-1}>
        <div className="admin-heading">
          <div>
            {tab === "campaigns" && selected ? (
              <AdminButton
                type="button"
                className="admin-back admin-text-button"
                onClick={() => openDetail("")}
              >
                ← 캠페인 목록
              </AdminButton>
            ) : null}
            <h1>{title}</h1>
            <p>{descriptions[tab]}</p>
          </div>
          {tab !== "intake" && (
            <AdminButton
              disabled={loading || busy}
              onClick={() => {
                if (
                  !window.dispatchEvent(
                    new Event("admin:navigate", { cancelable: true }),
                  )
                )
                  return;
                if (tab === "requests") setRequestRefresh((value) => value + 1);
                else void refresh();
              }}
            >
              <RefreshCw
                size={17}
                className={loading ? "admin-spin" : undefined}
              />
              새로고침
            </AdminButton>
          )}
        </div>
        {error && (
          <div role="alert" className="admin-alert error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="admin-alert success">
            {notice}
          </div>
        )}
        {tab === "requests" && (
          <RequestConsole
            userId={userId}
            refreshToken={requestRefresh}
            initialRequestId={requestId}
            onSelectRequest={(id) => {
              const next = { ...locationRef.current, request: id };
              locationRef.current = next;
              setRequestId(id);
              window.history.replaceState(null, "", adminLocationHref(next));
            }}
            onCampaign={(id) => openCampaign(id)}
          />
        )}
        {tab === "intake" && (
          <AdminDelegatedIntake
            onCreated={(id) => openCampaign(id)}
            onCancel={() => navigate("campaigns")}
          />
        )}
        {tab === "games" && (
          <AdminGameCatalog
            key={selected}
            refreshToken={viewRefresh}
            initialGameId={selected}
            onSelectGame={(id) => {
              const next = { ...locationRef.current, selected: id };
              locationRef.current = next;
              setSelected(id);
              if (id !== selected) {
                if (selected === "new" && id)
                  window.history.replaceState(
                    null,
                    "",
                    adminLocationHref(next),
                  );
                else
                  window.history.pushState(null, "", adminLocationHref(next));
              }
            }}
          />
        )}
        {tab === "creators" && (
          <AdminCreatorCatalog refreshToken={viewRefresh} />
        )}
        {usesBootstrapView && loading && !data && (
          <section className="admin-panel admin-empty" aria-live="polite">
            운영 데이터를 불러오는 중입니다…
          </section>
        )}
        {data && usesBootstrapView && (
          <>
            {tab === "overview" ? (
              <>
                <OperationsDashboard
                  userId={userId}
                  refreshToken={viewRefresh}
                  onCampaign={openCampaign}
                  onRequest={openRequest}
                />
                <div className="admin-context-links">
                  <AdminButton
                    type="button"
                    onClick={() => navigate("organizations")}
                  >
                    심사 대기 {data.counts.pendingOrganizations}건
                    <ArrowUpRight size={16} />
                  </AdminButton>
                  <AdminButton
                    type="button"
                    onClick={() => navigate("campaigns", "REVIEW")}
                  >
                    캠페인 접수 검토 {data.counts.reviewCampaigns}건
                    <ArrowUpRight size={16} />
                  </AdminButton>
                </div>
                <section className="admin-panel">
                  <div className="admin-row">
                    <h2>최근 변경 이력</h2>
                    <AdminButton
                      className="admin-text-button"
                      onClick={() => navigate("audit")}
                    >
                      전체 보기 <ArrowUpRight size={17} />
                    </AdminButton>
                  </div>
                  <AuditTable rows={data.audits.slice(0, 8)} />
                </section>
              </>
            ) : (
              <>
                {tab === "campaigns" && !selected ? (
                  <AdminCampaignList
                    scope={scope}
                    status={filter}
                    refreshToken={viewRefresh}
                    onFilter={(nextScope, status) =>
                      applyLocation({
                        ...locationRef.current,
                        scope: nextScope,
                        status,
                      })
                    }
                    onSelect={openDetail}
                  />
                ) : null}
                {(tab === "users" || tab === "organizations") && (
                  <AdminAccountWorkspace
                    key={tab}
                    mode={tab === "users" ? "accounts" : "reviews"}
                    data={data}
                    userId={userId}
                    busy={busy}
                    accountType={accountType}
                    status={filter}
                    selected={selected}
                    onFilter={(type, status) =>
                      applyLocation({
                        ...locationRef.current,
                        accountType: type,
                        status,
                        selected: "",
                      })
                    }
                    onSelect={openDetail}
                    onReview={(id, type) =>
                      applyLocation({
                        ...parseAdminLocation(""),
                        tab: "organizations",
                        selected: id,
                        accountType: type,
                      })
                    }
                    onOperation={setOperation}
                  />
                )}
                {tab === "audit" && (
                  <section className="admin-panel">
                    <div className="admin-toolbar">
                      <label className="admin-search">
                        <Search size={18} />
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="조치 또는 대상 ID 검색"
                          aria-label="목록 검색"
                        />
                      </label>
                    </div>
                    <p className="admin-small">
                      최근 100개 변경 이력 내 검색입니다.
                    </p>
                    <AuditTable
                      rows={data.audits.filter((audit) =>
                        match(
                          `${audit.action} ${audit.entityId} ${audit.reason} ${actionLabels[audit.action.replace("admin.", "")]}`,
                        ),
                      )}
                    />
                  </section>
                )}
                {selected && tab === "campaigns" && (
                  <section className="admin-detail admin-flat-section">
                    <div className="admin-row">
                      <h2>캠페인 운영</h2>
                      <AdminButton
                        className="icon"
                        aria-label="상세 닫기"
                        onClick={() => openDetail("")}
                      >
                        <X size={22} />
                      </AdminButton>
                    </div>
                    {detailLoading ? (
                      <p role="status">상세 정보를 불러오는 중입니다…</p>
                    ) : campaignDetail && campaign ? (
                      <AdminCampaignWorkspace
                        detail={campaignDetail}
                        section={section}
                        userId={userId}
                        busy={busy}
                        onSection={changeSection}
                        onRequest={openRequest}
                        onOperation={setOperation}
                        onCommitted={() => void refresh()}
                      />
                    ) : null}
                  </section>
                )}
              </>
            )}
          </>
        )}
        <footer className="admin-footer">
          <Building2 size={16} />
          승인·정지·공개 조치와 문서 다운로드 이력은 데이터베이스에 기록됩니다.
        </footer>
      </main>
      <ConfirmOperation
        operation={operation}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) setOperation(null);
        }}
        onSubmit={(reason) => void mutate(reason)}
      />
    </AdminShell>
  );
}
function AuditTable({ rows }: { rows: Bootstrap["audits"] }) {
  if (!rows.length)
    return <p className="admin-note">표시할 변경 이력이 없습니다.</p>;
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>시각 (한국)</th>
            <th>담당자</th>
            <th>조치</th>
            <th>사유 / 대상</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{date(row.createdAt)}</td>
              <td>{row.actorName}</td>
              <td>
                {actionLabels[row.action.replace("admin.", "")] ?? row.action}
              </td>
              <td>
                {row.reason || "—"}
                <span className="admin-sub admin-id">
                  {row.entityType} · {row.entityId}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
