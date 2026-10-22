"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderOpen,
  Gamepad2,
  Globe2,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import type {
  AgencyApplication,
  AgencyCampaign,
} from "../../lib/campaign-marketplace-types";
import type { Locale } from "../_components/landing-copy";
import { ProfileSelect } from "../onboarding/brand/profile-select";
import { agencyCopy, agencyText } from "./agency-workspace-copy";

type MarketplaceData = {
  campaigns: AgencyCampaign[];
  applications: AgencyApplication[];
  account: { role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "PENDING" };
};
type MarketplaceProps = {
  locale: Locale;
  section: "offers" | "projects";
  status: "ACTIVE" | "PENDING";
  role: "OWNER" | "ADMIN" | "MEMBER";
  onExplore: () => void;
};
type Mutation =
  | {
      action: "apply";
      campaignId: string;
      proposal: string;
      proposedAmount?: string;
    }
  | { action: "withdraw"; applicationId: string };
const defaultFilters = {
  query: "",
  platform: "",
  country: "",
  category: "",
  followers: "",
  currency: "",
  budget: "",
  start: "",
  end: "",
  sort: "newest",
};
const platformLabels: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitch: "Twitch",
  x: "X",
  facebook: "Facebook",
};
const themes = ["violet", "cyan", "blue", "green", "rose"];

function date(value: string | null, locale: Locale) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
}
function amount(value: string | null, currency: string, locale: Locale) {
  return value === null
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "code",
        maximumFractionDigits: 2,
      }).format(Number(value));
}
function applicationLabel(status: string, locale: Locale) {
  const labels: Record<string, [string, string, string]> = {
    SUBMITTED: ["Application submitted", "신청 접수", "申请已提交"],
    SHORTLISTED: ["Shortlisted", "검토 대상", "入围"],
    ACCEPTED: ["Accepted", "선정됨", "已录用"],
    REJECTED: ["Not selected", "미선정", "未录用"],
    WITHDRAWN: ["Withdrawn", "신청 철회", "已撤回"],
  };
  return labels[status] ? agencyText(locale, ...labels[status]) : status;
}
function failureText(code: string, locale: Locale) {
  const messages: Record<string, [string, string, string]> = {
    UNAUTHORIZED: [
      "Your session expired. Please log in again.",
      "로그인이 만료되었습니다. 다시 로그인해 주세요.",
      "登录已过期，请重新登录。",
    ],
    APPROVAL_REQUIRED: [
      "Your organization needs approval before accessing live campaigns.",
      "조직 승인 후 실제 캠페인을 이용할 수 있습니다.",
      "组织获批后可访问真实活动。",
    ],
    FORBIDDEN: [
      "Your account does not have permission for this action.",
      "이 작업을 수행할 권한이 없습니다.",
      "您的账户没有操作权限。",
    ],
    ALREADY_APPLIED: [
      "Your organization has already applied. Refresh to view its application.",
      "이미 신청한 캠페인입니다. 새로고침하여 신청 내역을 확인하세요.",
      "组织已申请该活动，请刷新查看。",
    ],
    CAMPAIGN_CLOSED: [
      "This campaign is no longer accepting applications. Refresh to see current campaigns.",
      "신청이 종료된 캠페인입니다. 새로고침하여 현재 모집 중인 캠페인을 확인하세요.",
      "此活动已停止接受申请，请刷新查看正在招募的活动。",
    ],
    LIMIT_REACHED: [
      "Your organization has reached its application limit. Please contact the operations team.",
      "조직의 신청 한도에 도달했습니다. 운영팀에 문의해 주세요.",
      "组织已达到申请上限，请联系运营团队。",
    ],
    INVALID_STATE: [
      "This campaign or application has changed. Refresh and try again.",
      "캠페인 또는 신청 상태가 변경되었습니다. 새로고침 후 확인하세요.",
      "活动或申请状态已更改，请刷新重试。",
    ],
    CONFLICT: [
      "Another update was processed. Refresh before trying again.",
      "다른 변경이 처리되었습니다. 새로고침 후 다시 시도하세요.",
      "其他更新已处理，请刷新重试。",
    ],
    RATE_LIMITED: [
      "Too many requests. Please wait a minute and try again.",
      "요청이 많습니다. 잠시 후 다시 시도하세요.",
      "请求过多，请稍后重试。",
    ],
    INVALID_INPUT: [
      "Check the proposal and amount, then try again.",
      "제안 내용과 금액을 확인해 주세요.",
      "请检查提案内容和金额。",
    ],
  };
  return messages[code]
    ? agencyText(locale, ...messages[code])
    : agencyText(
        locale,
        "We could not complete the request. Please refresh and try again.",
        "요청을 처리하지 못했습니다. 새로고침 후 다시 시도하세요.",
        "无法完成请求，请刷新重试。",
      );
}

