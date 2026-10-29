"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ActionButton,
  Avatar,
  Badge,
  Chip,
  Icon as SeedIcon,
  Menu as SeedMenu,
  PrefixIcon,
  RadioGroup,
  SideNavigation,
  Skeleton,
  SuffixIcon,
  Tabs,
  TextField,
} from "@seed-design/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  FolderHeart,
  Globe2,
  Info,
  Layers,
  Link2,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Locale } from "../../../_components/landing-copy";
import { Wordmark } from "../../../_components/brand-logo";
import { authClient } from "../../../../lib/auth-client";
import {
  defaultFilters,
  filterCreators,
  validateFilters,
  type Creator,
  type DirectoryFilters,
  type PlatformId,
  type SearchMode,
} from "../../../../lib/creator-directory";
import type {
  SearchWorkspaceData,
  WorkspaceSearchResult,
} from "../../../../lib/workspace-types";
import {
  platformNames,
  tagLabel,
  translate,
} from "../../_components/directory-filters";
import { SeedFilters, SeedSelect } from "./seed-filters";

const platforms = Object.keys(platformNames) as PlatformId[];

export function SeedSearchWorkspace({
  locale,
  status,
  userName,
  isGuest,
}: {
  locale: Locale;
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
  isGuest: boolean;
}) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const [data, setData] = useState<SearchWorkspaceData | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState(() => defaultFilters("youtube"));
  const [applied, setApplied] = useState<DirectoryFilters | null>(null);
  const [results, setResults] = useState<Creator[]>([]);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [collectionId, setCollectionId] = useState("");
  const [detail, setDetail] = useState<Creator | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navRef = useRef<HTMLDialogElement>(null);
  const searchController = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const busy = searching || saving;

  useEffect(() => {
    const controller = new AbortController();
    fetch(isGuest ? "/api/directory/preview" : "/api/workspace/bootstrap", {
      cache: "no-store",
      signal: controller.signal,
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
              "Could not load the workspace. Please try again.",
              "작업 공간을 불러오지 못했습니다. 다시 시도해 주세요.",
              "无法加载工作区，请重试。",
            ),
          );
      });
    return () => controller.abort();
  }, [locale, loadVersion, isGuest]);

  useEffect(() => () => searchController.current?.abort(), []);
  useEffect(() => {
    if (detail) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail]);
  useEffect(() => {
    if (navOpen) navRef.current?.showModal();
    else navRef.current?.close();
  }, [navOpen]);

  async function search(next = filters) {
    setError("");
    setNotice("");
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
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const current = ++requestId.current;
    setSearching(true);
    try {
      if (isGuest) {
        if (!data) throw new Error("search");
        setResults(filterCreators(next, data.creators));
        setApplied({
          ...next,
          includeTags: [...next.includeTags],
          excludeTags: [...next.excludeTags],
        });
        setPage(1);
        return;
      }
      const response = await fetch("/api/workspace/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "search", filters: next }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "rate" : "search");
      const found: WorkspaceSearchResult = await response.json();
      if (current !== requestId.current) return;
      setResults(found.creators);
      setApplied(next);
      setPage(1);
      // Search succeeded even if refreshing the supplementary history fails.
      try {
        const responseData = await fetch("/api/workspace/bootstrap", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (responseData.ok) {
          const refreshed: SearchWorkspaceData = await responseData.json();
          if (current === requestId.current) setData(refreshed);
        }
      } catch {
        // Keep successful results when only the supplementary refresh fails.
      }
    } catch (reason) {
      if (controller.signal.aborted || current !== requestId.current) return;
      setError(
        reason instanceof Error && reason.message === "rate"
          ? t(
              "Please wait a minute before searching again.",
              "요청이 많습니다. 잠시 후 다시 검색해 주세요.",
              "请求过多，请稍后再试。",
            )
          : t(
              "Search could not be completed. Please try again.",
              "검색을 완료하지 못했습니다. 다시 시도해 주세요.",
              "搜索未完成，请重试。",
            ),
      );
    } finally {
      if (current === requestId.current) setSearching(false);
    }
  }

  function reset(platform = filters.platform) {
    searchController.current?.abort();
    requestId.current += 1;
    setSearching(false);
    setFilters(defaultFilters(platform));
    setApplied(null);
    setResults([]);
    setPage(1);
    setError("");
    setNotice("");
  }

  const activeCollection =
    data?.collections.find((item) => item.id === collectionId) ??
    data?.collections[0];
  async function saveCreator(creator: Creator) {
    if (isGuest) {
      window.location.assign(`/login?lang=${locale}`);
      return;
    }
    if (!activeCollection) {
      setError(
        t(
          "Create a folder in Collections before saving a creator.",
          "크리에이터를 저장하려면 먼저 즐겨찾기에서 폴더를 만들어 주세요.",
          "请先在收藏夹中创建文件夹。",
        ),
      );
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const removing = activeCollection.creatorIds.includes(creator.id);
      const response = await fetch("/api/workspace/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: removing ? "remove" : "add",
          collectionId: activeCollection.id,
          creatorId: creator.id,
        }),
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "rate" : "save");
      setData((previous) =>
        previous
          ? {
              ...previous,
              collections: previous.collections.map((collection) =>
                collection.id === activeCollection.id
                  ? {
                      ...collection,
                      creatorIds: removing
                        ? collection.creatorIds.filter(
                            (id) => id !== creator.id,
                          )
                        : [...collection.creatorIds, creator.id],
                    }
                  : collection,
              ),
            }
          : previous,
      );
      setNotice(
        removing
          ? t(
              "Removed from collection.",
              "즐겨찾기에서 해제했습니다.",
              "已取消收藏。",
            )
          : t(
              `Saved to ${activeCollection.name}.`,
              `${activeCollection.name}에 저장했습니다.`,
              `已保存至${activeCollection.name}。`,
            ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "rate"
          ? t(
              "Too many requests. Please try again shortly.",
              "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
              "请求过多，请稍后重试。",
            )
          : t(
              "Could not save. Refresh to check the status before retrying.",
              "저장하지 못했습니다. 새로고침으로 저장 여부를 확인해 주세요.",
              "保存失败，请刷新确认状态后重试。",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    if (isGuest) {
      window.location.assign(`/login?lang=${locale}`);
      return;
    }
    setSaving(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("signout");
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setError(
        t(
          "Could not sign out. Please try again.",
          "로그아웃하지 못했습니다. 다시 시도해 주세요.",
          "退出失败，请重试。",
        ),
      );
      setSaving(false);
    }
  }

  const viewKey =
    (applied ?? filters).viewsWindow === "last10" ? "views10" : "views30";
  const baseResults = applied
    ? results
    : (data?.creators.filter(
        (creator) => creator.platform === filters.platform,
      ) ?? []);
  const sorted = [...baseResults].sort((a, b) =>
    sort === "followers"
      ? b.followers - a.followers
      : sort === "views"
        ? b[viewKey] - a[viewKey]
        : sort === "engagement"
          ? b.engagement - a.engagement
          : 0,
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 8));
  const currentPage = Math.min(page, pages);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const defaults = defaultFilters(filters.platform);
  const filterCount = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "query" &&
      key !== "platform" &&
      key !== "searchMode" &&
      JSON.stringify(value) !==
        JSON.stringify(defaults[key as keyof DirectoryFilters]),
  ).length;
  const changed =
    JSON.stringify(filters) !== JSON.stringify(applied ?? defaults);
  const navItems = [
    {
      href: "/storage/search/seed",
      icon: Search,
      label: t("Discover creators", "크리에이터 검색", "达人查询"),
    },
    {
      href: "/storage/similar-search",
      icon: Users,
      label: t("Similar creators", "유사 크리에이터", "相似达人"),
    },
    {
      href: "/storage/similar-brands",
      icon: Layers,
      label: t("Related brands", "동종 브랜드", "同类品牌"),
    },
    {
      href: "/storage/collect",
      icon: FolderHeart,
      label: t("Collections", "즐겨찾기", "收藏夹"),
    },
    {
      href: "/advertiser/campaign",
      icon: Compass,
      label: t("Campaigns", "캠페인 관리", "推广管理"),
    },
    {
      href: "/advertiser/requests",
      icon: MessageSquareText,
      label: t("Request inbox", "요청함", "请求中心"),
    },
    {
      href: "/agent",
      icon: Sparkles,
      label: t("Intelligence tools", "분석 도구", "智能工具"),
    },
    {
      href: "/shortLinks",
      icon: Link2,
      label: t("Short links", "단축 링크", "短链服务"),
    },
  ];
  function navigation(mobile = false) {
    return (
      <SideNavigation.Provider collapsed={false}>
        <SideNavigation.Root
          tone="transparent"
          className="seed-search-navigation"
          aria-label={t("Workspace navigation", "작업 공간 메뉴", "工作区导航")}
        >
          <SideNavigation.Content>
            {[navItems.slice(0, 4), navItems.slice(4)].map((items, group) => (
              <SideNavigation.Group key={group}>
                <SideNavigation.GroupLabel>
                  {group === 0
                    ? t("Creator discovery", "크리에이터 탐색", "达人探索")
                    : t("Workspace tools", "워크스페이스 도구", "工作区工具")}
                </SideNavigation.GroupLabel>
                {items.map(({ href, icon: Icon, label }) => (
                  <SideNavigation.Item
                    key={href}
                    current={href === "/storage/search/seed"}
                    asChild
                  >
                    <Link
                      href={`${href}?lang=${locale}`}
                      onClick={() => setNavOpen(false)}
                    >
                      <SideNavigation.ItemPrefixIcon svg={<Icon />} />
                      <SideNavigation.ItemLabel>
                        {label}
                      </SideNavigation.ItemLabel>
                    </Link>
                  </SideNavigation.Item>
                ))}
              </SideNavigation.Group>
            ))}
          </SideNavigation.Content>
          <SideNavigation.Footer className="seed-search-sidebar-bottom">
            <SideNavigation.Item asChild>
              <Link href={`/advertiser/accountManagement?lang=${locale}`}>
                <SideNavigation.ItemPrefixIcon svg={<Settings2 />} />
                <SideNavigation.ItemLabel>
                  {t("Account settings", "계정 관리", "账户设置")}
                </SideNavigation.ItemLabel>
              </Link>
            </SideNavigation.Item>
            <ActionButton
              size="small"
              variant="ghost"
              onClick={signOut}
              disabled={busy}
            >
              <PrefixIcon
                svg={isGuest ? <LogIn size={17} /> : <LogOut size={17} />}
              />
              {isGuest
                ? t("Sign in", "로그인", "登录")
                : t("Sign out", "로그아웃", "退出登录")}
            </ActionButton>
          </SideNavigation.Footer>
        </SideNavigation.Root>
        {mobile && (
          <ActionButton
            className="seed-search-nav-close"
            variant="ghost"
            layout="iconOnly"
            aria-label={t("Close menu", "메뉴 닫기", "关闭菜单")}
            onClick={() => setNavOpen(false)}
          >
            <SeedIcon svg={<X size={20} />} />
          </ActionButton>
        )}
      </SideNavigation.Provider>
    );
  }
  function bookmark(creator: Creator) {
    const saved = activeCollection?.creatorIds.includes(creator.id) ?? false;
    return (
      <ActionButton
        variant="ghost"
        size="small"
        layout="iconOnly"
        className={saved ? "seed-search-saved" : ""}
        aria-label={`${saved ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
        aria-pressed={saved}
        disabled={busy}
        onClick={() => void saveCreator(creator)}
      >
        <SeedIcon
          svg={<Bookmark size={20} fill={saved ? "currentColor" : "none"} />}
        />
      </ActionButton>
    );
  }

  return (
    <div
      className="seed-search-workspace"
      data-seed-color-mode="light-only"
      lang={locale === "zh" ? "zh-CN" : locale}
    >
      <a href="#seed-search-main" className="seed-search-skip">
        {t("Skip to search", "검색으로 바로가기", "跳至搜索")}
      </a>
      <header className="seed-search-topbar">
        <div className="seed-search-brand">
          <ActionButton
            className="seed-search-menu"
            variant="ghost"
            layout="iconOnly"
            aria-label={t("Open menu", "메뉴 열기", "打开菜单")}
            aria-expanded={navOpen}
            aria-controls="seed-mobile-nav"
            onClick={() => setNavOpen(true)}
          >
            <SeedIcon svg={<Menu size={22} />} />
          </ActionButton>
          <Wordmark href={`/?lang=${locale}`} />
          <span className="seed-search-brand-divider" />
          <span className="seed-search-product">
            {t("Brand workspace", "브랜드 워크스페이스", "品牌工作区")}
          </span>
        </div>
        <div className="seed-search-top-actions">
          <Badge.Root
            className="seed-search-account-status"
            variant="weak"
            tone={!isGuest && status === "PENDING" ? "warning" : "brand"}
          >
            <Badge.Label>
              {isGuest
                ? t("Guest preview", "게스트 미리보기", "访客预览")
                : status === "PENDING"
                  ? t("Approval pending", "승인 대기", "待审核")
                  : t("Brand account", "브랜드 계정", "品牌账户")}
            </Badge.Label>
          </Badge.Root>
          <SeedMenu.Root placement="bottom-end" gutter={8} size="small">
            <SeedMenu.Trigger asChild>
              <ActionButton
                className="seed-search-language-trigger"
                variant="ghost"
                size="medium"
                aria-label={`${t("Language", "언어", "语言")}: ${locale === "ko" ? "한국어" : locale === "zh" ? "中文" : "English"}`}
              >
                <PrefixIcon svg={<Globe2 />} />
                {locale === "ko" ? "한국어" : locale === "zh" ? "中文" : "EN"}
                <SuffixIcon svg={<ChevronDown />} />
              </ActionButton>
            </SeedMenu.Trigger>
            <SeedMenu.Positioner>
              <SeedMenu.Content
                className="seed-search-language-menu"
                aria-label={t("Language", "언어", "语言")}
              >
                <SeedMenu.ScrollArea>
                  {(
                    [
                      { value: "ko", label: "한국어" },
                      { value: "en", label: "English" },
                      { value: "zh", label: "中文" },
                    ] as const
                  ).map(({ value, label }) => (
                    <SeedMenu.Item
                      key={value}
                      className="seed-search-language-option"
                      data-selected={locale === value ? "" : undefined}
                      aria-label={
                        locale === value
                          ? `${label}, ${t("selected", "선택됨", "已选择")}`
                          : label
                      }
                      lang={value === "zh" ? "zh-CN" : value}
                      onClick={() => {
                        if (value === locale) return;
                        document.cookie = `fm-locale=${value};path=/;max-age=31536000;SameSite=Lax`;
                        window.location.assign(
                          `/storage/search/seed?lang=${value}`,
                        );
                      }}
                    >
                      <SeedMenu.ItemLabel>{label}</SeedMenu.ItemLabel>
                      {locale === value && (
                        <Check size={16} aria-hidden="true" />
                      )}
                    </SeedMenu.Item>
                  ))}
                </SeedMenu.ScrollArea>
              </SeedMenu.Content>
            </SeedMenu.Positioner>
          </SeedMenu.Root>
          <ActionButton
            asChild
            variant="ghost"
            size="medium"
            className="seed-search-user"
          >
            <Link
              href={`${isGuest ? "/login" : "/advertiser/accountManagement"}?lang=${locale}`}
              aria-label={
                isGuest
                  ? t("Sign in", "로그인", "登录")
                  : `${t("Account settings", "계정 관리", "账户设置")}: ${userName}`
              }
            >
              <Avatar.Root size="36" className="seed-search-user-avatar">
                <Avatar.Fallback>
                  {userName.slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              <span className="seed-search-user-name">
                {isGuest ? t("Sign in", "로그인", "登录") : userName}
              </span>
            </Link>
          </ActionButton>
        </div>
      </header>
      <aside className="seed-search-sidebar">{navigation()}</aside>
      <dialog
        id="seed-mobile-nav"
        ref={navRef}
        className="seed-search-mobile-nav"
        aria-label={t("Workspace navigation", "작업 공간 메뉴", "工作区导航")}
        onClose={() => setNavOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setNavOpen(false);
        }}
      >
        {navigation(true)}
      </dialog>
      <main id="seed-search-main" className="seed-search-main">
        <div className="seed-search-breadcrumb">
          <span>{t("Creator discovery", "크리에이터 탐색", "发现达人")}</span>
          <ChevronRight size={14} />
          <span>{t("Search", "검색", "搜索")}</span>
        </div>
        <div className="seed-search-heading">
          <div>
            <h1>
              {t(
                "Find your next creator.",
                "다음 협업의 시작, 크리에이터 검색",
                "发现下一位合作达人",
              )}
            </h1>
            <p>
              {t(
                "Find the right voice for your brand, across every platform.",
                "브랜드와 잘 맞는 크리에이터를, 다양한 플랫폼에서 발견하세요.",
                "跨越平台，找到与品牌契合的创作者。",
              )}
            </p>
          </div>
          <Link
            href={`/storage/search?lang=${locale}`}
            className="seed-search-original"
          >
            <ArrowLeft size={16} />
            {t("Original view", "기존 화면", "原版界面")}
          </Link>
        </div>

        <div className="seed-search-demo">
          <Info size={18} />
          <p>
            <strong>
              {t("Demo workspace", "데모 워크스페이스", "演示工作区")}
            </strong>
            <span>
              {isGuest
                ? t(
                    "Browse and search sample creator data without signing in. Sign in to save creators and search history.",
                    "로그인 없이 샘플 크리에이터를 둘러보고 검색할 수 있어요. 크리에이터와 검색 이력을 저장하려면 로그인해 주세요.",
                    "无需登录即可浏览和搜索示例达人。登录后可保存达人和搜索记录。",
                  )
                : t(
                    "Profiles and metrics are fictional. Search history and collections are saved; live platform data is not connected.",
                    "프로필·지표는 가상 데이터입니다. 검색 이력과 즐겨찾기는 저장되며, 실시간 플랫폼 데이터는 아직 연결되지 않았어요.",
                    "达人和指标均为虚构数据。搜索和收藏将保存，尚未接入实时平台数据。",
                  )}
            </span>
          </p>
          <Badge.Root variant="weak" tone="brand">
            <Badge.Label>DEMO</Badge.Label>
          </Badge.Root>
        </div>
        {error && (
          <div role="alert" className="seed-search-alert">
            <Info size={18} />
            <span>{error}</span>
            {data && (
              <ActionButton
                variant="ghost"
                size="small"
                layout="iconOnly"
                aria-label={t("Dismiss message", "메시지 닫기", "关闭提示")}
                onClick={() => setError("")}
              >
                <SeedIcon svg={<X size={18} />} />
              </ActionButton>
            )}
          </div>
        )}
        {notice && (
          <div role="status" className="seed-search-notice">
            {notice}
          </div>
        )}

        {!data ? (
          <section
            className="seed-search-card seed-search-loading"
            aria-label={t(
              "Loading workspace",
              "작업 공간 불러오는 중",
              "正在加载工作区",
            )}
            aria-busy={!error}
          >
            {error ? (
              <ActionButton
                variant="neutralWeak"
                onClick={() => {
                  setError("");
                  setLoadVersion((value) => value + 1);
                }}
              >
                {t("Try again", "다시 시도", "重试")}
              </ActionButton>
            ) : (
              <>
                <Skeleton width="40%" height="28px" radius="8" />
                <Skeleton width="full" height="52px" radius="8" />
                {[0, 1, 2, 3].map((item) => (
                  <Skeleton key={item} width="full" height="64px" radius="8" />
                ))}
              </>
            )}
          </section>
        ) : (
          <>
            <Tabs.Root
              className="seed-search-card seed-search-discovery"
              value={filters.platform}
              onValueChange={(value) => reset(value as PlatformId)}
              triggerLayout="hug"
              size="medium"
            >
              <Tabs.List
                className="seed-search-platforms"
                aria-label={t("Platform", "플랫폼", "平台")}
              >
                {platforms.map((platform) => (
                  <Tabs.Trigger
                    key={platform}
                    value={platform}
                    disabled={saving}
                  >
                    <span
                      className={`seed-search-platform-icon seed-search-platform-${platform}`}
                      aria-hidden="true"
                    >
                      {platform === "youtube"
                        ? "▶"
                        : platform === "tiktok"
                          ? "♪"
                          : platform === "instagram"
                            ? "◎"
                            : platform === "facebook"
                              ? "f"
                              : platform === "twitch"
                                ? "▧"
                                : "𝕏"}
                    </span>
                    {platformNames[platform]}
                  </Tabs.Trigger>
                ))}
                <Tabs.Indicator />
              </Tabs.List>
              <Tabs.Content
                value={filters.platform}
                className="seed-search-search-content"
              >
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  <Chip.RadioRoot
                    className="seed-search-modes"
                    value={filters.searchMode}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        searchMode: value as SearchMode,
                      })
                    }
                    disabled={busy}
                    aria-label={t("Search by", "검색 대상", "搜索方式")}
                  >
                    {(
                      [
                        [
                          "creator",
                          t("Name / channel", "이름 / 채널", "名称 / 频道"),
                        ],
                        ["content", t("Content", "콘텐츠", "内容")],
                        ["bio", t("Biography", "소개", "简介")],
                        [
                          "brand",
                          t("Brand mentions", "브랜드 언급", "品牌提及"),
                        ],
                      ] as [SearchMode, string][]
                    ).map(([value, label]) => (
                      <Chip.RadioItem
                        key={value}
                        value={value}
                        size="small"
                        variant="solid"
                      >
                        <Chip.Label>{label}</Chip.Label>
                        <RadioGroup.ItemHiddenInput />
                      </Chip.RadioItem>
                    ))}
                  </Chip.RadioRoot>
                  <div className="seed-search-query-row">
                    <TextField.Root className="seed-search-query">
                      <TextField.PrefixIcon svg={<Search />} />
                      <TextField.Input
                        aria-label={t(
                          "Search creators",
                          "크리에이터 검색",
                          "搜索达人",
                        )}
                        placeholder={t(
                          "Search a name, channel or keyword",
                          "이름, 채널 또는 키워드로 검색해 보세요",
                          "输入名称、频道或关键词",
                        )}
                        value={filters.query}
                        maxLength={500}
                        onChange={(event) =>
                          setFilters({ ...filters, query: event.target.value })
                        }
                        disabled={busy}
                      />
                    </TextField.Root>
                    <ActionButton
                      className="seed-search-submit"
                      type="submit"
                      size="large"
                      loading={searching}
                      disabled={busy}
                    >
                      <PrefixIcon svg={<Search size={19} />} />
                      {t("Search", "검색", "搜索")}
                    </ActionButton>
                  </div>
                  <div className="seed-search-filter-toolbar">
                    <ActionButton
                      type="button"
                      variant="neutralWeak"
                      size="small"
                      aria-expanded={expanded}
                      aria-controls="seed-search-filters"
                      onClick={() => setExpanded(!expanded)}
                    >
                      <PrefixIcon svg={<SlidersHorizontal size={17} />} />
                      {t("Filters", "상세 필터", "筛选")}
                      {filterCount > 0 && (
                        <span className="seed-search-filter-count">
                          {filterCount}
                        </span>
                      )}
                      <SuffixIcon
                        svg={
                          <ChevronDown
                            size={16}
                            className={expanded ? "seed-search-rotated" : ""}
                          />
                        }
                      />
                    </ActionButton>
                    <span className="seed-search-filter-hint">
                      {changed
                        ? t(
                            "Press Search to apply your changes",
                            "변경한 조건은 검색을 누르면 적용돼요",
                            "点击搜索以应用更改",
                          )
                        : t(
                            "Narrow by content, channel and audience",
                            "콘텐츠 · 채널 · 시청자 조건으로 좁혀보세요",
                            "按内容、频道和受众筛选",
                          )}
                    </span>
                    <ActionButton
                      type="button"
                      variant="ghost"
                      size="small"
                      disabled={saving}
                      onClick={() => reset()}
                    >
                      <PrefixIcon svg={<RotateCcw size={16} />} />
                      {t("Reset", "초기화", "重置")}
                    </ActionButton>
                  </div>
                  {expanded && (
                    <div id="seed-search-filters">
                      <SeedFilters
                        filters={filters}
                        setFilters={setFilters}
                        locale={locale}
                        disabled={busy}
                      />
                      <div className="seed-search-filter-footer">
                        <span>
                          {t(
                            "Range unit: K = 1,000",
                            "숫자 범위 단위 K = 1,000",
                            "范围单位 K = 1,000",
                          )}
                        </span>
                        <ActionButton
                          type="submit"
                          variant="neutralSolid"
                          size="small"
                          disabled={busy}
                        >
                          {t("Apply filters", "필터 적용", "应用筛选")}
                        </ActionButton>
                      </div>
                    </div>
                  )}
                </form>
              </Tabs.Content>
            </Tabs.Root>

            <section
              className="seed-search-results"
              aria-labelledby="seed-results-title"
              aria-busy={searching}
            >
              <div className="seed-search-results-heading">
                <div>
                  <h2 id="seed-results-title">
                    {t("Creators", "크리에이터", "达人")}{" "}
                    <span>{sorted.length}</span>
                  </h2>
                  <p>
                    {applied
                      ? t(
                          "Results for your applied search",
                          "적용한 조건에 맞는 검색 결과예요",
                          "已应用条件的搜索结果",
                        )
                      : t(
                          `${platformNames[filters.platform]} · Explore sample profiles`,
                          `${platformNames[filters.platform]}의 예시 프로필을 둘러보세요`,
                          `浏览${platformNames[filters.platform]}示例达人`,
                        )}
                  </p>
                </div>
                <div className="seed-search-result-controls">
                  <SeedSelect
                    label={t("Save to folder", "저장할 폴더", "收藏至")}
                    value={activeCollection?.id ?? ""}
                    onChange={setCollectionId}
                    disabled={busy || isGuest}
                    placeholder={isGuest
                      ? t("Sign in to save", "로그인하고 저장", "登录以收藏")
                      : t(
                          "No folders yet",
                          "아직 폴더가 없어요",
                          "尚无文件夹",
                        )}
                    options={data.collections.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                  <SeedSelect
                    label={t("Sort by", "정렬", "排序")}
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
                </div>
              </div>
              {sorted.length ? (
                <div className="seed-search-card seed-search-result-card">
                  <div className="seed-search-table-wrap">
                    <table className="seed-search-table">
                      <thead>
                        <tr>
                          {[
                            t("Creator", "크리에이터", "达人"),
                            t("Followers", "팔로워", "粉丝数"),
                            t("Avg. views", "평균 조회수", "平均播放量"),
                            t("Topics", "주제", "主题"),
                            t("Engagement", "참여율", "互动率"),
                            t("Last posted", "최근 게시", "最近发布"),
                            t("Save", "저장", "收藏"),
                          ].map((label) => (
                            <th key={label} scope="col">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted
                          .slice((currentPage - 1) * 8, currentPage * 8)
                          .map((creator) => (
                            <tr key={creator.id}>
                              <td>
                                <button
                                  className="seed-search-person"
                                  onClick={() => setDetail(creator)}
                                >
                                  <Avatar.Root size="48">
                                    <Avatar.Fallback
                                      style={{
                                        background: creator.accent,
                                        color: "white",
                                      }}
                                    >
                                      {creator.name.slice(0, 1)}
                                    </Avatar.Fallback>
                                  </Avatar.Root>
                                  <span>
                                    <strong>{creator.name}</strong>
                                    <span className="seed-search-person-meta">
                                      {creator.country} ·{" "}
                                      {creator.language.toUpperCase()}
                                      <span> · {creator.handle}</span>
                                    </span>
                                  </span>
                                  <ArrowUpRight size={15} />
                                </button>
                              </td>
                              <td
                                data-label={t("Followers", "팔로워", "粉丝数")}
                              >
                                <strong className="seed-search-metric">
                                  {number(creator.followers)}
                                </strong>
                              </td>
                              <td
                                data-label={t(
                                  "Avg. views",
                                  "평균 조회수",
                                  "播放量",
                                )}
                              >
                                <strong className="seed-search-metric">
                                  {number(creator[viewKey])}
                                </strong>
                                <span className="seed-search-submetric">
                                  {viewKey === "views10"
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
                              <td className="seed-search-topics-cell">
                                <div className="seed-search-tags">
                                  {creator.tags.slice(0, 2).map((tag) => (
                                    <Badge.Root
                                      key={tag}
                                      variant="weak"
                                      tone="neutral"
                                    >
                                      <Badge.Label>
                                        {tagLabel(tag, locale)}
                                      </Badge.Label>
                                    </Badge.Root>
                                  ))}
                                </div>
                              </td>
                              <td
                                data-label={t("Engagement", "참여율", "互动率")}
                              >
                                <strong className="seed-search-engagement">
                                  {creator.engagement.toFixed(1)}%
                                </strong>
                              </td>
                              <td className="seed-search-posted">
                                {t(
                                  `${creator.daysSincePosted}d ago`,
                                  `${creator.daysSincePosted}일 전`,
                                  `${creator.daysSincePosted}天前`,
                                )}
                              </td>
                              <td className="seed-search-bookmark">
                                {bookmark(creator)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="seed-search-pagination">
                    <span>
                      {t(
                        `${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, sorted.length)} of ${sorted.length} sample profiles`,
                        `예시 프로필 ${sorted.length}개 중 ${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, sorted.length)}`,
                        `${sorted.length}个示例中的${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, sorted.length)}`,
                      )}
                    </span>
                    <div>
                      <ActionButton
                        variant="ghost"
                        size="small"
                        layout="iconOnly"
                        aria-label={t("Previous page", "이전 페이지", "上一页")}
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <SeedIcon svg={<ChevronLeft size={18} />} />
                      </ActionButton>
                      {Array.from({ length: pages }, (_, index) => (
                        <ActionButton
                          key={index}
                          variant={
                            currentPage === index + 1 ? "neutralWeak" : "ghost"
                          }
                          className={
                            currentPage === index + 1
                              ? "seed-search-current-page"
                              : ""
                          }
                          size="small"
                          layout="withText"
                          aria-label={t(
                            `Page ${index + 1}`,
                            `${index + 1}페이지`,
                            `第${index + 1}页`,
                          )}
                          aria-current={
                            currentPage === index + 1 ? "page" : undefined
                          }
                          onClick={() => setPage(index + 1)}
                        >
                          {index + 1}
                        </ActionButton>
                      ))}
                      <ActionButton
                        variant="ghost"
                        size="small"
                        layout="iconOnly"
                        aria-label={t("Next page", "다음 페이지", "下一页")}
                        disabled={currentPage === pages}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <SeedIcon svg={<ChevronRight size={18} />} />
                      </ActionButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="seed-search-card seed-search-empty">
                  <div>
                    <Search size={28} />
                  </div>
                  <h3>
                    {t(
                      "No matching creators",
                      "일치하는 크리에이터가 없어요",
                      "没有符合条件的达人",
                    )}
                  </h3>
                  <p>
                    {t(
                      "Try a different keyword or broaden your filters.",
                      "다른 키워드를 입력하거나 검색 조건을 넓혀보세요.",
                      "尝试其他关键词或放宽筛选条件。",
                    )}
                  </p>
                  <ActionButton variant="neutralWeak" onClick={() => reset()}>
                    {t("Clear search", "검색 초기화", "重置搜索")}
                  </ActionButton>
                </div>
              )}
              {!activeCollection && (
                <Link
                  className="seed-search-folder-tip"
                  href={`/storage/collect?lang=${locale}`}
                >
                  <FolderHeart size={17} />
                  {t(
                    "Create a collection to save your next collaborators",
                    "즐겨찾기 폴더를 만들고, 관심 있는 크리에이터를 모아보세요",
                    "创建收藏夹，保存感兴趣的达人",
                  )}
                  <ArrowUpRight size={16} />
                </Link>
              )}
            </section>
            {!!data.recentSearches.length && (
              <section className="seed-search-history">
                <h2>
                  <Clock3 size={17} />
                  {t("Recent searches", "최근 검색", "最近搜索")}
                </h2>
                <div>
                  {data.recentSearches.slice(0, 5).map((item) => (
                    <span key={item.id}>
                      {item.query ||
                        t("Filtered search", "조건 검색", "条件搜索")}
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleDateString(locale)}
                      </time>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <footer className="seed-search-footer">
          <span>FUTURES MEDIALAB</span>
          <span>SEED Design</span>
        </footer>
      </main>
      <dialog
        ref={dialogRef}
        className="seed-search-profile"
        aria-labelledby="seed-profile-title"
        onClose={() => setDetail(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <>
            <div className="seed-search-profile-top">
              <Badge.Root tone="brand" variant="weak">
                <Badge.Label>
                  {t("Fictional profile", "가상 프로필", "虚构达人")}
                </Badge.Label>
              </Badge.Root>
              <ActionButton
                variant="ghost"
                size="small"
                layout="iconOnly"
                aria-label={t("Close profile", "프로필 닫기", "关闭资料")}
                onClick={() => setDetail(null)}
              >
                <SeedIcon svg={<X size={21} />} />
              </ActionButton>
            </div>
            <Avatar.Root size="64">
              <Avatar.Fallback
                style={{ background: detail.accent, color: "white" }}
              >
                {detail.name.slice(0, 1)}
              </Avatar.Fallback>
            </Avatar.Root>
            <h2 id="seed-profile-title">{detail.name}</h2>
            <p>
              {detail.handle} · {detail.country} ·{" "}
              {platformNames[detail.platform]}
            </p>
            <div className="seed-search-profile-stats">
              {[
                [number(detail.followers), t("Followers", "팔로워", "粉丝数")],
                [
                  number(detail[viewKey]),
                  t("Avg. views", "평균 조회수", "播放量"),
                ],
                [`${detail.engagement}%`, t("Engagement", "참여율", "互动率")],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p>{detail.bio}</p>
            <div className="seed-search-tags">
              {detail.tags.map((tag) => (
                <Badge.Root key={tag} tone="neutral" variant="weak">
                  <Badge.Label>{tagLabel(tag, locale)}</Badge.Label>
                </Badge.Root>
              ))}
            </div>
            <h3>{t("Sample content", "콘텐츠 미리보기", "示例内容")}</h3>
            <p className="seed-search-profile-disclaimer">
              {t(
                "Illustrative topics and posts, not live channel activity.",
                "아래 게시물은 예시이며 실제 채널 활동이 아닙니다.",
                "以下内容仅为示例，并非实时频道数据。",
              )}
            </p>
            <ul>
              {detail.content.map((content) => (
                <li key={content}>{content}</li>
              ))}
            </ul>
            {!activeCollection ? (
              <Link
                className="seed-search-folder-tip"
                href={`/storage/collect?lang=${locale}`}
              >
                <FolderHeart size={18} />
                {t(
                  "Create a collection first",
                  "즐겨찾기 폴더 만들기",
                  "创建收藏夹",
                )}
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <ActionButton
                variant="neutralSolid"
                disabled={busy}
                loading={saving}
                onClick={() => void saveCreator(detail)}
              >
                <PrefixIcon svg={<Bookmark size={18} />} />
                {activeCollection.creatorIds.includes(detail.id)
                  ? t("Remove from collection", "폴더에서 해제", "取消收藏")
                  : t("Save to collection", "폴더에 저장", "添加收藏")}
              </ActionButton>
            )}
            {error && (
              <p role="alert" className="seed-search-profile-error">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}
