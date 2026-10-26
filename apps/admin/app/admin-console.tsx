"use client";
import { BrandLogo } from "./brand-logo";
import { RequestConsole } from "./request-console";
import CampaignOperations from "./campaign-operations";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type {
  AdminAction,
  Bootstrap,
  CampaignDetail,
  OrganizationDetail,
} from "../lib/types";

type Tab =
  "overview" | "users" | "organizations" | "campaigns" | "requests" | "audit";
type Operation = {
  action: AdminAction;
  id: string;
  title: string;
  message: string;
};
const tabs = [
  { key: "overview", label: "운영 현황", icon: LayoutDashboard },
  { key: "users", label: "사용자 관리", icon: Users },
  { key: "organizations", label: "조직 · 심사 관리", icon: ShieldCheck },
  { key: "campaigns", label: "캠페인 · 신청 관리", icon: Megaphone },
  { key: "requests", label: "브랜드 요청함", icon: Inbox },
  { key: "audit", label: "변경 이력", icon: Activity },
] as const;
const descriptions: Record<Tab, string> = {
  overview: "브랜드와 에이전시의 다음 만남, 오늘의 운영 현황을 확인하세요.",
  users: "플랫폼에 함께하는 사용자와 소속 조직, 접근 권한을 확인하세요.",
  organizations: "파트너의 회사 정보와 제출 서류를 살펴보고 심사를 진행하세요.",
  campaigns: "새로운 협업이 시작되도록 캠페인과 에이전시 신청을 검토하세요.",
  requests:
    "브랜드의 문의부터 캠페인 변경 요청까지, 담당자를 정하고 답변을 이어가세요.",
  audit: "담당자의 검토 사유부터 처리 결과까지, 운영의 흐름을 확인하세요.",
};
const labels: Record<string, string> = {
  ACTIVE: "승인",
  PENDING: "승인 대기",
  SUSPENDED: "이용 정지",
  BRAND: "브랜드",
  AGENCY: "에이전시",
  PLATFORM: "운영 조직",
  OWNER: "소유자",
  ADMIN: "관리자",
  MEMBER: "멤버",
  DRAFT: "초안",
  REVIEW: "공개 검토",
  RECRUITING: "모집 중",
  IN_PROGRESS: "모집 마감",
  VERIFYING: "콘텐츠 검수",
  SETTLING: "정산",
  COMPLETED: "완료",
  CANCELED: "취소",
  SUBMITTED: "신청 접수",
  SHORTLISTED: "검토 후보",
  ACCEPTED: "선정",
  REJECTED: "미선정",
  WITHDRAWN: "신청 철회",
  UPLOADED: "검증 완료",
  BUSINESS_REGISTRATION: "사업자 증빙",
  CONTRACT: "계약서",
};
const actionLabels: Record<string, string> = {
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
const money = (value: string | null, currency: string) =>
  value
    ? `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value))}`
    : "미설정";
const badge = (value: string) => (
  <span className={`admin-badge state-${value.toLowerCase()}`}>
    {labels[value] ?? value}
  </span>
);
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
            <button
              type="button"
              className="icon"
              aria-label="닫기"
              disabled={busy}
              onClick={onClose}
            >
              <X size={22} />
            </button>
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
            <button type="button" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "처리 중…" : "확인 · 적용"}
            </button>
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
  const [orgDetail, setOrgDetail] = useState<OrganizationDetail | null>(null);
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
    if (!selected || !["organizations", "campaigns"].includes(tab)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDetailLoading(true);
      setOrgDetail(null);
      setCampaignDetail(null);
      void fetchJson<OrganizationDetail | CampaignDetail>(
        `/api/admin/${tab}/${selected}`,
        { signal: controller.signal },
      )
        .then((value) => {
          if (tab === "organizations")
            setOrgDetail(value as OrganizationDetail);
          else setCampaignDetail(value as CampaignDetail);
        })
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
  function navigate(value: Tab, status = "all") {
    setTab(value);
    setFilter(status);
    setQuery("");
    setSelected("");
    setOrgDetail(null);
    setCampaignDetail(null);
    setNotice("");
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
  const org = data?.organizations.find((value) => value.id === selected);
  const campaign =
    campaignDetail?.id === selected
      ? campaignDetail.campaign
      : data?.campaigns.find((value) => value.id === selected);
  const title = tabs.find((value) => value.key === tab)!.label;
  const visibleUsers =
    data?.users.filter((user) => match(`${user.name} ${user.email}`)) ?? [];
  const visibleOrganizations =
    data?.organizations.filter(
      (org) => (filter === "all" || org.status === filter) && match(org.name),
    ) ?? [];
  const visibleCampaigns =
    data?.campaigns.filter(
      (campaign) =>
        (filter === "all" || campaign.status === filter) &&
        match(`${campaign.title} ${campaign.brandName}`),
    ) ?? [];
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-content">
        본문으로 건너뛰기
      </a>
      <aside className="admin-sidebar">
        <BrandLogo />
        <span className="admin-workspace-label">운영 콘솔</span>
        <nav aria-label="관리자 메뉴">
          {tabs.map((item) => (
            <button
              key={item.key}
              aria-current={tab === item.key ? "page" : undefined}
              className={tab === item.key ? "active" : ""}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <a
            href="https://futures-medialab.vercel.app"
            target="_blank"
            rel="noreferrer"
          >
            퓨쳐스 메인 보기 <ArrowUpRight size={18} />
          </a>
          <span>
            <ShieldCheck size={17} /> 운영자 전용 공간
          </span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>운영 콘솔</span>
            <ChevronRight size={15} />
            <strong>{title}</strong>
          </div>
          <div>
            <div className="admin-operator">
              <span className="admin-avatar" aria-hidden="true">
                {Array.from(name.trim())[0] || "F"}
              </span>
              <span>
                {name}
                <small>관리자</small>
              </span>
            </div>
            <button
              className="icon"
              aria-label="로그아웃"
              disabled={busy}
              onClick={() => void logout()}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main id="admin-content" tabIndex={-1}>
          <div className="admin-heading">
            <div>
              <span className="admin-eyebrow">퓨쳐스 파트너 운영</span>
              <h1>{title}</h1>
              <p>{descriptions[tab]}</p>
            </div>
            <button
              disabled={loading || busy}
              onClick={() =>
                tab === "requests"
                  ? setRequestRefresh((value) => value + 1)
                  : void refresh()
              }
            >
              <RefreshCw
                size={17}
                className={loading ? "admin-spin" : undefined}
              />
              새로고침
            </button>
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
              onCampaign={(id) => {
                navigate("campaigns");
                setSelected(id);
              }}
            />
          )}
          {tab !== "requests" && loading && !data && (
            <section className="admin-panel admin-empty" aria-live="polite">
              운영 데이터를 불러오는 중입니다…
            </section>
          )}
          {data && tab !== "requests" && (
            <>
              {tab === "overview" ? (
                <>
                  <section className="admin-stats" aria-label="운영 지표">
                    {[
                      {
                        label: "전체 사용자",
                        icon: Users,
                        value: data.counts.users,
                        target: "users" as const,
                        status: "all",
                      },
                      {
                        label: "조직 심사 대기",
                        icon: ShieldCheck,
                        value: data.counts.pendingOrganizations,
                        target: "organizations" as const,
                        status: "PENDING",
                      },
                      {
                        label: "캠페인 공개 검토",
                        icon: ClipboardCheck,
                        value: data.counts.reviewCampaigns,
                        target: "campaigns" as const,
                        status: "REVIEW",
                      },
                      {
                        label: "모집 중 캠페인",
                        icon: Megaphone,
                        value: data.counts.recruitingCampaigns,
                        target: "campaigns" as const,
                        status: "RECRUITING",
                      },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        onClick={() => navigate(stat.target, stat.status)}
                      >
                        <span className="admin-stat-top">
                          <span className="admin-stat-icon">
                            <stat.icon size={22} />
                          </span>
                          <ArrowUpRight size={19} />
                        </span>
                        <span className="admin-stat-label">{stat.label}</span>
                        <strong>
                          {stat.value.toLocaleString()}
                          <small>{stat.target === "users" ? "명" : "건"}</small>
                        </strong>
                      </button>
                    ))}
                  </section>
                  <section className="admin-panel">
                    <div className="admin-section-heading">
                      <span className="admin-feature-icon">
                        <ClipboardCheck size={24} />
                      </span>
                      <div>
                        <h2>캠페인이 에이전시에 전달되는 순서</h2>
                        <p>기업 승인과 캠페인 공개 승인은 별개의 검토입니다.</p>
                      </div>
                    </div>
                    <ol className="admin-flow">
                      <li>
                        <span className="admin-flow-number">01</span>
                        <b>브랜드 등록</b>
                        <span>브랜드가 초안을 작성하고 검토를 요청합니다.</span>
                      </li>
                      <li>
                        <span className="admin-flow-number">02</span>
                        <b>운영팀 공개 승인</b>
                        <span>
                          요건과 마감일을 확인하면 승인된 에이전시에 공개됩니다.
                        </span>
                      </li>
                      <li>
                        <span className="admin-flow-number">03</span>
                        <b>에이전시 신청</b>
                        <span>
                          제안서와 신청 내역이 실제 데이터베이스에 저장됩니다.
                        </span>
                      </li>
                    </ol>
                    <p className="admin-note">
                      캠페인 {data.counts.applications.toLocaleString()}건의
                      신청이 접수되어 있습니다. 결제·계약·정산은 이 승인만으로
                      실행되지 않습니다.
                    </p>
                  </section>
                  <section className="admin-panel">
                    <div className="admin-row">
                      <h2>최근 변경 이력</h2>
                      <button
                        className="admin-text-button"
                        onClick={() => navigate("audit")}
                      >
                        전체 보기 <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <AuditTable rows={data.audits.slice(0, 8)} />
                  </section>
                </>
              ) : (
                <>
                  <section className="admin-panel">
                    <div className="admin-toolbar">
                      <label className="admin-search">
                        <Search size={18} />
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={
                            tab === "users"
                              ? "이름 또는 이메일 검색"
                              : tab === "organizations"
                                ? "조직명 검색"
                                : tab === "campaigns"
                                  ? "캠페인 또는 브랜드 검색"
                                  : "조치 또는 대상 ID 검색"
                          }
                          aria-label="목록 검색"
                        />
                      </label>
                      {["organizations", "campaigns"].includes(tab) && (
                        <label className="admin-filter">
                          상태
                          <select
                            aria-label="상태 필터"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                          >
                            <option value="all">전체 상태</option>
                            {(tab === "organizations"
                              ? ["PENDING", "ACTIVE", "SUSPENDED"]
                              : [
                                  "DRAFT",
                                  "REVIEW",
                                  "RECRUITING",
                                  "IN_PROGRESS",
                                  "VERIFYING",
                                  "SETTLING",
                                  "COMPLETED",
                                  "CANCELED",
                                ]
                            ).map((value) => (
                              <option key={value} value={value}>
                                {labels[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <p className="admin-small">
                      최근 {tab === "audit" ? "100" : data.limit}개 항목 내
                      검색입니다. 조직·캠페인은 최근 변경순, 사용자는 가입순으로
                      표시합니다.
                    </p>
                    {tab === "users" && (
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>사용자</th>
                              <th>소속 조직 / 권한</th>
                              <th>이메일 인증</th>
                              <th>가입일</th>
                              <th>관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!visibleUsers.length && <EmptyRow columns={5} />}
                            {visibleUsers.map((user) => (
                              <tr key={user.id}>
                                <td>
                                  <strong>{user.name || "이름 없음"}</strong>
                                  <span className="admin-sub">
                                    {user.email}
                                  </span>
                                </td>
                                <td>
                                  {user.organizations.map((org, index) => (
                                    <span className="admin-sub" key={index}>
                                      {org.name} · {labels[org.role]} ·{" "}
                                      {labels[org.status]}
                                    </span>
                                  ))}
                                </td>
                                <td>
                                  {user.emailVerified ? "인증됨" : "미인증"}
                                </td>
                                <td>{date(user.createdAt)}</td>
                                <td>
                                  <button
                                    disabled={
                                      busy ||
                                      user.id === userId ||
                                      user.organizations.some(
                                        (org) => org.type === "PLATFORM",
                                      )
                                    }
                                    onClick={() =>
                                      setOperation({
                                        action: "revokeUserSessions",
                                        id: user.id,
                                        title: "사용자 세션 종료",
                                        message: `${user.email}의 로그인 세션을 모두 종료합니다. 계정은 삭제되지 않으며 비밀번호로 다시 로그인할 수 있습니다.`,
                                      })
                                    }
                                  >
                                    세션 종료
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {tab === "organizations" && (
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>조직</th>
                              <th>유형</th>
                              <th>상태</th>
                              <th>회사 정보</th>
                              <th>멤버</th>
                              <th>상세</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!visibleOrganizations.length && (
                              <EmptyRow columns={6} />
                            )}
                            {visibleOrganizations.map((org) => (
                              <tr
                                key={org.id}
                                className={
                                  selected === org.id ? "selected" : ""
                                }
                              >
                                <td>
                                  <strong>{org.name}</strong>
                                  <span className="admin-sub">
                                    {org.countryCode || "국가 미입력"}
                                  </span>
                                </td>
                                <td>{labels[org.type]}</td>
                                <td>{badge(org.status)}</td>
                                <td>
                                  {org.testAccess
                                    ? "테스트 계정 예외"
                                    : org.submitted
                                      ? "제출 완료"
                                      : "미제출 / 보완 중"}
                                </td>
                                <td>{org.memberCount}</td>
                                <td>
                                  <button onClick={() => setSelected(org.id)}>
                                    심사 보기
                                    <ChevronRight size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {tab === "campaigns" && (
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>캠페인 / 브랜드</th>
                              <th>상태</th>
                              <th>예산</th>
                              <th>신청 마감</th>
                              <th>신청</th>
                              <th>상세</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!visibleCampaigns.length && (
                              <EmptyRow columns={6} />
                            )}
                            {visibleCampaigns.map((campaign) => (
                              <tr
                                key={campaign.id}
                                className={
                                  selected === campaign.id ? "selected" : ""
                                }
                              >
                                <td>
                                  <strong>{campaign.title}</strong>
                                  <span className="admin-sub">
                                    {campaign.brandName} · 브랜드{" "}
                                    {labels[campaign.brandStatus]}
                                  </span>
                                </td>
                                <td>{badge(campaign.status)}</td>
                                <td>
                                  {money(
                                    campaign.budgetAmount,
                                    campaign.currency,
                                  )}
                                </td>
                                <td>{date(campaign.applicationDeadline)}</td>
                                <td>{campaign.applicationCount}</td>
                                <td>
                                  <button
                                    onClick={() => setSelected(campaign.id)}
                                  >
                                    검토 · 신청 보기
                                    <ChevronRight size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {tab === "audit" && (
                      <AuditTable
                        rows={data.audits.filter((audit) =>
                          match(
                            `${audit.action} ${audit.entityId} ${audit.reason} ${actionLabels[audit.action.replace("admin.", "")]}`,
                          ),
                        )}
                      />
                    )}
                  </section>
                  {selected && ["organizations", "campaigns"].includes(tab) && (
                    <section className="admin-panel admin-detail">
                      <div className="admin-row">
                        <h2>
                          {tab === "organizations"
                            ? org?.name
                            : campaign?.title}
                        </h2>
                        <button
                          className="icon"
                          aria-label="상세 닫기"
                          onClick={() => setSelected("")}
                        >
                          <X size={22} />
                        </button>
                      </div>
                      {detailLoading ? (
                        <p role="status">상세 정보를 불러오는 중입니다…</p>
                      ) : tab === "organizations" && orgDetail && org ? (
                        <>
                          <div className="admin-row">
                            {badge(org.status)}
                            <span>
                              {labels[org.type]} ·{" "}
                              {org.testAccess
                                ? "서버에서 지정한 테스트 계정"
                                : "일반 가입 조직"}
                            </span>
                          </div>
                          <dl className="admin-fields">
                            {orgDetail.fields.map((field) => (
                              <div key={field.label}>
                                <dt>{field.label}</dt>
                                <dd>{field.value}</dd>
                              </div>
                            ))}
                          </dl>
                          <h3>제출 문서</h3>
                          {orgDetail.documents.length ? (
                            <ul className="admin-documents">
                              {orgDetail.documents.map((doc) => (
                                <li key={doc.id}>
                                  <div>
                                    <strong>{doc.fileName}</strong>
                                    <span>
                                      {labels[doc.kind]} ·{" "}
                                      {(doc.size / 1024).toFixed(0)} KB ·{" "}
                                      {labels[doc.state] ?? doc.state}
                                    </span>
                                  </div>
                                  {doc.state === "UPLOADED" && (
                                    <a href={`/api/admin/documents/${doc.id}`}>
                                      <Download size={16} />
                                      비공개 다운로드
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="admin-note">
                              제출된 문서가 없습니다.
                            </p>
                          )}
                          <div className="admin-actions">
                            {org.status !== "ACTIVE" && (
                              <button
                                className="primary"
                                disabled={
                                  busy || (!org.submitted && !org.testAccess)
                                }
                                onClick={() =>
                                  setOperation({
                                    action: "approveOrganization",
                                    id: org.id,
                                    title: "조직 승인",
                                    message: `${org.name}에 실제 워크스페이스 접근 권한을 부여합니다. 이메일 인증 상태는 변경되지 않습니다.`,
                                  })
                                }
                              >
                                <CheckCircle2 size={18} />
                                {org.status === "SUSPENDED"
                                  ? "검토 후 이용 재개"
                                  : "승인"}
                              </button>
                            )}
                            {org.status === "PENDING" && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setOperation({
                                    action: "requestOrganizationChanges",
                                    id: org.id,
                                    title: "회사 정보 보완 요청",
                                    message:
                                      "기존 회사 정보와 문서는 보관되며 신청자가 회사 정보를 수정하고 다시 제출할 수 있습니다.",
                                  })
                                }
                              >
                                보완 요청
                              </button>
                            )}
                            {org.status !== "SUSPENDED" && (
                              <button
                                className="danger"
                                disabled={busy}
                                onClick={() =>
                                  setOperation({
                                    action: "suspendOrganization",
                                    id: org.id,
                                    title: "조직 이용 정지",
                                    message:
                                      "이 조직의 플랫폼 접근을 즉시 차단합니다. 브랜드인 경우 모집 캠페인도 에이전시 검색에서 제외됩니다. 기존 데이터는 삭제되지 않습니다.",
                                  })
                                }
                              >
                                이용 정지
                              </button>
                            )}
                          </div>
                        </>
                      ) : tab === "campaigns" && campaignDetail && campaign ? (
                        <>
                          <div className="admin-row">
                            {badge(campaign.status)}
                            <strong>
                              {money(campaign.budgetAmount, campaign.currency)}
                            </strong>
                          </div>
                          <p className="admin-pre">{campaignDetail.summary}</p>
                          <p>
                            플랫폼: {campaign.platforms.join(" · ")} · 신청
                            마감: {date(campaign.applicationDeadline)}
                          </p>
                          {campaign.reviewReason && (
                            <p className="admin-note">
                              최근 검토 사유: {campaign.reviewReason}
                            </p>
                          )}
                          <div className="admin-actions">
                            {campaign.status === "REVIEW" && (
                              <>
                                <button
                                  className="primary"
                                  disabled={
                                    busy || campaign.brandStatus !== "ACTIVE"
                                  }
                                  onClick={() =>
                                    setOperation({
                                      action: "publishCampaign",
                                      id: campaign.id,
                                      title: "캠페인 승인 · 공개",
                                      message:
                                        "공개하면 승인된 에이전시가 이 캠페인을 조회하고 신청할 수 있습니다. 결제나 정산은 실행되지 않습니다. 미래 신청 마감일과 0보다 큰 예산이 필요합니다.",
                                    })
                                  }
                                >
                                  승인 · 에이전시에 공개
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    setOperation({
                                      action: "returnCampaign",
                                      id: campaign.id,
                                      title: "캠페인 보완 요청",
                                      message:
                                        "캠페인을 비공개 초안으로 돌려보냅니다. 브랜드가 내용을 수정하고 다시 검토를 요청할 수 있습니다.",
                                    })
                                  }
                                >
                                  보완 요청
                                </button>
                              </>
                            )}
                            {campaign.status === "RECRUITING" && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setOperation({
                                    action: "closeCampaign",
                                    id: campaign.id,
                                    title: "캠페인 모집 마감",
                                    message:
                                      "신규 신청을 중단합니다. 기존 신청 기록은 유지되며, 모집 중 상태로 자동 복구되지 않습니다.",
                                  })
                                }
                              >
                                모집 마감
                              </button>
                            )}
                          </div>
                          <h3>신청 에이전시 ({campaignDetail.total})</h3>
                          {campaignDetail.applications.length ? (
                            <div className="admin-applications">
                              {campaignDetail.applications.map(
                                (application) => (
                                  <article key={application.id}>
                                    <div className="admin-row">
                                      <div>
                                        <strong>
                                          {application.agencyName}
                                        </strong>
                                        <span className="admin-sub">
                                          조직{" "}
                                          {labels[application.agencyStatus]} ·{" "}
                                          {date(application.createdAt)}
                                        </span>
                                      </div>
                                      {badge(application.status)}
                                    </div>
                                    <p className="admin-pre">
                                      {application.proposal}
                                    </p>
                                    <strong>
                                      제안 금액:{" "}
                                      {money(
                                        application.proposedAmount,
                                        application.currency,
                                      )}
                                    </strong>
                                  </article>
                                ),
                              )}
                            </div>
                          ) : (
                            <p className="admin-note">
                              아직 접수된 신청이 없습니다.
                            </p>
                          )}
                          <p className="admin-small">
                            최근 100건까지 표시합니다. 선정과 미선정 처리는
                            브랜드의 캠페인 관리에서 진행합니다.
                          </p>
                          <CampaignOperations campaignId={campaign.id} />
                        </>
                      ) : null}
                    </section>
                  )}
                </>
              )}
            </>
          )}
          <footer className="admin-footer">
            <Building2 size={16} />
            승인·정지·공개 조치와 문서 다운로드 이력은 데이터베이스에
            기록됩니다.
          </footer>
        </main>
      </div>
      <ConfirmOperation
        operation={operation}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) setOperation(null);
        }}
        onSubmit={(reason) => void mutate(reason)}
      />
    </div>
  );
}
function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td colSpan={columns} className="admin-empty">
        <strong>표시할 항목이 없습니다.</strong>
        <span className="admin-sub">검색어나 상태 필터를 변경해보세요.</span>
      </td>
    </tr>
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
