"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AppProvider,
  Badge,
  Button,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  TabContent,
  TabItem,
  TabItems,
  TabList,
  Tabs,
  Tag,
  TextField,
} from "@channel.io/bezier-react";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderHeart,
  Grid2X2,
  Info,
  LayoutList,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Locale } from "../../../_components/landing-copy";
import { authClient } from "../../../../lib/auth-client";
import {
  defaultFilters,
  validateFilters,
  type Creator,
  type DirectoryFilters,
  type PlatformId,
  type SearchMode,
} from "../../../../lib/creator-directory";
import type {
  WorkspaceBootstrap,
  WorkspaceSearchResult,
} from "../../../../lib/workspace-types";
import {
  platformNames,
  tagLabel,
  translate,
} from "../../_components/directory-filters";
import { BezierFiltersPanel, BezierSelect } from "./bezier-filters";
import { BezierWorkspaceShell } from "./bezier-workspace-shell";
import "@channel.io/bezier-react/styles.css";
import "./bezier-search.css";

const pageSize = 8;

export function BezierSearchWorkspace(props: {
  locale: Locale;
  organizationName: string;
  userName: string;
  status: "PENDING" | "ACTIVE";
}) {
  return (
    <AppProvider themeName="light">
      <SearchWorkspace key={props.locale} {...props} />
    </AppProvider>
  );
}