export function AgencyMarketplace({
  locale,
  section,
  status,
  role,
  onExplore,
}: MarketplaceProps) {
  const copy = agencyCopy[locale];
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const [data, setData] = useState<MarketplaceData | null>(null);
  const [loading, setLoading] = useState(status === "ACTIVE");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"applied" | "withdrawn" | "">("");
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mutationInFlight = useRef(false);
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(() => {
    if (status !== "ACTIVE") return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return fetch("/api/agency/campaigns", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setErrorCode(
            typeof result.code === "string" ? result.code : "UNAVAILABLE",
          );
          setData(null);
        } else if (
          Array.isArray(result.campaigns) &&
          Array.isArray(result.applications) &&
          result.account
        ) {
          setErrorCode("");
          setData(result as MarketplaceData);
          setNow(Date.now());
        } else {
          setErrorCode("UNAVAILABLE");
          setData(null);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setErrorCode("UNAVAILABLE");
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [status]);

  function refresh() {
    setLoading(true);
    setErrorCode("");
    return load();
  }

  useEffect(() => {
    void load();
    const onFocus = () => {
      setNow(Date.now());
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 30_000);
    return () => {
      request.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [load]);

  const canManage =
    status === "ACTIVE" &&
    role !== "MEMBER" &&
    data?.account.status === "ACTIVE" &&
    data.account.role !== "MEMBER";
  const campaigns = data?.campaigns ?? [];
  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
  const regionName = (value: string) => {
    if (value === "GLOBAL") return copy.global;
    try {
      return (
        new Intl.DisplayNames([locale], { type: "region" }).of(value) ?? value
      );
    } catch {
      return value;
    }
  };
  const categoryName = (value: string) =>
    ({
      gaming: copy.gaming,
      entertainment: copy.entertainment,
      lifestyle: copy.lifestyle,
      technology: t("Technology", "테크놀로지", "科技"),
      beauty: t("Beauty", "뷰티", "美妆"),
      travel: t("Travel", "여행", "旅游"),
    })[value] ?? value;
  const audience = (campaign: AgencyCampaign) =>
    campaign.followerMin === null && campaign.followerMax === null
      ? copy.anyFollowers
      : `${campaign.followerMin === null ? "0" : compact(campaign.followerMin)} – ${campaign.followerMax === null ? "∞" : compact(campaign.followerMax)}`;
  const invalidDates = Boolean(
    filters.start && filters.end && filters.start > filters.end,
  );
  const offers = campaigns
    .filter((campaign) => {
      const day = campaign.applicationDeadline?.slice(0, 10) ?? "";
      const followers = Number(filters.followers);
      return (
        !invalidDates &&
        (!filters.query ||
          `${campaign.title} ${campaign.summary}`
            .toLowerCase()
            .includes(filters.query.toLowerCase().trim())) &&
        (!filters.platform || campaign.platforms.includes(filters.platform)) &&
        (!filters.country ||
          campaign.regions.length === 0 ||
          campaign.regions.includes("GLOBAL") ||
          campaign.regions.includes(filters.country)) &&
        (!filters.category || campaign.categories.includes(filters.category)) &&
        (!filters.followers ||
          ((campaign.followerMin === null ||
            campaign.followerMin <= followers) &&
            (campaign.followerMax === null ||
              campaign.followerMax >= followers))) &&
        (!filters.currency || campaign.currency === filters.currency) &&
        (!filters.budget ||
          !filters.currency ||
          (campaign.budgetAmount !== null &&
            Number(campaign.budgetAmount) >= Number(filters.budget))) &&
        (!filters.start || Boolean(day && day >= filters.start)) &&
        (!filters.end || Boolean(day && day <= filters.end))
      );
    })
    .sort((a, b) =>
      filters.sort === "closing"
        ? (a.applicationDeadline ?? "9999").localeCompare(
            b.applicationDeadline ?? "9999",
          )
        : filters.sort === "highest"
          ? a.currency.localeCompare(b.currency) ||
            Number(b.budgetAmount ?? 0) - Number(a.budgetAmount ?? 0)
          : (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    );
  const countries = [
    ...new Set(campaigns.flatMap((campaign) => campaign.regions)),
  ]
    .filter((value) => value !== "GLOBAL")
    .sort();
  const categories = [
    ...new Set(campaigns.flatMap((campaign) => campaign.categories)),
  ].sort();

  function updateFilter(key: keyof typeof defaultFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "currency" && !value ? { budget: "" } : {}),
    }));
  }
  function select(
    key: keyof typeof defaultFilters,
    label: string,
    options: { value: string; label: string }[],
  ) {
    return (
      <ProfileSelect
        id={`agency-${key}`}
        label={label}
        placeholder={copy.any}
        value={filters[key]}
        onChange={(value) => updateFilter(key, value)}
        options={options}
      />
    );
  }
  async function mutate(input: Mutation) {
    if (!canManage || mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/agency/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.code === "string" ? result.code : "UNAVAILABLE",
        );
      setNotice(input.action === "apply" ? "applied" : "withdrawn");
      await refresh();
      return true;
    } catch (error) {
      throw error instanceof Error ? error : new Error("UNAVAILABLE");
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  if (status === "PENDING")
    return (
      <section className="cwa-empty">
        <FolderOpen size={36} aria-hidden="true" />
        <h2>{copy.applyPending}</h2>
        <p>
          {t(
            "Published campaigns and applications become available when your organization is approved.",
            "조직이 승인되면 공개 캠페인과 신청 기능을 이용할 수 있습니다.",
            "组织获批后即可查看已发布活动并申请。",
          )}
        </p>
        <Link className="cwa-button" href={`/onboarding/agency?lang=${locale}`}>
          {copy.reviewProfile}
        </Link>
      </section>
    );

  return (
    <>
      <div className="cwa-live-toolbar">
        <p>
          {section === "projects"
            ? t(
                "Your organization's applications are saved here, including closed campaigns.",
                "모집이 종료된 캠페인을 포함해 우리 조직의 신청 내역을 확인합니다.",
                "查看组织申请记录，包括已结束招募的活动。",
              )
            : t(
                "Only campaigns approved and published by the operations team appear here.",
                "운영팀이 승인·공개한 실제 캠페인만 표시됩니다.",
                "此处仅显示运营团队审核发布的真实活动。",
              )}
        </p>
        <button
          className="cwa-button"
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("Refresh", "새로고침", "刷新")}
        </button>
      </div>
      {notice && (
        <p className="cwa-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {notice === "applied"
            ? t(
                "Application submitted. You can follow its status in My Projects.",
                "신청이 접수되었습니다. 내 프로젝트에서 상태를 확인하세요.",
                "申请已提交，可在我的项目查看状态。",
              )
            : t(
                "Your application has been withdrawn.",
                "신청을 철회했습니다.",
                "申请已撤回。",
              )}
        </p>
      )}
      {errorCode && (
        <section className="cwa-api-error" role="alert">
          <p>{failureText(errorCode, locale)}</p>
          {errorCode === "UNAUTHORIZED" ? (
            <Link className="cwa-button" href={`/login?lang=${locale}`}>
              {t("Log in", "로그인", "登录")}
            </Link>
          ) : (
            <button
              className="cwa-button"
              type="button"
              onClick={() => void refresh()}
            >
              {t("Try again", "다시 시도", "重试")}
            </button>
          )}
        </section>
      )}
      {loading && (
        <p className="cwa-loading" role="status">
          {t(
            "Loading campaign data…",
            "캠페인 정보를 불러오는 중…",
            "正在加载活动数据…",
          )}
        </p>
      )}
      {data && section === "offers" && (
        <>
          <section className="cwa-filters" aria-label={copy.searchLabel}>
            <div className="cwa-search-row">
              <label className="cwa-search-input">
                <Search size={19} aria-hidden="true" />
                <input
                  aria-label={copy.searchLabel}
                  placeholder={t(
                    "Search title or brief…",
                    "캠페인 이름 또는 내용 검색…",
                    "搜索活动名称或内容…",
                  )}
                  value={filters.query}
                  onChange={(event) =>
                    updateFilter("query", event.target.value)
                  }
                />
              </label>
              <button
                className="cwa-button"
                type="button"
                onClick={() => setFilters(defaultFilters)}
              >
                {copy.reset}
              </button>
            </div>
            <div className="cwa-filter-grid cwa-live-filters">
              {select("platform", copy.platform, [
                { value: "", label: copy.allPlatforms },
                ...Object.entries(platformLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ])}
              {select("country", copy.country, [
                { value: "", label: copy.allCountries },
                ...countries.map((value) => ({
                  value,
                  label: regionName(value),
                })),
              ])}
              {select("category", copy.category, [
                { value: "", label: copy.allCategories },
                ...categories.map((value) => ({
                  value,
                  label: categoryName(value),
                })),
              ])}
              <label className="cwa-live-field">
                <span>{copy.followers}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={copy.anyFollowers}
                  value={filters.followers}
                  onChange={(event) =>
                    updateFilter("followers", event.target.value)
                  }
                />
              </label>
              {select(
                "currency",
                t("Budget currency", "예산 통화", "预算币种"),
                [
                  { value: "", label: copy.any },
                  ...["USD", "KRW", "CNY"].map((value) => ({
                    value,
                    label: value,
                  })),
                ],
              )}
              <label className="cwa-live-field">
                <span>{t("Minimum budget", "최소 예산", "最低预算")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!filters.currency}
                  placeholder={
                    filters.currency ||
                    t("Select currency first", "통화부터 선택", "先选择币种")
                  }
                  value={filters.budget}
                  onChange={(event) =>
                    updateFilter("budget", event.target.value)
                  }
                />
              </label>
              <fieldset className="cwa-date-range">
                <legend>{copy.deadline}</legend>
                <div>
                  <input
                    type="date"
                    aria-label={`${copy.deadline} ${copy.startDate}`}
                    value={filters.start}
                    onChange={(event) =>
                      updateFilter("start", event.target.value)
                    }
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="date"
                    aria-label={`${copy.deadline} ${copy.endDate}`}
                    value={filters.end}
                    onChange={(event) =>
                      updateFilter("end", event.target.value)
                    }
                  />
                </div>
              </fieldset>
            </div>
            {invalidDates && (
              <p className="cwa-date-error" role="alert">
                {copy.invalidDates}
              </p>
            )}
          </section>
          <div className="cwa-results-toolbar">
            <p>
              <strong>{offers.length}</strong>{" "}
              {t("campaigns", "개 캠페인", "个活动")}
            </p>
            <div>
              {select("sort", copy.sort, [
                { value: "newest", label: copy.newest },
                { value: "closing", label: copy.closing },
                {
                  value: "highest",
                  label: t(
                    "Budget (by currency)",
                    "통화별 예산순",
                    "按币种和预算",
                  ),
                },
              ])}
              <div
                className="cwa-view-toggle"
                aria-label={t("Display mode", "표시 방식", "显示方式")}
              >
                <button
                  type="button"
                  aria-pressed={view === "board"}
                  className={view === "board" ? "is-active" : ""}
                  onClick={() => setView("board")}
                >
                  <LayoutGrid size={18} aria-hidden="true" />
                  {copy.board}
                </button>
                <button
                  type="button"
                  aria-pressed={view === "list"}
                  className={view === "list" ? "is-active" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={18} aria-hidden="true" />
                  {copy.list}
                </button>
              </div>
            </div>
          </div>
          {offers.length ? (
            <div className={`cwa-offers cwa-offers-${view}`}>
              {offers.map((campaign, index) => {
                const expired =
                  now !== null &&
                  Boolean(
                    campaign.applicationDeadline &&
                    new Date(campaign.applicationDeadline).getTime() <= now,
                  );
                return (
                  <article className="cwa-offer" key={campaign.id}>
                    <button
                      type="button"
                      className={`cwa-offer-art cwa-theme-${themes[index % themes.length]}`}
                      onClick={() => setSelectedId(campaign.id)}
                      aria-label={`${copy.viewBrief}: ${campaign.title}`}
                    >
                      <span className="cwa-art-orbit" />
                      <Gamepad2
                        className="cwa-art-icon"
                        size={104}
                        aria-hidden="true"
                      />
                      <span className="cwa-card-badge">
                        {campaign.application
                          ? applicationLabel(
                              campaign.application.status,
                              locale,
                            )
                          : expired
                            ? t("Closed", "마감", "已截止")
                            : t("Recruiting", "모집 중", "招募中")}
                      </span>
                      <span className="cwa-art-brand">
                        {campaign.platforms
                          .map((value) => platformLabels[value] ?? value)
                          .join(" + ")}
                      </span>
                    </button>
                    <div className="cwa-offer-body">
                      <div className="cwa-offer-meta">
                        <span>
                          {campaign.categories.map(categoryName).join(" / ") ||
                            copy.allCategories}
                        </span>
                        <span>
                          <CalendarDays size={14} aria-hidden="true" />
                          {date(campaign.applicationDeadline, locale)}
                        </span>
                      </div>
                      <h2>
                        <button
                          type="button"
                          onClick={() => setSelectedId(campaign.id)}
                        >
                          {campaign.title}
                        </button>
                      </h2>
                      <p className="cwa-offer-summary">{campaign.summary}</p>
                      <div className="cwa-offer-tags">
                        <span>
                          <Users size={14} aria-hidden="true" />
                          {audience(campaign)}
                        </span>
                        <span>
                          <Globe2 size={14} aria-hidden="true" />
                          {campaign.regions.length
                            ? campaign.regions.map(regionName).join(" / ")
                            : copy.global}
                        </span>
                      </div>
                      <div className="cwa-offer-footer">
                        <div>
                          <span>
                            {t("Campaign budget", "캠페인 예산", "活动预算")}
                          </span>
                          <strong>
                            {amount(
                              campaign.budgetAmount,
                              campaign.currency,
                              locale,
                            )}
                          </strong>
                        </div>
                        <button
                          className="cwa-card-action"
                          type="button"
                          aria-label={`${copy.viewBrief}: ${campaign.title}`}
                          onClick={() => setSelectedId(campaign.id)}
                        >
                          <ArrowRight size={20} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="cwa-empty">
              <Search size={34} aria-hidden="true" />
              <h2>
                {campaigns.length
                  ? copy.noOffers
                  : t(
                      "No published campaigns yet",
                      "아직 공개된 캠페인이 없습니다",
                      "暂无已发布活动",
                    )}
              </h2>
              <p>
                {t(
                  "New campaigns appear after the operations team approves them. You can also try clearing the filters.",
                  "운영팀 승인 후 새 캠페인이 표시됩니다. 필터를 적용했다면 초기화해 보세요.",
                  "活动经运营审核后会显示。也可尝试清除筛选条件。",
                )}
              </p>
              <button
                type="button"
                className="cwa-button"
                onClick={() => setFilters(defaultFilters)}
              >
                {copy.reset}
              </button>
            </section>
          )}
        </>
      )}
      {data &&
        section === "projects" &&
        (data.applications.length ? (
          <div className="cwa-application-list">
            {data.applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                locale={locale}
                canManage={canManage}
                busy={busy}
                onMutate={mutate}
              />
            ))}
          </div>
        ) : (
          <section className="cwa-empty">
            <FolderOpen size={34} aria-hidden="true" />
            <h2>
              {t(
                "No applications yet",
                "아직 신청 내역이 없습니다",
                "暂无申请",
              )}
            </h2>
            <p>
              {t(
                "Open a campaign brief and submit a proposal to get started.",
                "캠페인 가이드를 열고 제안서를 제출해 보세요.",
                "打开活动详情并提交提案即可开始。",
              )}
            </p>
            <button
              type="button"
              className="cwa-button cwa-button-primary"
              onClick={onExplore}
            >
              {t("Browse campaigns", "캠페인 둘러보기", "浏览活动")}
            </button>
          </section>
        ))}
      <CampaignDrawer
        campaign={selected}
        locale={locale}
        now={now}
        canManage={canManage}
        busy={busy || loading}
        onClose={() => setSelectedId(null)}
        onMutate={mutate}
      />
    </>
  );
}

function ApplicationCard({
  application,
  locale,
  canManage,
  busy,
  onMutate,
}: {
  application: AgencyApplication;
  locale: Locale;
  canManage: boolean;
  busy: boolean;
  onMutate: (input: Mutation) => Promise<boolean>;
}) {
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  return (
    <article className="cwa-application-card">
      <div className="cwa-live-toolbar">
        <div>
          <span className="cwa-application-status">
            {applicationLabel(application.status, locale)}
          </span>
          <h2>{application.campaignTitle}</h2>
        </div>
        <span>{date(application.createdAt, locale)}</span>
      </div>
      <p className="cwa-pre-line">{application.proposal}</p>
      <dl>
        <div>
          <dt>{t("Proposed amount", "제안 금액", "提案金额")}</dt>
          <dd>
            {amount(application.proposedAmount, application.currency, locale)}
          </dd>
        </div>
        <div>
          <dt>{t("Recruitment", "모집 상태", "招募状态")}</dt>
          <dd>
            {application.campaignStatus === "RECRUITING"
              ? t("Recruiting", "모집 중", "招募中")
              : t(
                  "Closed / not recruiting",
                  "모집 종료 / 비공개",
                  "已结束 / 不在招募",
                )}
          </dd>
        </div>
      </dl>
      <WithdrawAction
        application={application}
        locale={locale}
        canManage={canManage}
        busy={busy}
        onMutate={onMutate}
      />
    </article>
  );
}

function WithdrawAction({
  application,
  locale,
  canManage,
  busy,
  onMutate,
}: {
  application: AgencyApplication;
  locale: Locale;
  canManage: boolean;
  busy: boolean;
  onMutate: (input: Mutation) => Promise<boolean>;
}) {
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  if (!canManage || !["SUBMITTED", "SHORTLISTED"].includes(application.status))
    return null;
  return (
    <div className="cwa-withdraw">
      {error && (
        <p className="cwa-date-error" role="alert">
          {failureText(error, locale)}
        </p>
      )}
      {confirming ? (
        <>
          <p>
            {t(
              "Withdraw this application? You cannot reapply to this campaign.",
              "신청을 철회할까요? 이 캠페인에는 다시 신청할 수 없습니다.",
              "确定撤回？撤回后无法重新申请本活动。",
            )}
          </p>
          <div className="cwa-inline-actions">
            <button
              className="cwa-button"
              type="button"
              disabled={busy}
              onClick={async () => {
                setError("");
                try {
                  if (
                    await onMutate({
                      action: "withdraw",
                      applicationId: application.id,
                    })
                  )
                    setConfirming(false);
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "UNAVAILABLE",
                  );
                }
              }}
            >
              {t("Confirm withdrawal", "철회 확정", "确认撤回")}
            </button>
            <button
              className="cwa-button"
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {t("Keep application", "신청 유지", "保留申请")}
            </button>
          </div>
        </>
      ) : (
        <button
          className="cwa-button"
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          {t("Withdraw application", "신청 철회", "撤回申请")}
        </button>
      )}
    </div>
  );
}

function CampaignDrawer({
  campaign,
  locale,
  now,
  canManage,
  busy,
  onClose,
  onMutate,
}: {
  campaign: AgencyCampaign | null;
  locale: Locale;
  now: number | null;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onMutate: (input: Mutation) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const copy = agencyCopy[locale];
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const id = campaign?.id;
  useEffect(() => {
    const dialog = ref.current;
    if (id && !dialog?.open) dialog?.showModal();
    else if (!id && dialog?.open) dialog.close();
  }, [id]);
  const expired =
    now !== null &&
    Boolean(
      campaign?.applicationDeadline &&
      new Date(campaign.applicationDeadline).getTime() <= now,
    );
  return (
    <dialog
      ref={ref}
      className="cwa-drawer"
      aria-labelledby="agency-offer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      {campaign && (
        <>
          <div className="cwa-drawer-heading">
            <span>
              <FileText size={19} aria-hidden="true" />
              {copy.details}
            </span>
            <button
              type="button"
              className="cwa-icon-button"
              aria-label={copy.close}
              onClick={onClose}
            >
              <X size={22} />
            </button>
          </div>
          <div className="cwa-drawer-content">
            <h2 id="agency-offer-title">{campaign.title}</h2>
            <p className="cwa-drawer-notice">
              {t(
                "Campaign communication is coordinated through the platform. Applying is not a contract or payment.",
                "캠페인 협의는 플랫폼을 통해 진행합니다. 신청은 계약 체결이나 결제가 아닙니다.",
                "活动沟通通过平台进行。申请并非合同或付款。",
              )}
            </p>
            <h3>{copy.overview}</h3>
            <p className="cwa-pre-line">{campaign.summary}</p>
            <h3>{copy.requirements}</h3>
            <dl className="cwa-brief-details">
              <div>
                <dt>{copy.channels}</dt>
                <dd>
                  {campaign.platforms
                    .map((value) => platformLabels[value] ?? value)
                    .join(" / ")}
                </dd>
              </div>
              <div>
                <dt>{copy.target}</dt>
                <dd>{campaign.regions.join(" / ") || copy.global}</dd>
              </div>
              <div>
                <dt>{copy.eligibility}</dt>
                <dd>
                  {campaign.followerMin ?? 0} – {campaign.followerMax ?? "∞"}
                </dd>
              </div>
              <div>
                <dt>{copy.due}</dt>
                <dd>{date(campaign.applicationDeadline, locale)} (UTC)</dd>
              </div>
              <div>
                <dt>{t("Campaign budget", "캠페인 예산", "活动预算")}</dt>
                <dd>
                  {amount(campaign.budgetAmount, campaign.currency, locale)}
                </dd>
              </div>
            </dl>
            <div className="cwa-apply-gate">
              {campaign.application ? (
                <>
                  <p className="cwa-application-status">
                    {applicationLabel(campaign.application.status, locale)}
                  </p>
                  <p className="cwa-pre-line">
                    {campaign.application.proposal}
                  </p>
                  <p>
                    {amount(
                      campaign.application.proposedAmount,
                      campaign.application.currency,
                      locale,
                    )}
                  </p>
                  <WithdrawAction
                    key={campaign.application.id}
                    application={campaign.application}
                    locale={locale}
                    canManage={canManage}
                    busy={busy}
                    onMutate={onMutate}
                  />
                </>
              ) : expired || campaign.status !== "RECRUITING" ? (
                <p>
                  {t(
                    "Applications for this campaign are closed.",
                    "신청이 마감된 캠페인입니다.",
                    "该活动已停止申请。",
                  )}
                </p>
              ) : !canManage ? (
                <p>
                  {t(
                    "Only an approved organization's owner or administrator can apply.",
                    "승인된 조직의 소유자 또는 관리자만 신청할 수 있습니다.",
                    "仅已批准组织的所有者或管理员可申请。",
                  )}
                </p>
              ) : (
                <ProposalForm
                  key={campaign.id}
                  campaign={campaign}
                  locale={locale}
                  busy={busy}
                  onMutate={onMutate}
                />
              )}
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}

function ProposalForm({
  campaign,
  locale,
  busy,
  onMutate,
}: {
  campaign: AgencyCampaign;
  locale: Locale;
  busy: boolean;
  onMutate: (input: Mutation) => Promise<boolean>;
}) {
  const t = (en: string, ko: string, zh: string) =>
    agencyText(locale, en, ko, zh);
  const [proposal, setProposal] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await onMutate({
        action: "apply",
        campaignId: campaign.id,
        proposal: proposal.trim(),
        ...(proposedAmount.trim()
          ? { proposedAmount: proposedAmount.trim() }
          : {}),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "UNAVAILABLE");
    }
  }
  return (
    <form className="cwa-proposal" onSubmit={submit}>
      <h3>{t("Apply to this campaign", "캠페인 신청", "申请活动")}</h3>
      <label className="cwa-live-field">
        <span>{t("Proposal", "제안 내용", "提案内容")} *</span>
        <textarea
          required
          rows={6}
          maxLength={5000}
          value={proposal}
          disabled={busy}
          onChange={(event) => setProposal(event.target.value)}
          placeholder={t(
            "Introduce your proposed creators, channels, deliverables and schedule. Do not include private contact details.",
            "제안할 크리에이터, 채널, 제작물과 일정을 소개하세요. 개인 연락처는 입력하지 마세요.",
            "介绍拟合作达人、频道、内容与安排，请勿填写私人联系方式。",
          )}
        />
      </label>
      <label className="cwa-live-field">
        <span>
          {t(
            "Proposed amount (optional)",
            "제안 금액 (선택)",
            "提案金额（可选）",
          )}{" "}
          · {campaign.currency}
        </span>
        <input
          inputMode="decimal"
          maxLength={19}
          pattern="(?:0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?"
          value={proposedAmount}
          disabled={busy}
          onChange={(event) => setProposedAmount(event.target.value)}
          placeholder="0.00"
        />
      </label>
      <p>
        {t(
          "Your proposal will be stored and shared with the campaign's brand and operations team.",
          "제안서는 저장되며 해당 캠페인의 브랜드와 운영팀에 전달됩니다.",
          "提案将保存并提供给本活动品牌与运营团队。",
        )}
      </p>
      {error && (
        <p className="cwa-date-error" role="alert">
          {failureText(error, locale)}
        </p>
      )}
      <button
        type="submit"
        className="cwa-button cwa-button-primary"
        disabled={busy || !proposal.trim()}
      >
        {busy
          ? t("Submitting…", "처리 중…", "正在提交…")
          : t("Submit application", "신청 제출", "提交申请")}
      </button>
    </form>
  );
}
