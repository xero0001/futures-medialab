"use client";

import { BrandThemeContext, BrandInput, BrandButton } from "./brand-controls";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderHeart,
  Layers,
  LayoutGrid,
  Link2,
  List,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import { LanguageSwitcher } from "../../_components/language-switcher";
import { Wordmark } from "../../_components/brand-logo";
import { BrandSelect as ProfileSelect } from "./brand-controls";
import { authClient } from "../../../lib/auth-client";
import {
  defaultFilters,
  validateFilters,
  type Creator,
  type DirectoryFilters,
  type PlatformId,
  type PublishingPlatform,
  type SearchMode,
} from "../../../lib/creator-directory";
import type { WorkspaceBootstrap } from "../../../lib/workspace-types";
import {
  DirectoryFiltersPanel,
  platformNames,
  tagLabel,
  translate,
} from "./directory-filters";
import { CreatorAvatar } from "./creator-avatar";
import { WorkspaceTools } from "./workspace-tools";
import { TdsCreatorGrid, TdsPlatformIcon } from "./tds-search-parts";
import "./workspace.css";
import "./brand-workspace.css";
import { WorkspaceProvider } from "../../_components/workspace/workspace-provider";
import { WorkspaceShell } from "../../_components/workspace/workspace-shell";
import shellStyles from "../../_components/workspace/workspace-shell.module.css";

const RequestWorkspace = dynamic(() =>
  import("./request-workspace").then((module) => module.RequestWorkspace),
);

export type WorkspaceMode =
  | "search"
  | "similar"
  | "brands"
  | "collect"
  | "links"
  | "campaigns"
  | "requests"
  | "agent"
  | "account";
const routes: Record<WorkspaceMode, string> = {
  search: "/storage/search",
  similar: "/storage/similar-search",
  brands: "/storage/similar-brands",
  collect: "/storage/collect",
  links: "/shortLinks",
  campaigns: "/advertiser/campaign",
  requests: "/advertiser/requests",
  agent: "/agent",
  account: "/advertiser/accountManagement",
};

type CreatorWorkspaceProps = {
  mode: WorkspaceMode;
  initialLocale: Locale;
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
  variant?: "default" | "tds";
};

export function CreatorWorkspace(props: CreatorWorkspaceProps) {
  return (
    <WorkspaceProvider>
      <BrandThemeContext value={props.variant !== "tds"}>
        <WorkspaceContent {...props} />
      </BrandThemeContext>
    </WorkspaceProvider>
  );
}