function SearchWorkspace({
  locale,
  organizationName,
  userName,
  status,
}: {
  locale: Locale;
  organizationName: string;
  userName: string;
  status: "PENDING" | "ACTIVE";
}) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const [data, setData] = useState<WorkspaceBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DirectoryFilters>(() =>
    defaultFilters("youtube"),
  );
  const [applied, setApplied] = useState<DirectoryFilters | null>(null);
  const [results, setResults] = useState<Creator[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [collectionId, setCollectionId] = useState("");
  const [detail, setDetail] = useState<Creator | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);

  async function loadWorkspace(signal?: AbortSignal) {
    const response = await fetch("/api/workspace/bootstrap", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("load");
    const next: WorkspaceBootstrap = await response.json();
    return next;
  }

  useEffect(() => {
    const controller = new AbortController();
    loadWorkspace(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setData(next);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError(
            translate(
              locale,
              "Could not load the workspace. Please try again.",
              "작업 공간을 불러오지 못했어요. 다시 시도해 주세요.",
              "无法加载工作区，请重试。",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      searchController.current?.abort();
    };
  }, [locale]);

  useEffect(() => {
    if (detail) dialogRef.current?.showModal();
    else if (dialogRef.current?.open) {
      dialogRef.current.close();
      detailTrigger.current?.focus();
    }
  }, [detail]);

  function reset(platform = filters.platform) {
    searchController.current?.abort();
    setSearching(false);
    setFilters(defaultFilters(platform));
    setApplied(null);
    setResults([]);
    setError("");
    setNotice("");
    setPage(1);
  }

  async function search(next = filters) {
    setNotice("");
    setError("");
    if (!validateFilters(next)) {
      setExpanded(true);
      setError(
        t(
          "Enter a non-negative range with the minimum no greater than the maximum.",
          "범위는 0 이상으로, 최솟값이 최댓값보다 작거나 같게 입력해 주세요.",
          "范围必须为非负数，且最小值不能大于最大值。",
        ),
      );
      return;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearching(true);
    try {
      const response = await fetch("/api/workspace/search", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "search",
          filters: next,
          publishingPlatform: "all",
        }),
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "rate" : "search");
      const found: WorkspaceSearchResult = await response.json();
      if (controller.signal.aborted) return;
      setResults(found.creators);
      setApplied(next);
      setPage(1);
      // A history refresh failure must not turn a successful search into a failure.
      await loadWorkspace(controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setData(next);
        })
        .catch(() => undefined);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(
        reason instanceof Error && reason.message === "rate"
          ? t(
              "Please wait a minute before searching again.",
              "요청이 많아요. 잠시 후 다시 검색해 주세요.",
              "请稍后再次搜索。",
            )
          : t(
              "Search failed. Please try again.",
              "검색하지 못했어요. 다시 시도해 주세요.",
              "搜索失败，请重试。",
            ),
      );
    } finally {
      if (searchController.current === controller) setSearching(false);
    }
  }

  const collection =
    data?.collections.find((item) => item.id === collectionId) ??
    data?.collections[0];
  async function saveCreator(creator: Creator) {
    if (!collection || savingId) return;
    const wasSaved = collection.creatorIds.includes(creator.id);
    setSavingId(creator.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/workspace/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: wasSaved ? "remove" : "add",
          collectionId: collection.id,
          creatorId: creator.id,
        }),
      });
      if (!response.ok)
        throw new Error(response.status === 403 ? "permission" : "save");
      setData((current) =>
        current
          ? {
              ...current,
              collections: current.collections.map((item) =>
                item.id === collection.id
                  ? {
                      ...item,
                      creatorIds: wasSaved
                        ? item.creatorIds.filter((id) => id !== creator.id)
                        : [...new Set([...item.creatorIds, creator.id])],
                    }
                  : item,
              ),
            }
          : current,
      );
      setNotice(
        wasSaved
          ? t(
              "Removed from the collection.",
              "즐겨찾기에서 해제했어요.",
              "已取消收藏。",
            )
          : t(
              `Saved to ${collection.name}.`,
              `${collection.name}에 저장했어요.`,
              `已保存到 ${collection.name}。`,
            ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "permission"
          ? t(
              "An approved account is required to save creators.",
              "승인된 계정에서 크리에이터를 저장할 수 있어요.",
              "需要已批准的账户才能收藏达人。",
            )
          : t(
              "Could not confirm the save. Refresh before retrying.",
              "저장 여부를 확인하지 못했어요. 새로고침 후 다시 확인해 주세요.",
              "无法确认保存结果，请刷新后确认。",
            ),
      );
    } finally {
      setSavingId(null);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await authClient.signOut();
      if (response.error) throw new Error("logout");
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setError(
        t(
          "Could not sign out. Please try again.",
          "로그아웃하지 못했어요. 다시 시도해 주세요.",
          "退出失败，请重试。",
        ),
      );
      setSigningOut(false);
    }
  }

  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const viewsKey =
    (applied ?? filters).viewsWindow === "last10" ? "views10" : "views30";
  const creators = [
    ...(applied
      ? results
      : (data?.creators.filter(
          (creator) => creator.platform === filters.platform,
        ) ?? [])),
  ].sort((a, b) =>
    sort === "followers"
      ? b.followers - a.followers
      : sort === "views"
        ? b[viewsKey] - a[viewsKey]
        : sort === "engagement"
          ? b.engagement - a.engagement
          : 0,
  );
  const pages = Math.max(1, Math.ceil(creators.length / pageSize));
  const visibleCreators = creators.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const defaults = defaultFilters(filters.platform);
  const filterCount = Object.entries(filters).filter(
    ([key, value]) =>
      !["platform", "query", "searchMode"].includes(key) &&
      JSON.stringify(value) !==
        JSON.stringify(defaults[key as keyof DirectoryFilters]),
  ).length;

  function openDetail(creator: Creator, trigger: HTMLElement) {
    detailTrigger.current = trigger;
    setDetail(creator);
  }

  function saveButton(creator: Creator) {
    const saved = collection?.creatorIds.includes(creator.id) ?? false;
    return (
      <Button
        size="m"
        styleVariant={saved ? "secondary" : "tertiary"}
        colorVariant={saved ? "blue" : "monochrome-light"}
        leftContent={
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        }
        aria-label={`${saved ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
        aria-pressed={saved}
        disabled={!collection || savingId !== null}
        loading={savingId === creator.id}
        title={
          !collection
            ? t(
                "Create a collection first",
                "먼저 즐겨찾기 폴더를 만들어 주세요",
                "请先创建收藏夹",
              )
            : collection.name
        }
        onClick={() => void saveCreator(creator)}
      />
    );
  }

  function person(creator: Creator) {
    return (
      <button
        type="button"
        className="bz-person"
        onClick={(event) => openDetail(creator, event.currentTarget)}
      >
        <span
          className="bz-creator-avatar"
          style={{
            backgroundColor: `${creator.accent}18`,
            color: creator.accent,
          }}
          aria-hidden="true"
        >
          {creator.name.slice(0, 1)}
        </span>
        <span>
          <strong>{creator.name.replace(/ \(Demo\)$/, "")}</strong>
          <small>
            {creator.handle} <span>· {creator.country}</span>
          </small>
        </span>
      </button>
    );
  }

  return (
    <div
      className="bz-workspace"
      data-bezier-theme="light"
      lang={locale === "zh" ? "zh-CN" : locale}
    >
      <a href="#bz-main" className="bz-skip">
        {t("Skip to content", "본문으로 바로가기", "跳到内容")}
      </a>
      <BezierWorkspaceShell
        locale={locale}
        organizationName={organizationName}
        userName={userName}
        status={status}
        signingOut={signingOut}
        onSignOut={() => void signOut()}
      >
        <main className="bz-main" id="bz-main">
          <div className="bz-heading">
            <div>
              <div className="bz-eyebrow">CREATOR DISCOVERY</div>
              <h1>{t("Discover creators", "크리에이터 검색", "达人查询")}</h1>
              <p>
                {t(
                  "Find the right voice for your brand’s next story.",
                  "우리 브랜드의 다음 이야기를 함께할 크리에이터를 찾아보세요.",
                  "寻找适合品牌下一段故事的创作者。",
                )}
              </p>
            </div>
            <Link
              className="bz-collection-link"
              href={`/storage/collect?lang=${locale}`}
            >
              <FolderHeart size={18} />
              {t("My collections", "내 즐겨찾기", "我的收藏")}
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="bz-demo-note">
            <Info size={16} />
            <p>
              <strong>
                {t("Demo workspace", "데모 작업 공간", "演示工作区")}
              </strong>
              <span>
                {t(
                  "Profiles and metrics are fictional. Searches and collections are saved to your database.",
                  "프로필과 지표는 가상 데이터예요. 검색 이력과 즐겨찾기는 실제 DB에 저장돼요.",
                  "达人和指标为虚构数据，搜索记录和收藏保存至数据库。",
                )}
              </span>
            </p>
          </div>
          {error && (
            <div role="alert" className="bz-alert bz-alert-error">
              <Info size={18} />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div role="status" className="bz-alert bz-alert-success">
              <Check size={18} />
              <span>{notice}</span>
            </div>
          )}

          <Tabs
            value={filters.platform}
            onValueChange={(value) => reset(value as PlatformId)}
          >
            <section
              className="bz-search-panel"
              aria-label={t("Search conditions", "검색 조건", "搜索条件")}
            >
              <TabList size="l" className="bz-platform-tabs">
                <TabItems aria-label={t("Platform", "플랫폼", "平台")}>
                  {(Object.keys(platformNames) as PlatformId[]).map(
                    (platform) => (
                      <TabItem
                        key={platform}
                        value={platform}
                        disabled={searching}
                      >
                        {platformNames[platform]}
                      </TabItem>
                    ),
                  )}
                </TabItems>
              </TabList>
              <TabContent value={filters.platform} className="bz-tab-content">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  <div className="bz-search-mode-row">
                    <SegmentedControl
                      size="s"
                      value={filters.searchMode}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          searchMode: value as SearchMode,
                        })
                      }
                      aria-label={t("Search by", "검색 기준", "搜索方式")}
                    >
                      {(
                        [
                          [
                            "creator",
                            t("Name / channel", "이름 · 채널", "名称 / 频道"),
                          ],
                          ["content", t("Content", "콘텐츠", "内容")],
                          ["bio", t("Biography", "소개", "简介")],
                          [
                            "brand",
                            t("Brand mentions", "브랜드 언급", "品牌提及"),
                          ],
                        ] as const
                      ).map(([value, label]) => (
                        <SegmentedControlItem
                          key={value}
                          value={value}
                          disabled={searching}
                        >
                          {label}
                        </SegmentedControlItem>
                      ))}
                    </SegmentedControl>
                  </div>
                  <div className="bz-search-row">
                    <TextField
                      size="xl"
                      type="search"
                      wrapperClassName="bz-search-input"
                      leftContent={<Search size={21} />}
                      aria-label={t(
                        "Search creators",
                        "크리에이터 검색",
                        "搜索达人",
                      )}
                      placeholder={t(
                        "Search a creator, channel, or keyword",
                        "크리에이터 이름, 채널 또는 키워드를 입력해 주세요",
                        "输入达人名称、频道或关键词",
                      )}
                      value={filters.query}
                      maxLength={500}
                      disabled={loading || searching}
                      allowClear
                      onChange={(event) =>
                        setFilters({ ...filters, query: event.target.value })
                      }
                    />
                    <Button
                      size="xl"
                      type="submit"
                      colorVariant="blue"
                      text={t("Search", "검색하기", "搜索")}
                      loading={searching}
                      disabled={loading || !data}
                    />
                  </div>
                  <div className="bz-filter-bar">
                    <div className="bz-filter-actions">
                      <Button
                        size="m"
                        styleVariant={expanded ? "secondary" : "tertiary"}
                        colorVariant={expanded ? "blue" : "monochrome-dark"}
                        leftContent={<SlidersHorizontal size={16} />}
                        text={`${t("Filters", "상세 필터", "筛选")}${filterCount ? ` · ${filterCount}` : ""}`}
                        aria-expanded={expanded}
                        aria-controls="bz-search-filters"
                        onClick={() => setExpanded(!expanded)}
                      />
                      <span className="bz-filter-divider" />
                      <span className="bz-topic-label">
                        {t("Topics", "추천 주제", "推荐主题")}
                      </span>
                      {["gaming", "rpg", "technology"].map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          className="bz-topic-quick"
                          aria-pressed={filters.includeTags.includes(tag)}
                          disabled={loading || searching || !data}
                          onClick={() => {
                            const next = {
                              ...filters,
                              includeTags: filters.includeTags.includes(tag)
                                ? filters.includeTags.filter(
                                    (item) => item !== tag,
                                  )
                                : [...filters.includeTags, tag],
                            };
                            setFilters(next);
                            void search(next);
                          }}
                        >
                          # {tagLabel(tag, locale)}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="m"
                      styleVariant="tertiary"
                      colorVariant="monochrome-light"
                      text={t("Reset", "초기화", "重置")}
                      leftContent={<RotateCcw size={14} />}
                      onClick={() => reset()}
                      disabled={searching}
                    />
                  </div>
                  {expanded && (
                    <div id="bz-search-filters" className="bz-filter-area">
                      <BezierFiltersPanel
                        filters={filters}
                        setFilters={setFilters}
                        locale={locale}
                        disabled={searching}
                      />
                      <div className="bz-filter-footer">
                        <span>
                          {t(
                            "Numeric ranges use K (1,000).",
                            "숫자 범위 단위 K = 1,000",
                            "数值范围单位 K = 1,000。",
                          )}
                        </span>
                        <Button
                          type="submit"
                          size="m"
                          text={t("Apply filters", "필터 적용", "应用筛选")}
                          disabled={loading || !data}
                          loading={searching}
                        />
                      </div>
                    </div>
                  )}
                </form>
              </TabContent>
            </section>
          </Tabs>

          <section
            className="bz-results"
            aria-label={t("Search results", "검색 결과", "搜索结果")}
            aria-busy={loading || searching}
          >
            <div className="bz-result-heading">
              <div className="bz-result-title">
                <h2>
                  {applied
                    ? t("Search results", "검색 결과", "搜索结果")
                    : t("Explore creators", "크리에이터 둘러보기", "探索达人")}
                </h2>
                <Badge variant="blue" size="m">
                  {creators.length}
                </Badge>
                <span className="bz-result-caption">
                  {platformNames[(applied ?? filters).platform]}
                </span>
              </div>
              <div className="bz-view-controls">
                <Button
                  size="m"
                  aria-label={t("List view", "목록 보기", "列表视图")}
                  aria-pressed={view === "list"}
                  styleVariant={view === "list" ? "secondary" : "tertiary"}
                  colorVariant={view === "list" ? "blue" : "monochrome-light"}
                  leftContent={<LayoutList size={18} />}
                  onClick={() => setView("list")}
                />
                <Button
                  size="m"
                  aria-label={t("Card view", "카드 보기", "卡片视图")}
                  aria-pressed={view === "grid"}
                  styleVariant={view === "grid" ? "secondary" : "tertiary"}
                  colorVariant={view === "grid" ? "blue" : "monochrome-light"}
                  leftContent={<Grid2X2 size={17} />}
                  onClick={() => setView("grid")}
                />
              </div>
            </div>
            <div className="bz-results-panel">
              <div className="bz-results-toolbar">
                <div className="bz-collection-control">
                  <FolderHeart size={18} />
                  {data?.collections.length ? (
                    <BezierSelect
                      id="bz-collection"
                      label={t("Save to collection", "저장할 폴더", "收藏至")}
                      value={collection?.id ?? ""}
                      options={data.collections.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      onChange={setCollectionId}
                    />
                  ) : (
                    <Link href={`/storage/collect?lang=${locale}`}>
                      {t(
                        "Create a collection to save creators",
                        "즐겨찾기 폴더를 만들고 크리에이터를 저장하세요",
                        "创建收藏夹以保存达人",
                      )}
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <BezierSelect
                  id="bz-sort"
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
              {loading ? (
                <div className="bz-empty" role="status">
                  <Spinner size="l" />
                  <h3>
                    {t(
                      "Finding your next collaboration…",
                      "크리에이터를 불러오고 있어요",
                      "正在加载达人…",
                    )}
                  </h3>
                </div>
              ) : !data ? (
                <div className="bz-empty">
                  <Info size={32} />
                  <h3>
                    {t(
                      "Workspace unavailable",
                      "작업 공간을 불러올 수 없어요",
                      "工作区不可用",
                    )}
                  </h3>
                  <Button
                    text={t("Try again", "다시 시도", "重试")}
                    onClick={() => window.location.reload()}
                  />
                </div>
              ) : creators.length === 0 ? (
                <div className="bz-empty">
                  <span className="bz-empty-icon">
                    <Search size={30} />
                  </span>
                  <h3>
                    {t(
                      "No matching creators",
                      "조건에 맞는 크리에이터가 없어요",
                      "没有符合条件的达人",
                    )}
                  </h3>
                  <p>
                    {t(
                      "Try another keyword or broaden your filters.",
                      "다른 키워드를 입력하거나 필터 범위를 넓혀보세요.",
                      "请尝试其他关键词或放宽筛选条件。",
                    )}
                  </p>
                  <Button
                    size="m"
                    styleVariant="secondary"
                    text={t("Reset filters", "검색 조건 초기화", "重置筛选")}
                    onClick={() => reset()}
                  />
                </div>
              ) : view === "list" ? (
                <div
                  className="bz-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t("Creator list", "크리에이터 목록", "达人列表")}
                >
                  <table className="bz-table">
                    <thead>
                      <tr>
                        {[
                          t("Creator", "크리에이터", "达人"),
                          t("Followers", "팔로워", "粉丝"),
                          t("Avg. views", "평균 조회수", "平均播放量"),
                          t("Topics", "주제", "主题"),
                          t("Engagement", "참여율", "互动率"),
                          t("Last posted", "최근 게시", "最近发布"),
                          t("Save", "저장", "收藏"),
                        ].map((heading) => (
                          <th scope="col" key={heading}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCreators.map((creator) => (
                        <tr key={creator.id}>
                          <td>{person(creator)}</td>
                          <td className="bz-metric">
                            {number(creator.followers)}
                          </td>
                          <td>
                            <strong className="bz-metric">
                              {number(creator[viewsKey])}
                            </strong>
                            <small className="bz-submetric">
                              {viewsKey === "views10"
                                ? t("Last 10 posts", "최근 10개", "最近10条")
                                : t("Last 30 days", "최근 30일", "最近30天")}
                            </small>
                          </td>
                          <td>
                            <div className="bz-tags">
                              {creator.tags.slice(0, 2).map((tag) => (
                                <Tag
                                  size="s"
                                  variant="monochrome-light"
                                  key={tag}
                                >
                                  {tagLabel(tag, locale)}
                                </Tag>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className="bz-engagement">
                              {creator.engagement.toFixed(1)}%
                            </span>
                          </td>
                          <td className="bz-last-post">
                            {t(
                              `${creator.daysSincePosted}d ago`,
                              `${creator.daysSincePosted}일 전`,
                              `${creator.daysSincePosted}天前`,
                            )}
                          </td>
                          <td>{saveButton(creator)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bz-creator-grid">
                  {visibleCreators.map((creator) => (
                    <article className="bz-creator-card" key={creator.id}>
                      <div className="bz-card-top">
                        {person(creator)}
                        {saveButton(creator)}
                      </div>
                      <div className="bz-card-metrics">
                        <div>
                          <span>{t("Followers", "팔로워", "粉丝")}</span>
                          <strong>{number(creator.followers)}</strong>
                        </div>
                        <div>
                          <span>
                            {t("Avg. views", "평균 조회수", "平均播放量")}
                          </span>
                          <strong>{number(creator[viewsKey])}</strong>
                        </div>
                        <div>
                          <span>{t("Engagement", "참여율", "互动率")}</span>
                          <strong className="bz-engagement">
                            {creator.engagement.toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                      <div className="bz-tags">
                        {creator.tags.map((tag) => (
                          <Tag size="s" variant="monochrome-light" key={tag}>
                            {tagLabel(tag, locale)}
                          </Tag>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {creators.length > 0 && (
                <footer className="bz-pagination">
                  <span>
                    {t(
                      `${creators.length} creators · showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, creators.length)}`,
                      `전체 ${creators.length}명 중 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, creators.length)}명`,
                      `共${creators.length}位达人 · ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, creators.length)}`,
                    )}
                  </span>
                  <div>
                    <Button
                      size="m"
                      styleVariant="tertiary"
                      colorVariant="monochrome-light"
                      leftContent={<ChevronLeft size={17} />}
                      aria-label={t("Previous page", "이전 페이지", "上一页")}
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    />
                    {Array.from({ length: pages }, (_, index) => (
                      <Button
                        key={index}
                        text={String(index + 1)}
                        size="m"
                        styleVariant={
                          page === index + 1 ? "secondary" : "tertiary"
                        }
                        colorVariant={
                          page === index + 1 ? "blue" : "monochrome-light"
                        }
                        aria-current={page === index + 1 ? "page" : undefined}
                        aria-label={t(
                          `Page ${index + 1}`,
                          `${index + 1}페이지`,
                          `第${index + 1}页`,
                        )}
                        onClick={() => setPage(index + 1)}
                      />
                    ))}
                    <Button
                      size="m"
                      styleVariant="tertiary"
                      colorVariant="monochrome-light"
                      leftContent={<ChevronRight size={17} />}
                      aria-label={t("Next page", "다음 페이지", "下一页")}
                      disabled={page === pages}
                      onClick={() => setPage(page + 1)}
                    />
                  </div>
                </footer>
              )}
            </div>
          </section>
          {!!data?.recentSearches.length && (
            <section className="bz-history">
              <h2>
                <Clock3 size={15} />
                {t("Recent searches", "최근 검색", "最近搜索")}
              </h2>
              <div>
                {data.recentSearches
                  .filter((item) => item.mode === "search")
                  .slice(0, 5)
                  .map((item) => (
                    <span key={item.id}>
                      {item.query ||
                        t("Filtered search", "조건 검색", "筛选搜索")}
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleDateString(locale)}
                      </time>
                    </span>
                  ))}
              </div>
            </section>
          )}
          <footer className="bz-page-footer">
            FUTURES MEDIALAB
            <span>
              {t(
                "Better connections. Greater possibilities.",
                "더 나은 연결, 더 큰 가능성.",
                "更好的连接，更多的可能。",
              )}
            </span>
          </footer>
        </main>
      </BezierWorkspaceShell>
      <dialog
        ref={dialogRef}
        className="bz-profile-dialog"
        aria-labelledby="bz-profile-title"
        onClose={() => {
          setDetail(null);
          detailTrigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <>
            <Button
              className="bz-dialog-close"
              size="m"
              styleVariant="tertiary"
              colorVariant="monochrome-light"
              leftContent={<X size={20} />}
              aria-label={t("Close profile", "프로필 닫기", "关闭资料")}
              onClick={() => setDetail(null)}
            />
            <Badge size="s" variant="blue">
              {t("Fictional profile", "가상 프로필", "虚构达人")}
            </Badge>
            <span
              className="bz-creator-avatar bz-profile-avatar"
              style={{
                backgroundColor: `${detail.accent}18`,
                color: detail.accent,
              }}
            >
              {detail.name.slice(0, 1)}
            </span>
            <h2 id="bz-profile-title">
              {detail.name.replace(/ \(Demo\)$/, "")}
            </h2>
            <p className="bz-profile-handle">
              {detail.handle} · {platformNames[detail.platform]} ·{" "}
              {detail.country}
            </p>
            <div className="bz-card-metrics">
              <div>
                <span>{t("Followers", "팔로워", "粉丝")}</span>
                <strong>{number(detail.followers)}</strong>
              </div>
              <div>
                <span>{t("Avg. views", "평균 조회수", "平均播放量")}</span>
                <strong>{number(detail[viewsKey])}</strong>
              </div>
              <div>
                <span>{t("Engagement", "참여율", "互动率")}</span>
                <strong className="bz-engagement">
                  {detail.engagement.toFixed(1)}%
                </strong>
              </div>
            </div>
            <p className="bz-profile-bio">{detail.bio}</p>
            <div className="bz-tags">
              {detail.tags.map((tag) => (
                <Tag size="m" variant="monochrome-light" key={tag}>
                  {tagLabel(tag, locale)}
                </Tag>
              ))}
            </div>
            <div className="bz-profile-footer">
              {collection ? (
                <Button
                  size="l"
                  text={
                    collection.creatorIds.includes(detail.id)
                      ? t("Remove from collection", "즐겨찾기 해제", "取消收藏")
                      : t("Save creator", "즐겨찾기에 저장", "收藏达人")
                  }
                  leftContent={<Bookmark size={18} />}
                  disabled={savingId !== null}
                  loading={savingId === detail.id}
                  onClick={() => void saveCreator(detail)}
                />
              ) : (
                <Link href={`/storage/collect?lang=${locale}`}>
                  {t(
                    "Create a collection",
                    "즐겨찾기 폴더 만들기",
                    "创建收藏夹",
                  )}
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