function WorkspaceContent({
  mode,
  initialLocale: locale,
  organizationName,
  status,
  userName,
  variant = "default",
}: CreatorWorkspaceProps) {
  const isTds = variant === "tds";
  const routeFor = (key: WorkspaceMode) =>
    isTds && key === "search" ? "/storage/search/tds" : routes[key];
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const [data, setData] = useState<WorkspaceBootstrap | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [filters, setFilters] = useState(() => defaultFilters("youtube"));
  const [applied, setApplied] = useState<DirectoryFilters | null>(null);
  const [results, setResults] = useState<Creator[]>([]);
  const [seed, setSeed] = useState<Creator | null>(null);
  const [brandId, setBrandId] = useState("");
  const [publishingPlatform, setPublishingPlatform] =
    useState<PublishingPlatform>("all");
  const [relatedBrands, setRelatedBrands] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(mode === "search" && !isTds);
  const [resultView, setResultView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [collectionId, setCollectionId] = useState("");
  const [detail, setDetail] = useState<Creator | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const requestId = useRef(0);
  const discovery =
    mode === "search" || mode === "similar" || mode === "brands";
  const titles: Record<WorkspaceMode, string> = {
    search: t("Discover creators", "크리에이터 검색", "达人查询"),
    similar: t("Find similar creators", "유사 크리에이터 검색", "相似达人查询"),
    brands: t(
      "Explore related brands",
      "동종 브랜드 크리에이터",
      "同类品牌达人推荐",
    ),
    collect: t("Collections", "즐겨찾기", "收藏夹"),
    links: t("Short links", "단축 링크", "短链服务"),
    campaigns: t("Campaigns", "캠페인 관리", "推广系列管理"),
    requests: t("Request inbox", "요청함", "请求中心"),
    agent: t("Intelligence tools", "분석 도구", "智能工具集"),
    account: t("Account settings", "계정 관리", "账户管理"),
  };

  useEffect(() => {
    if (mode === "requests") return;
    const controller = new AbortController();
    fetch("/api/workspace/bootstrap", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        setData(await response.json());
      })
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError(
            translate(
              locale,
              "Could not load the workspace. Please refresh or sign in again.",
              "작업 공간을 불러오지 못했습니다. 새로고침하거나 다시 로그인해 주세요.",
              "无法加载工作区，请刷新或重新登录。",
            ),
          );
      });
    return () => controller.abort();
  }, [locale, mode]);

  useEffect(() => {
    if (detail) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail]);

  useEffect(() => {
    if (!navOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNavOpen(false);
      navToggleRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);

  async function refreshData() {
    const response = await fetch("/api/workspace/bootstrap", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("refresh");
    setData(await response.json());
  }
  async function onMutate(endpoint: string, body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        setError(
          response.status === 429
            ? t(
                "Too many requests. Try again in a minute.",
                "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
                "请求过多，请稍后重试。",
              )
            : response.status === 403
              ? t(
                  "This action needs an approved account or an administrator.",
                  "승인된 계정 또는 관리자 권한이 필요한 작업입니다.",
                  "此操作需要已批准的账户或管理员权限。",
                )
              : failure?.code === "INVALID_INPUT"
                ? t(
                    "Check the form values and try again.",
                    "입력값을 확인해 주세요.",
                    "请检查输入内容。",
                  )
                : t(
                    "Could not save. Check the values and retry.",
                    "저장하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.",
                    "保存失败，请检查输入后重试。",
                  ),
        );
        return false;
      }
      await refreshData();
      setNotice(
        t(
          "Saved to your workspace.",
          "작업 공간에 저장했습니다.",
          "已保存到工作区。",
        ),
      );
      return true;
    } catch {
      setError(
        t(
          "The request could not be completed. Refresh to check its status before retrying.",
          "요청을 완료하지 못했습니다. 새로고침으로 저장 여부를 확인한 뒤 다시 시도해 주세요.",
          "请求未完成，请刷新确认状态后重试。",
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function search(next = filters, nextBrand = brandId) {
    setNotice("");
    setError("");
    if (!validateFilters(next)) {
      setError(
        t(
          "Use non-negative ranges; minimum must not exceed maximum.",
          "범위는 0 이상으로, 최솟값이 최댓값보다 작거나 같게 입력해 주세요.",
          "范围必须为非负数，且最小值不能大于最大值。",
        ),
      );
      return;
    }
    if (mode === "similar" && !next.query.trim()) {
      setError(
        t(
          "Enter a sample creator name or channel URL.",
          "예시 크리에이터 이름 또는 채널 URL을 입력해 주세요.",
          "请输入示例达人名称或频道链接。",
        ),
      );
      return;
    }
    if (mode === "brands" && !nextBrand) {
      setError(
        t(
          "Select a brand first.",
          "먼저 브랜드를 선택해 주세요.",
          "请先选择品牌。",
        ),
      );
      return;
    }
    const current = ++requestId.current;
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          filters: next,
          ...(nextBrand ? { brandId: nextBrand } : {}),
          publishingPlatform,
        }),
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "rate" : "search");
      const found = await response.json();
      if (current !== requestId.current) return;
      setResults(found.creators);
      setSeed(found.seed);
      setRelatedBrands(
        mode === "brands"
          ? found.brands.map((brand: { name: string }) => brand.name)
          : [],
      );
      setApplied(next);
      setPage(1);
      await refreshData();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message === "rate"
          ? t(
              "Please wait a minute before searching again.",
              "잠시 후 다시 검색해 주세요.",
              "请稍后再次搜索。",
            )
          : t(
              "Search failed. Try again.",
              "검색에 실패했습니다. 다시 시도해 주세요.",
              "搜索失败，请重试。",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  function reset(platform = filters.platform) {
    setFilters(defaultFilters(platform));
    setApplied(null);
    setResults([]);
    setSeed(null);
    setRelatedBrands([]);
    setBrandId("");
    setPublishingPlatform("all");
    setError("");
    setPage(1);
  }
  const baseResults = applied
    ? results
    : mode === "search"
      ? (data?.creators.filter(
          (creator) => creator.platform === filters.platform,
        ) ?? [])
      : [];
  const sorted = [...baseResults].sort((a, b) =>
    sort === "followers"
      ? b.followers - a.followers
      : sort === "views"
        ? b[
            (applied ?? filters).viewsWindow === "last10"
              ? "views10"
              : "views30"
          ] -
          a[
            (applied ?? filters).viewsWindow === "last10"
              ? "views10"
              : "views30"
          ]
        : sort === "engagement"
          ? b.engagement - a.engagement
          : 0,
  );
  const pageSize = isTds && resultView === "cards" ? 6 : 8;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const activeCollection =
    data?.collections.find((collection) => collection.id === collectionId) ??
    data?.collections[0];
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const sample = data?.creators.find(
    (creator) => creator.platform === filters.platform,
  );
  async function saveCreator(creator: Creator) {
    if (!activeCollection) {
      setError(
        t(
          "Create a collection in Collections first.",
          "먼저 즐겨찾기 메뉴에서 폴더를 만들어 주세요.",
          "请先在收藏夹中创建文件夹。",
        ),
      );
      return;
    }
    await onMutate("/api/workspace/collections", {
      action: activeCollection.creatorIds.includes(creator.id)
        ? "remove"
        : "add",
      collectionId: activeCollection.id,
      creatorId: creator.id,
    });
  }
  async function signOut() {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("logout");
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setError(
        t(
          "Could not sign out. Try again.",
          "로그아웃하지 못했습니다. 다시 시도해 주세요.",
          "退出失败，请重试。",
        ),
      );
      setBusy(false);
    }
  }
  const navItems = [
    { key: "search", icon: Search },
    { key: "similar", icon: Users },
    { key: "brands", icon: Layers },
    { key: "agent", icon: Sparkles },
    { key: "collect", icon: FolderHeart },
    { key: "links", icon: Link2 },
    { key: "campaigns", icon: Compass },
    { key: "requests", icon: MessageSquareText },
    { key: "account", icon: Users },
  ] as const;
  const navGroups = [
    {
      label: t("Discover", "크리에이터 탐색", "达人探索"),
      items: navItems.slice(0, 3),
    },
    {
      label: t("My tools", "나의 도구", "我的工具"),
      items: navItems.slice(3, 6),
    },
    {
      label: t("Workspace", "워크스페이스", "工作区"),
      items: navItems.slice(6),
    },
  ];
  const renderNavItem = (
    { key, icon: Icon }: (typeof navItems)[number],
    index: number,
  ) => (
    <Link
      key={key}
      href={`${routeFor(key)}?lang=${locale}`}
      onClick={() => setNavOpen(false)}
      aria-current={mode === key ? "page" : undefined}
      className={`cw-nav-item ${mode === key ? "is-active" : ""} ${!isTds && index === 3 ? "cw-nav-divider" : ""}`}
    >
      {isTds ? (
        <>
          <span className="tds-nav-icon">
            <Icon size={19} aria-hidden="true" />
          </span>
          <span className="tds-nav-text">{titles[key]}</span>
        </>
      ) : (
        <>
          <Icon size={19} />
          {titles[key]}
        </>
      )}
    </Link>
  );

  return (
    <div
      className={`cw-workspace${isTds ? " cw-tds" : ` cw-montage ${shellStyles.workspace}`}`}
      data-creator-workspace="demo"
      lang={locale === "zh" ? "zh-CN" : locale}
    >
      {isTds ? (
        <>
          <header className="cw-topbar">
            <button
              ref={navToggleRef}
              type="button"
              className="cw-icon-button cw-mobile-menu"
              aria-label={
                navOpen
                  ? t("Close navigation", "메뉴 닫기", "关闭导航")
                  : t("Open navigation", "메뉴 열기", "打开导航")
              }
              aria-expanded={navOpen}
              aria-controls="workspace-sidebar"
              onClick={() => setNavOpen(!navOpen)}
            >
              {isTds && navOpen ? (
                <X size={22} aria-hidden="true" />
              ) : (
                <Menu size={22} aria-hidden="true" />
              )}
            </button>
            {isTds ? (
              <div className="tds-brand-area">
                <Wordmark href={`/?lang=${locale}`} />
                <span className="tds-header-divider" aria-hidden="true" />
                <span className="tds-header-label">
                  {t("Workspace", "워크스페이스", "工作区")}
                </span>
              </div>
            ) : (
              <Wordmark href={`/?lang=${locale}`} />
            )}
            <div className="cw-top-actions">
              {!isTds && (
                <span className="cw-status">
                  {status === "PENDING"
                    ? t("Approval pending", "승인 대기", "待审核")
                    : t("Brand workspace", "브랜드 작업 공간", "品牌工作区")}
                </span>
              )}
              <LanguageSwitcher
                locale={locale}
                label={t("Language", "언어", "语言")}
                onChange={(next) => {
                  document.cookie = `fm-locale=${next};path=/;max-age=31536000;SameSite=Lax`;
                  window.location.assign(`${routeFor(mode)}?lang=${next}`);
                }}
              />
              <Link
                href={`/advertiser/accountManagement?lang=${locale}`}
                className={isTds ? "tds-account-link" : "cw-avatar"}
                aria-label={t("Account settings", "계정 관리", "账户管理")}
              >
                {isTds ? (
                  <span className="cw-avatar" aria-hidden="true">
                    <UserRound size={20} />
                  </span>
                ) : (
                  userName.slice(0, 2).toUpperCase()
                )}
              </Link>
            </div>
          </header>
          {navOpen && (
            <button
              type="button"
              className="cw-sidebar-backdrop"
              tabIndex={-1}
              aria-label={t("Close navigation", "메뉴 닫기", "关闭导航")}
              onClick={() => {
                setNavOpen(false);
                navToggleRef.current?.focus();
              }}
            />
          )}
          <aside
            id="workspace-sidebar"
            className={`cw-sidebar ${navOpen ? "is-open" : ""}`}
          >
            {!isTds && (
              <div className="cw-nav-group">
                {t("Creator intelligence", "크리에이터 탐색", "达人资源")}
              </div>
            )}
            <nav
              aria-label={t(
                "Workspace navigation",
                "작업 공간 메뉴",
                "工作区导航",
              )}
            >
              {isTds
                ? navGroups.map((group) => (
                    <div className="tds-nav-section" key={group.label}>
                      <h2 className="cw-nav-group">{group.label}</h2>
                      {group.items.map(renderNavItem)}
                    </div>
                  ))
                : navItems.map(renderNavItem)}
            </nav>
            <div
              className={`cw-sidebar-foot${isTds ? " tds-sidebar-foot" : ""}`}
            >
              {!isTds && (
                <>
                  <strong>{organizationName}</strong>
                  <span>{t("Brand account", "브랜드 계정", "品牌账户")}</span>
                </>
              )}
              <button className="cw-nav-item" onClick={signOut} disabled={busy}>
                <LogOut size={18} />
                {t("Sign out", "로그아웃", "退出登录")}
              </button>
            </div>
          </aside>
        </>
      ) : (
        <WorkspaceShell
          locale={locale}
          organizationName={organizationName}
          userName={userName}
          isGuest={false}
          busy={busy}
          onSignOut={() => void signOut()}
        />
      )}
      <main
        id="workspace-main"
        className={`cw-main${isTds ? "" : ` ${shellStyles.main}`}`}
      >
        <div className={isTds ? undefined : shellStyles.content}>
          <div className="cw-heading">
            <div>
              <p>
                {isTds
                  ? t(
                      "Workspace / Creator discovery",
                      "워크스페이스 / 크리에이터 탐색",
                      "工作区 / 达人探索",
                    )
                  : t("Brand workspace", "브랜드 워크스페이스", "品牌工作区")}
              </p>
              <h1>
                {isTds
                  ? t(
                      "Find your next creator",
                      "크리에이터를 찾아보세요",
                      "发现下一位合作达人",
                    )
                  : titles[mode]}
              </h1>
              {isTds && (
                <p className="tds-heading-description">
                  {t(
                    "Discover creators who are the right fit for your brand.",
                    "우리 브랜드와 잘 맞는 크리에이터, 데이터로 발견해 보세요.",
                    "用数据发现与品牌契合的达人。",
                  )}
                </p>
              )}
            </div>
            {isTds ? (
              <Link
                className="tds-original-link"
                href={`/storage/search?lang=${locale}`}
              >
                {t("Original view", "기존 화면 보기", "查看原版")}
                <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
          {error && (
            <div className="cw-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="cw-success" role="status">
              {notice}
            </div>
          )}
          {mode === "requests" ? (
            <RequestWorkspace locale={locale} />
          ) : !data ? (
            <div className="cw-panel cw-loading" role="status">
              {error
                ? t(
                    "Workspace unavailable",
                    "작업 공간을 불러올 수 없습니다",
                    "工作区不可用",
                  )
                : t(
                    "Loading your workspace…",
                    "작업 공간을 불러오는 중…",
                    "正在加载工作区…",
                  )}
            </div>
          ) : discovery ? (
            <>
              <div className="cw-demo-notice">
                <Sparkles size={19} />
                <span>
                  {isTds
                    ? t(
                        "Demo directory · Profiles and metrics are fictional. Searches and collections are saved.",
                        "데모 디렉터리 · 프로필과 지표는 예시이며, 검색 이력과 즐겨찾기는 저장돼요.",
                        "演示目录 · 达人和指标为虚构数据，搜索记录和收藏会保存。",
                      )
                    : t(
                        "Demo directory · Metrics are sample data. Search history and saved creators are retained.",
                        "데모 디렉터리 · 지표는 예시 데이터입니다. 검색 이력과 저장한 크리에이터는 유지됩니다.",
                        "演示目录 · 指标为示例数据。搜索记录和收藏会保存。",
                      )}
                </span>
              </div>
              <section
                className={`cw-panel${isTds ? " tds-search-panel" : ""}`}
                aria-label={titles[mode]}
              >
                <div
                  className="cw-platforms"
                  aria-label={t("Platform", "플랫폼", "平台")}
                >
                  {(mode === "brands"
                    ? ["youtube"]
                    : mode === "similar"
                      ? ["youtube", "tiktok"]
                      : Object.keys(platformNames)
                  ).map((platform) => (
                    <button
                      key={platform}
                      disabled={busy}
                      type="button"
                      aria-pressed={filters.platform === platform}
                      className={
                        filters.platform === platform ? "is-active" : ""
                      }
                      onClick={() => reset(platform as PlatformId)}
                    >
                      <span
                        className={`cw-platform-icon cw-platform-${platform}`}
                      >
                        <TdsPlatformIcon platform={platform as PlatformId} />
                      </span>
                      {platformNames[platform as PlatformId]}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  {mode === "search" && (
                    <div className="cw-search-modes">
                      {(
                        [
                          [
                            "creator",
                            t(
                              "Creator / channel",
                              "이름 / 채널",
                              "达人 / 频道",
                            ),
                          ],
                          ["content", t("Content", "콘텐츠", "内容")],
                          ["bio", t("Biography", "소개", "简介")],
                          [
                            "brand",
                            t("Brand mentions", "브랜드 언급", "品牌名称"),
                          ],
                        ] as [SearchMode, string][]
                      ).map(([key, label]) => (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={filters.searchMode === key}
                          className={
                            filters.searchMode === key ? "is-active" : ""
                          }
                          onClick={() =>
                            setFilters({ ...filters, searchMode: key })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {mode !== "search" && (
                    <p className="cw-intro">
                      {mode === "similar"
                        ? t(
                            "Start with a creator you like. Find channels with related topics and audiences in this directory.",
                            "기준 크리에이터를 선택해 비슷한 주제의 채널을 찾아보세요.",
                            "以喜欢的达人为起点，寻找目录中主题相近的频道。",
                          )
                        : t(
                            "Explore creators associated with similar brands. Recommendations use shared sample tags, not AI or live campaign data.",
                            "유사한 브랜드와 관련된 크리에이터를 살펴보세요. 예시 태그 기반 추천이며 AI·실시간 캠페인 분석은 아닙니다.",
                            "发现同类品牌相关达人。推荐基于示例标签，并非AI或实时推广分析。",
                          )}
                    </p>
                  )}
                  <div className="cw-search-row">
                    {mode === "brands" ? (
                      <ProfileSelect
                        id="brand-search"
                        label={t(
                          "Brand / product",
                          "브랜드 / 제품",
                          "品牌 / 产品",
                        )}
                        placeholder={t(
                          "Select a sample brand",
                          "예시 브랜드 선택",
                          "选择示例品牌",
                        )}
                        value={brandId}
                        onChange={setBrandId}
                        options={data.brands.map((brand) => ({
                          value: brand.id,
                          label: brand.name,
                        }))}
                      />
                    ) : (
                      <label className="cw-search-input">
                        <Search size={20} />
                        <BrandInput
                          aria-label={
                            mode === "similar"
                              ? t(
                                  "Creator name or channel URL",
                                  "크리에이터 이름 또는 채널 URL",
                                  "达人名称或频道链接",
                                )
                              : t(
                                  "Search creators",
                                  "크리에이터 검색",
                                  "搜索达人",
                                )
                          }
                          value={filters.query}
                          maxLength={500}
                          onChange={(e) =>
                            setFilters({ ...filters, query: e.target.value })
                          }
                          placeholder={
                            mode === "similar"
                              ? t(
                                  "Paste a sample channel URL or enter its name",
                                  "예시 채널 URL 또는 이름 입력",
                                  "输入示例频道链接或名称",
                                )
                              : t(
                                  "Search a name, channel or keyword…",
                                  "이름, 채널 또는 키워드 검색…",
                                  "搜索名称、频道或关键词…",
                                )
                          }
                        />
                      </label>
                    )}
                    <BrandButton
                      className="cw-button cw-button-primary"
                      disabled={busy}
                      type="submit"
                    >
                      <Search size={18} />
                      {busy
                        ? t("Searching…", "검색 중…", "搜索中…")
                        : mode === "brands"
                          ? t("Recommend", "추천 보기", "查看推荐")
                          : t("Search", "검색", "搜索")}
                    </BrandButton>
                    <BrandButton
                      type="button"
                      className="cw-button"
                      disabled={busy}
                      onClick={() => reset()}
                    >
                      {t("Reset", "초기화", "重置")}
                    </BrandButton>
                  </div>
                  {mode === "similar" && sample && (
                    <p className="cw-example">
                      {t(
                        "Try a stored example:",
                        "저장된 예시로 시작:",
                        "尝试已保存示例：",
                      )}{" "}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = {
                            ...filters,
                            query: sample.profileUrl,
                          };
                          setFilters(next);
                          void search(next);
                        }}
                      >
                        {sample.name}
                      </button>
                    </p>
                  )}
                  <div className="cw-filter-toggle">
                    {isTds && (
                      <div
                        className="tds-quick-filters"
                        aria-label={t("Quick filters", "빠른 필터", "快速筛选")}
                      >
                        {[
                          {
                            label: t("South Korea", "대한민국", "韩国"),
                            active: filters.country === "KR",
                            next: {
                              ...filters,
                              country: filters.country === "KR" ? "" : "KR",
                            },
                          },
                          {
                            label: t("Gaming", "게임", "游戏"),
                            active: filters.includeTags.includes("gaming"),
                            next: {
                              ...filters,
                              includeTags: filters.includeTags.includes(
                                "gaming",
                              )
                                ? filters.includeTags.filter(
                                    (tag) => tag !== "gaming",
                                  )
                                : [...filters.includeTags, "gaming"],
                            },
                          },
                          {
                            label: t(
                              "100K+ followers",
                              "팔로워 10만 이상",
                              "粉丝10万以上",
                            ),
                            active: filters.followersMin === "100",
                            next: {
                              ...filters,
                              followersMin:
                                filters.followersMin === "100" ? "" : "100",
                            },
                          },
                          {
                            label: t(
                              "Posted this week",
                              "최근 7일 내 게시",
                              "近7天发布",
                            ),
                            active: filters.lastPosted === "7",
                            next: {
                              ...filters,
                              lastPosted:
                                filters.lastPosted === "7"
                                  ? ("" as const)
                                  : ("7" as const),
                            },
                          },
                        ].map(({ label, active, next }) => (
                          <button
                            type="button"
                            key={label}
                            aria-pressed={active}
                            disabled={busy}
                            onClick={() => {
                              setFilters(next);
                              void search(next);
                            }}
                          >
                            {active && <Check size={14} />}
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <BrandButton
                      className="cw-button"
                      type="button"
                      aria-expanded={expanded}
                      aria-controls="directory-filters"
                      onClick={() => setExpanded(!expanded)}
                    >
                      <SlidersHorizontal size={17} />
                      {isTds
                        ? t("All filters", "상세 필터", "更多筛选")
                        : t("Search filters", "검색 필터", "搜索筛选")}
                      {expanded ? " −" : " +"}
                    </BrandButton>
                    {!isTds && (
                      <span className="cw-muted">
                        {t(
                          "Numeric ranges use K (1,000).",
                          "숫자 범위 단위 K = 1,000",
                          "数值范围单位 K = 1,000。",
                        )}
                      </span>
                    )}
                  </div>
                  {expanded && (
                    <div id="directory-filters">
                      <DirectoryFiltersPanel
                        filters={filters}
                        setFilters={setFilters}
                        locale={locale}
                        compact={mode !== "search"}
                      />
                      {isTds && (
                        <div className="tds-filter-actions">
                          <span className="cw-muted">
                            {t(
                              "Numeric ranges use K (1,000).",
                              "숫자 범위 단위 K = 1,000",
                              "数值范围单位 K = 1,000。",
                            )}
                          </span>
                          <BrandButton
                            className="cw-button cw-button-primary"
                            type="submit"
                            disabled={busy}
                          >
                            {t("Apply filters", "필터 적용하기", "应用筛选")}
                          </BrandButton>
                        </div>
                      )}
                      {mode === "brands" && (
                        <div className="cw-publishing">
                          <ProfileSelect
                            id="publishing-platform"
                            label={t(
                              "Publishing platform",
                              "게임 출시 플랫폼",
                              "发行平台",
                            )}
                            placeholder={t("All platforms", "전체", "全部")}
                            value={publishingPlatform}
                            onChange={(value) =>
                              setPublishingPlatform(value as PublishingPlatform)
                            }
                            options={[
                              {
                                value: "all",
                                label: t("All platforms", "전체", "全部"),
                              },
                              {
                                value: "mobile",
                                label: t("Mobile games", "모바일 게임", "手游"),
                              },
                              {
                                value: "pc",
                                label: t("PC games", "PC 게임", "端游"),
                              },
                              {
                                value: "console",
                                label: t(
                                  "Console games",
                                  "콘솔 게임",
                                  "主机游戏",
                                ),
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </section>
              {seed && (
                <div className="cw-seed">
                  <Users size={20} />
                  <span>
                    {t("Similar to", "기준 크리에이터", "相似于")}{" "}
                    <strong>{seed.name}</strong>
                  </span>
                </div>
              )}
              {!!relatedBrands.length && (
                <div className="cw-brand-chips">
                  {relatedBrands.map((name) => (
                    <span className="cw-tag" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <section className="cw-panel cw-results">
                <div className="cw-toolbar">
                  <h2>
                    {t("Creators", "크리에이터", "达人列表")}{" "}
                    <span>{sorted.length}</span>
                  </h2>
                  <div className="cw-toolbar-controls">
                    <ProfileSelect
                      id="collection-target"
                      label={t("Save to collection", "저장할 폴더", "收藏至")}
                      placeholder={t(
                        "Create a collection first",
                        "먼저 폴더를 만드세요",
                        "请先创建收藏夹",
                      )}
                      value={activeCollection?.id ?? ""}
                      onChange={setCollectionId}
                      options={data.collections.map((collection) => ({
                        value: collection.id,
                        label: collection.name,
                      }))}
                    />
                    <ProfileSelect
                      id="creator-sort"
                      label={t("Sort by", "정렬", "排序")}
                      placeholder=""
                      value={sort}
                      onChange={(value) => {
                        setSort(value);
                        setPage(1);
                      }}
                      options={[
                        {
                          value: "relevance",
                          label: t("Recommended", "추천순", "推荐排序"),
                        },
                        {
                          value: "followers",
                          label: t("Most followers", "팔로워순", "粉丝数"),
                        },
                        {
                          value: "views",
                          label: t("Most views", "조회수순", "播放量"),
                        },
                        {
                          value: "engagement",
                          label: t("Engagement", "참여율순", "互动率"),
                        },
                      ]}
                    />
                    {isTds && (
                      <div
                        className="tds-view-toggle"
                        aria-label={t(
                          "Results layout",
                          "결과 보기 방식",
                          "结果视图",
                        )}
                      >
                        {(
                          [
                            [
                              "cards",
                              LayoutGrid,
                              t("Card view", "카드 보기", "卡片视图"),
                            ],
                            [
                              "list",
                              List,
                              t("List view", "목록 보기", "列表视图"),
                            ],
                          ] as const
                        ).map(([view, Icon, label]) => (
                          <button
                            type="button"
                            key={view}
                            aria-label={label}
                            aria-pressed={resultView === view}
                            onClick={() => {
                              setResultView(view);
                              setPage(1);
                            }}
                          >
                            <Icon size={18} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {sorted.length ? (
                  <>
                    {isTds && resultView === "cards" ? (
                      <TdsCreatorGrid
                        creators={sorted.slice(
                          (page - 1) * pageSize,
                          page * pageSize,
                        )}
                        locale={locale}
                        viewsWindow={(applied ?? filters).viewsWindow}
                        savedIds={activeCollection?.creatorIds ?? []}
                        busy={busy}
                        onDetail={setDetail}
                        onSave={(creator) => void saveCreator(creator)}
                      />
                    ) : (
                      <div className="cw-table-wrap">
                        <table className="cw-table">
                          <thead>
                            <tr>
                              {[
                                t("Creator", "크리에이터", "达人"),
                                t("Followers", "팔로워", "粉丝数"),
                                t("Average views", "평균 조회수", "平均播放量"),
                                t("Topics", "주제", "主题"),
                                t("Engagement", "참여율", "互动率"),
                                t("Last posted", "최근 게시", "最近发布"),
                                t("Save", "저장", "收藏"),
                              ].map((heading) => (
                                <th key={heading} scope="col">
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted
                              .slice((page - 1) * pageSize, page * pageSize)
                              .map((creator) => (
                                <tr key={creator.id}>
                                  <td>
                                    <button
                                      className="cw-person"
                                      onClick={() => setDetail(creator)}
                                    >
                                      <CreatorAvatar
                                        name={creator.name}
                                        avatarUrl={creator.avatarUrl}
                                        size={44}
                                        className="cw-avatar-small"
                                      />
                                      <span>
                                        <strong>{creator.name}</strong>
                                        <span className="cw-muted">
                                          {creator.country} ·{" "}
                                          {creator.language.toUpperCase()} ·{" "}
                                          {platformNames[creator.platform]}
                                        </span>
                                      </span>
                                    </button>
                                  </td>
                                  <td className="cw-metric">
                                    {number(creator.followers)}
                                  </td>
                                  <td>
                                    <strong>
                                      {number(
                                        creator[
                                          (applied ?? filters).viewsWindow ===
                                          "last10"
                                            ? "views10"
                                            : "views30"
                                        ],
                                      )}
                                    </strong>
                                    <span className="cw-muted">
                                      {(applied ?? filters).viewsWindow ===
                                      "last10"
                                        ? t(
                                            "Last 10 posts",
                                            "최근 10개",
                                            "最近10条",
                                          )
                                        : t(
                                            "Last 30 days",
                                            "최근 30일",
                                            "最近30天",
                                          )}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="cw-tags">
                                      {creator.tags.slice(0, 2).map((tag) => (
                                        <span className="cw-tag" key={tag}>
                                          {tagLabel(tag, locale)}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td>{creator.engagement.toFixed(1)}%</td>
                                  <td>
                                    {t(
                                      `${creator.daysSincePosted} ${creator.daysSincePosted === 1 ? "day" : "days"} ago`,
                                      `${creator.daysSincePosted}일 전`,
                                      `${creator.daysSincePosted}天前`,
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      className="cw-icon-button"
                                      disabled={busy}
                                      aria-label={`${activeCollection?.creatorIds.includes(creator.id) ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
                                      aria-pressed={
                                        activeCollection?.creatorIds.includes(
                                          creator.id,
                                        ) ?? false
                                      }
                                      onClick={() => void saveCreator(creator)}
                                    >
                                      <Bookmark
                                        size={20}
                                        fill={
                                          activeCollection?.creatorIds.includes(
                                            creator.id,
                                          )
                                            ? "currentColor"
                                            : "none"
                                        }
                                      />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="cw-pagination">
                      <span>
                        {t(
                          `${sorted.length} sample profiles`,
                          `예시 프로필 ${sorted.length}개`,
                          `${sorted.length}个示例达人`,
                        )}
                      </span>
                      <div>
                        <button
                          className="cw-icon-button"
                          disabled={page === 1}
                          aria-label={t(
                            "Previous page",
                            "이전 페이지",
                            "上一页",
                          )}
                          onClick={() => setPage(page - 1)}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span>
                          {page} / {pages}
                        </span>
                        <button
                          className="cw-icon-button"
                          disabled={page === pages}
                          aria-label={t("Next page", "다음 페이지", "下一页")}
                          onClick={() => setPage(page + 1)}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="cw-empty">
                    <Search size={36} />
                    <h3>
                      {!applied && mode !== "search"
                        ? t(
                            "Start your discovery",
                            "새로운 크리에이터를 찾아보세요",
                            "开始探索",
                          )
                        : t(
                            "No matching creators",
                            "일치하는 크리에이터가 없습니다",
                            "没有符合条件的达人",
                          )}
                    </h3>
                    <p>
                      {mode === "similar"
                        ? t(
                            "Use a stored sample channel. External URLs cannot be fetched until a data provider is connected.",
                            "저장된 예시 채널을 사용해 주세요. 데이터 공급원 연결 전에는 외부 URL을 조회할 수 없습니다.",
                            "请使用已保存的示例频道。接入数据服务前无法读取外部链接。",
                          )
                        : t(
                            "Choose a sample brand or adjust your search filters.",
                            "예시 브랜드를 선택하거나 검색 조건을 조정해 주세요.",
                            "请选择示例品牌或调整筛选条件。",
                          )}
                    </p>
                    {isTds && (
                      <BrandButton
                        type="button"
                        className="cw-button cw-button-primary tds-empty-reset"
                        disabled={busy}
                        onClick={() => reset()}
                      >
                        {t("Clear filters", "검색 조건 초기화", "重置筛选")}
                      </BrandButton>
                    )}
                  </div>
                )}
              </section>
              {!!data.recentSearches.length && (
                <section className="cw-history">
                  <h2>{t("Recent searches", "최근 검색", "最近搜索")}</h2>
                  <div>
                    {data.recentSearches.slice(0, 5).map((item) => (
                      <span key={item.id}>
                        {item.query ||
                          (item.mode === "brands"
                            ? t(
                                "Related brand search",
                                "동종 브랜드 검색",
                                "同类品牌搜索",
                              )
                            : t(
                                "Filtered creator search",
                                "크리에이터 조건 검색",
                                "达人筛选搜索",
                              ))}{" "}
                        <time>
                          {new Date(item.createdAt).toLocaleDateString(locale)}
                        </time>
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <WorkspaceTools
              mode={mode}
              locale={locale}
              data={data}
              onMutate={onMutate}
              busy={busy}
            />
          )}
        </div>
      </main>
      <dialog
        ref={dialogRef}
        className="cw-modal"
        aria-labelledby="creator-profile-title"
        onClose={() => setDetail(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <>
            <button
              className="cw-icon-button cw-modal-close"
              aria-label={t("Close", "닫기", "关闭")}
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <span className="cw-status">
              {t("Demo metrics", "데모 지표", "演示指标")}
            </span>
            <h2 id="creator-profile-title">{detail.name}</h2>
            <p>
              {detail.handle} · {detail.country} ·{" "}
              {platformNames[detail.platform]}
            </p>
            <div className="cw-profile-stats">
              <div>
                <strong>{number(detail.followers)}</strong>
                {t("Followers", "팔로워", "粉丝数")}
              </div>
              <div>
                <strong>{number(detail.views10)}</strong>
                {t("Average views", "평균 조회수", "平均播放量")}
              </div>
              <div>
                <strong>{detail.engagement}%</strong>
                {t("Engagement", "참여율", "互动率")}
              </div>
            </div>
            <p>
              {t(
                "Sample topics and posts below are illustrative, not live channel activity.",
                "아래 주제와 게시물은 예시이며 실제 채널 활동이 아닙니다.",
                "以下主题和内容仅为示例，并非实时频道数据。",
              )}
            </p>
            <div className="cw-tags">
              {detail.tags.map((tag) => (
                <span key={tag} className="cw-tag">
                  {tagLabel(tag, locale)}
                </span>
              ))}
            </div>
            <ul>
              {detail.content.map((content) => (
                <li key={content}>{content}</li>
              ))}
            </ul>
            <BrandButton
              className="cw-button cw-button-primary"
              disabled={busy}
              onClick={() => void saveCreator(detail)}
            >
              <Bookmark size={18} />
              {activeCollection?.creatorIds.includes(detail.id)
                ? t("Remove from collection", "폴더에서 해제", "取消收藏")
                : t("Save to collection", "폴더에 저장", "添加收藏")}
            </BrandButton>
          </>
        )}
      </dialog>
    </div>
  );
}
