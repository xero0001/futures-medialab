"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  IconButton,
  Option,
  Pagination,
  SearchField,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  Typography,
} from "@montage-ui/core";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderHeart,
  Globe2,
  Info,
  Instagram,
  Music2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Twitch,
  Users,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "../../../_components/landing-copy";
import {
  defaultFilters,
  type Creator,
  type DirectoryFilters,
  type PlatformId,
  type SearchMode,
} from "../../../../lib/creator-directory";
import {
  platformNames,
  tagLabel,
  translate,
} from "../../_components/directory-filters";
import { CreatorAvatar } from "../../_components/creator-avatar";
import { MontageProvider } from "./montage-provider";
import { MontageShell } from "./montage-shell";
import { MontageFilters } from "./montage-filters";
import { useMontageSearch } from "./use-montage-search";
import styles from "./montage-search.module.css";

const platformIcons: Record<PlatformId, LucideIcon> = {
  youtube: Youtube,
  tiktok: Music2,
  instagram: Instagram,
  twitch: Twitch,
  x: X,
  facebook: Users,
};

type Props = {
  locale: Locale;
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
};

export function MontageSearch(props: Props) {
  return (
    <MontageProvider>
      <SearchWorkspace {...props} />
    </MontageProvider>
  );
}

function SearchWorkspace({
  locale,
  organizationName,
  status,
  userName,
}: Props) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const state = useMontageSearch(locale);
  const {
    data,
    error,
    notice,
    busy,
    filters,
    applied,
    sorted,
    sort,
    page,
    pages,
    activeCollection,
  } = state;
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Creator | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const defaults = defaultFilters(filters.platform);
  const changedFilters = Object.keys(defaults).filter((key) => {
    const field = key as keyof DirectoryFilters;
    return (
      !["query", "platform", "searchMode"].includes(field) &&
      JSON.stringify(defaults[field]) !== JSON.stringify(filters[field])
    );
  }).length;
  const isDirty =
    applied && JSON.stringify(applied) !== JSON.stringify(filters);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const localHref = (path: string) => `${path}?lang=${locale}`;
  const countries: Record<string, string> = {
    KR: t("South Korea", "대한민국", "韩国"),
    US: t("United States", "미국", "美国"),
    JP: t("Japan", "일본", "日本"),
    CN: t("China", "중국", "中国"),
    GB: t("United Kingdom", "영국", "英国"),
    SG: t("Singapore", "싱가포르", "新加坡"),
  };

  useEffect(() => {
    if (detail) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.showModal();
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
      previousFocus.current?.focus();
    }
  }, [detail]);

  function quickFilter(key: "country" | "includeTags", value: string) {
    const next =
      key === "includeTags"
        ? {
            ...filters,
            includeTags: filters.includeTags.includes(value)
              ? filters.includeTags.filter((tag) => tag !== value)
              : [...filters.includeTags, value],
          }
        : { ...filters, country: filters.country === value ? "" : value };
    state.setFilters(next);
    void state.search(next);
  }

  return (
    <div
      className={styles.workspace}
      lang={locale === "zh" ? "zh-CN" : locale}
      data-montage-workspace="demo"
    >
      <MontageShell
        locale={locale}
        organizationName={organizationName}
        userName={userName}
        busy={busy}
        onSignOut={() => void state.signOut()}
      />

      <main id="montage-main" className={styles.main}>
        <div className={styles.breadcrumb}>
          {t("Discover", "탐색", "探索")}
          <ChevronRight size={13} />
          <span>{t("Creator search", "크리에이터 검색", "达人查询")}</span>
        </div>
        <div className={styles.heading}>
          <div>
            <Typography as="h1" variant="title1" weight="bold">
              {t(
                "Find your next creator",
                "다음 협업을 발견하세요",
                "发现下一次合作",
              )}
            </Typography>
            <p>
              {t(
                "Meet the creators who will grow with your brand.",
                "우리 브랜드와 함께 성장할 크리에이터를 찾아보세요.",
                "寻找与您的品牌共同成长的达人。",
              )}
            </p>
          </div>
          <Button
            as={Link}
            href={localHref("/storage/collect")}
            variant="outlined"
            color="assistive"
            size="medium"
            leadingContent={<Bookmark size={17} />}
          >
            {t("Collections", "즐겨찾기", "收藏夹")}
          </Button>
        </div>

        <section
          className={styles.searchPanel}
          aria-label={t("Search creators", "크리에이터 검색", "搜索达人")}
        >
          <div
            className={styles.platforms}
            role="group"
            aria-label={t("Platform", "플랫폼", "平台")}
          >
            {(Object.keys(platformNames) as PlatformId[]).map((platform) => {
              const Icon = platformIcons[platform];
              return (
                <button
                  key={platform}
                  type="button"
                  aria-pressed={filters.platform === platform}
                  disabled={busy}
                  onClick={() => state.reset(platform)}
                  className={styles.platform}
                >
                  <Icon
                    size={20}
                    strokeWidth={platform === "youtube" ? 2.2 : 1.8}
                  />
                  <span>{platformNames[platform]}</span>
                  {filters.platform === platform && data && (
                    <span className={styles.platformCount}>
                      {
                        data.creators.filter(
                          (creator) => creator.platform === platform,
                        ).length
                      }
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void state.search();
            }}
            className={styles.searchForm}
          >
            <div className={styles.searchModeRow}>
              <SegmentedControl
                value={filters.searchMode}
                size="small"
                aria-label={t("Search by", "검색 기준", "搜索方式")}
                onValueChange={(value) =>
                  state.setFilters({
                    ...filters,
                    searchMode: value as SearchMode,
                  })
                }
              >
                {(
                  [
                    ["creator", t("Name / channel", "이름·채널", "名称·频道")],
                    ["content", t("Content", "콘텐츠", "内容")],
                    ["bio", t("Biography", "소개", "简介")],
                    ["brand", t("Brand mentions", "브랜드 언급", "品牌提及")],
                  ] as const
                ).map(([value, label]) => (
                  <SegmentedControlItem
                    key={value}
                    value={value}
                    disabled={busy}
                  >
                    {label}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            <div className={styles.searchRow}>
              <SearchField
                ref={searchInput}
                aria-label={t("Search creators", "크리에이터 검색", "搜索达人")}
                width="100%"
                size="large"
                variant="outlined"
                disabled={busy}
                value={filters.query}
                maxLength={500}
                onChange={(event) =>
                  state.setFilters({ ...filters, query: event.target.value })
                }
                onReset={() => state.setFilters({ ...filters, query: "" })}
                placeholder={t(
                  "Search a creator, channel or keyword",
                  "크리에이터 이름, 채널 또는 키워드를 검색해 보세요",
                  "搜索达人名称、频道或关键词",
                )}
              />
              <Button
                type="submit"
                size="large"
                loading={busy}
                disabled={!data || busy}
                leadingContent={<Search size={19} />}
              >
                {t("Search", "검색하기", "搜索")}
              </Button>
            </div>
            <div className={styles.quickFilters}>
              <span className={styles.quickLabel}>
                {t("Quick filters", "빠른 필터", "快捷筛选")}
              </span>
              <Chip
                type="button"
                size="small"
                active={filters.country === "KR"}
                aria-pressed={filters.country === "KR"}
                disabled={!data || busy}
                onClick={() => quickFilter("country", "KR")}
                leadingContent={<Globe2 size={14} />}
              >
                {t("South Korea", "대한민국", "韩国")}
              </Chip>
              {["gaming", "rpg", "esports"].map((tag) => (
                <Chip
                  type="button"
                  key={tag}
                  size="small"
                  active={filters.includeTags.includes(tag)}
                  aria-pressed={filters.includeTags.includes(tag)}
                  disabled={!data || busy}
                  onClick={() => quickFilter("includeTags", tag)}
                >
                  {tagLabel(tag, locale)}
                </Chip>
              ))}
              <span className={styles.filterSpacer} />
              <Button
                type="button"
                size="small"
                variant="outlined"
                color="assistive"
                aria-expanded={expanded}
                aria-controls="montage-advanced-filters"
                onClick={() => setExpanded(!expanded)}
                leadingContent={<SlidersHorizontal size={15} />}
                trailingContent={
                  <ChevronDown
                    size={14}
                    className={expanded ? styles.rotated : ""}
                  />
                }
              >
                {t("All filters", "상세 필터", "高级筛选")}
                {changedFilters > 0 && (
                  <span className={styles.filterCount}>{changedFilters}</span>
                )}
              </Button>
              <IconButton
                type="button"
                size="large"
                aria-label={t("Reset filters", "검색 조건 초기화", "重置筛选")}
                title={t("Reset filters", "검색 조건 초기화", "重置筛选")}
                disabled={busy}
                onClick={() => state.reset()}
              >
                <RotateCcw size={17} />
              </IconButton>
            </div>
            {expanded && (
              <div
                id="montage-advanced-filters"
                className={styles.advancedFilters}
              >
                <MontageFilters
                  locale={locale}
                  filters={filters}
                  setFilters={state.setFilters}
                  disabled={busy}
                />
                <div className={styles.applyFilters}>
                  <Button
                    type="submit"
                    disabled={busy || !data}
                    size="medium"
                    leadingContent={<Check size={17} />}
                  >
                    {t("Apply filters", "필터 적용", "应用筛选")}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </section>

        <div className={styles.demoNotice}>
          <Info size={16} />
          <p>
            <strong>{t("Demo directory", "데모 디렉터리", "演示目录")}</strong>
            {t(
              "This internal demo includes public channels and fictional profiles. Metrics are illustrative, not actual figures.",
              "공개 채널과 가상 프로필이 포함된 내부 데모입니다. 지표는 실제 수치가 아닙니다.",
              "此内部演示包含公开频道和虚构资料。所有指标均为示例，并非实际数据。",
            )}
          </p>
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error}
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => void state.reload()}
            >
              {t("Refresh workspace", "작업 공간 새로고침", "刷新工作区")}
            </Button>
          </div>
        )}
        {notice && (
          <div className={styles.success} role="status">
            <Check size={17} />
            {notice}
          </div>
        )}

        <section
          className={styles.results}
          aria-label={t("Search results", "검색 결과", "搜索结果")}
          aria-busy={busy}
        >
          <div className={styles.resultsToolbar}>
            <div>
              <h2>
                {applied
                  ? t("Search results", "검색 결과", "搜索结果")
                  : t("Explore creators", "크리에이터 둘러보기", "浏览达人")}
                <span>{data ? sorted.length : "—"}</span>
              </h2>
              <p aria-live="polite">
                {isDirty
                  ? t(
                      "Filters changed. Search to apply them.",
                      "검색 조건이 변경됐어요. 검색하기를 눌러 적용해 주세요.",
                      "筛选已更改，请点击搜索应用。",
                    )
                  : t(
                      `${platformNames[filters.platform]} · Discover a good fit for your brand`,
                      `${platformNames[filters.platform]} · 브랜드에 맞는 채널을 살펴보세요`,
                      `${platformNames[filters.platform]} · 寻找适合品牌的频道`,
                    )}
              </p>
            </div>
            <div className={styles.resultControls}>
              {data && data.collections.length > 0 ? (
                <Select
                  size="medium"
                  width={175}
                  aria-label={t("Save to collection", "저장할 폴더", "收藏至")}
                  leadingContent={<FolderHeart size={16} />}
                  value={activeCollection?.id ?? ""}
                  onChange={state.setCollectionId}
                  disabled={busy}
                >
                  {data.collections.map((collection) => (
                    <Option key={collection.id} value={collection.id}>
                      {collection.name}
                    </Option>
                  ))}
                </Select>
              ) : (
                <Link
                  className={styles.newFolder}
                  href={localHref("/storage/collect")}
                >
                  <FolderHeart size={16} />
                  {t("Create a folder", "저장 폴더 만들기", "创建收藏夹")}
                  <ArrowUpRight size={13} />
                </Link>
              )}
              <Select
                size="medium"
                width={140}
                aria-label={t("Sort by", "정렬", "排序")}
                leadingContent={<ArrowDownWideNarrow size={16} />}
                value={sort}
                onChange={state.setSort}
                disabled={busy}
              >
                <Option value="relevance">
                  {t("Recommended", "추천순", "推荐排序")}
                </Option>
                <Option value="followers">
                  {t("Followers", "팔로워순", "粉丝数")}
                </Option>
                <Option value="views">
                  {t("Views", "조회수순", "播放量")}
                </Option>
                <Option value="engagement">
                  {t("Engagement", "참여율순", "互动率")}
                </Option>
              </Select>
            </div>
          </div>
          {!data ? (
            <div className={styles.loading} role="status">
              <div className={styles.loadingBar} />
              <p>
                {error
                  ? t(
                      "Workspace unavailable",
                      "작업 공간을 불러올 수 없습니다",
                      "工作区不可用",
                    )
                  : t(
                      "Finding your creators…",
                      "크리에이터를 불러오고 있어요…",
                      "正在加载达人…",
                    )}
              </p>
            </div>
          ) : sorted.length ? (
            <>
              <div
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label={t(
                  "Creator results table",
                  "크리에이터 검색 결과 표",
                  "达人结果表",
                )}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("Creator", "크리에이터", "达人")}</th>
                      <th>{t("Followers", "팔로워", "粉丝数")}</th>
                      <th>{t("Average views", "평균 조회수", "平均播放量")}</th>
                      <th>{t("Topics", "콘텐츠 주제", "内容主题")}</th>
                      <th>{t("Engagement", "참여율", "互动率")}</th>
                      <th>{t("Last posted", "최근 게시", "最近发布")}</th>
                      <th>
                        <span className={styles.srOnly}>
                          {t("Save", "저장", "收藏")}
                        </span>
                        <Bookmark size={16} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice((page - 1) * 8, page * 8).map((creator) => {
                      const CreatorPlatformIcon =
                        platformIcons[creator.platform];
                      const saved =
                        activeCollection?.creatorIds.includes(creator.id) ??
                        false;
                      return (
                        <tr key={creator.id}>
                          <td>
                            <button
                              type="button"
                              className={styles.creator}
                              onClick={() => setDetail(creator)}
                            >
                              <span className={styles.creatorAvatar}>
                                <CreatorAvatar
                                  name={creator.name}
                                  avatarUrl={creator.avatarUrl}
                                  size={40}
                                />
                                <CreatorPlatformIcon size={12} />
                              </span>
                              <span>
                                <strong>
                                  {creator.name.replace(/\s*\(Demo\)$/, "")}
                                </strong>
                                <small>
                                  {countries[creator.country] ??
                                    creator.country}
                                  <span>·</span>
                                  {creator.handle}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td className={styles.metric}>
                            {number(creator.followers)}
                          </td>
                          <td>
                            <strong className={styles.metric}>
                              {number(
                                creator[
                                  (applied ?? filters).viewsWindow === "last10"
                                    ? "views10"
                                    : "views30"
                                ],
                              )}
                            </strong>
                            <small className={styles.metricNote}>
                              {(applied ?? filters).viewsWindow === "last10"
                                ? t(
                                    "Last 10 posts",
                                    "최근 게시물 10개",
                                    "最近10条",
                                  )
                                : t("Last 30 days", "최근 30일", "最近30天")}
                            </small>
                          </td>
                          <td>
                            <div className={styles.tags}>
                              {creator.tags.slice(0, 2).map((tag) => (
                                <span key={tag}>{tagLabel(tag, locale)}</span>
                              ))}
                            </div>
                          </td>
                          <td className={styles.engagement}>
                            {creator.engagement.toFixed(1)}
                            <span>%</span>
                          </td>
                          <td className={styles.posted}>
                            <span
                              className={
                                creator.daysSincePosted <= 7
                                  ? styles.recentDot
                                  : styles.olderDot
                              }
                            />
                            {t(
                              `${creator.daysSincePosted}d ago`,
                              `${creator.daysSincePosted}일 전`,
                              `${creator.daysSincePosted}天前`,
                            )}
                          </td>
                          <td>
                            <IconButton
                              size="xlarge"
                              aria-label={`${saved ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
                              aria-pressed={saved}
                              disabled={busy}
                              color={
                                saved
                                  ? "semantic.foreground.brand.primary"
                                  : "semantic.foreground.neutral.tertiary"
                              }
                              onClick={() => void state.saveCreator(creator)}
                            >
                              <Bookmark
                                size={19}
                                fill={saved ? "currentColor" : "none"}
                              />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <span>
                  {t(
                    `${sorted.length} profiles · ${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)}`,
                    `전체 ${sorted.length}명 중 ${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)}명`,
                    `${sorted.length}位达人 · ${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)}`,
                  )}
                </span>
                <Pagination
                  variant="compact"
                  page={page}
                  totalPages={pages}
                  disabled={busy}
                  onChange={(next) => state.setPage(next ?? 1)}
                />
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <span>
                <Search size={28} />
              </span>
              <h3>
                {t(
                  "No matching creators",
                  "일치하는 크리에이터가 없어요",
                  "没有符合条件的达人",
                )}
              </h3>
              <p>
                {t(
                  "Try another keyword or broaden your filters.",
                  "다른 키워드를 입력하거나 검색 조건을 넓혀보세요.",
                  "请尝试其他关键词或放宽筛选条件。",
                )}
              </p>
              <Button
                variant="outlined"
                size="medium"
                onClick={() => {
                  state.reset();
                  searchInput.current?.focus();
                }}
              >
                {t("Reset search", "검색 조건 초기화", "重置搜索")}
              </Button>
            </div>
          )}
        </section>
        {!!data?.recentSearches.length && (
          <section
            className={styles.history}
            aria-label={t("Recent searches", "최근 검색", "最近搜索")}
          >
            <span>
              <Clock3 size={15} />
              {t("Recent searches", "최근 검색", "最近搜索")}
            </span>
            {data.recentSearches
              .filter((item) => item.mode === "search")
              .slice(0, 4)
              .map((item) => (
                <span key={item.id} className={styles.historyItem}>
                  {item.query || t("Filtered search", "조건 검색", "筛选搜索")}
                  <time>
                    {new Date(item.createdAt).toLocaleDateString(locale)}
                  </time>
                </span>
              ))}
          </section>
        )}
        <footer className={styles.footer}>
          <span>FUTURES MEDIALAB</span>
          <Link href={localHref("/storage/search")}>
            {t("View original search", "기존 검색 화면 보기", "查看原版搜索")}
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      </main>

      <dialog
        ref={dialogRef}
        className={styles.profileDialog}
        aria-labelledby="montage-profile-title"
        onClose={() => {
          setDetail(null);
          previousFocus.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetail(null);
        }}
      >
        {detail && (
          <div className={styles.profileContent}>
            <IconButton
              className={styles.closeDialog}
              size="xlarge"
              aria-label={t("Close profile", "프로필 닫기", "关闭资料")}
              onClick={() => setDetail(null)}
            >
              <X size={22} />
            </IconButton>
            <span className={styles.demoBadge}>
              {detail.identityKind === "public_channel"
                ? t("Demo metrics", "데모 지표", "演示指标")
                : t("Fictional profile", "가상 프로필", "虚构达人")}
            </span>
            <div className={styles.profileAvatar}>
              <CreatorAvatar
                name={detail.name}
                avatarUrl={detail.avatarUrl}
                size={72}
              />
            </div>
            <h2 id="montage-profile-title">
              {detail.name.replace(/\s*\(Demo\)$/, "")}
            </h2>
            <p className={styles.profileMeta}>
              {detail.handle} · {countries[detail.country] ?? detail.country} ·{" "}
              {platformNames[detail.platform]}
            </p>
            {detail.identityKind === "public_channel" && (
              <a
                className={styles.profileSource}
                href={detail.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(
                  "Source: official channel",
                  "출처: 공식 채널",
                  "来源：官方频道",
                )}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            )}
            <div className={styles.profileStats}>
              <div>
                <strong>{number(detail.followers)}</strong>
                <span>{t("Followers", "팔로워", "粉丝数")}</span>
              </div>
              <div>
                <strong>
                  {number(
                    detail[
                      (applied ?? filters).viewsWindow === "last10"
                        ? "views10"
                        : "views30"
                    ],
                  )}
                </strong>
                <span>{t("Average views", "평균 조회수", "平均播放量")}</span>
              </div>
              <div>
                <strong>{detail.engagement.toFixed(1)}%</strong>
                <span>{t("Engagement", "참여율", "互动率")}</span>
              </div>
            </div>
            <p className={styles.profileNote}>
              {t(
                "All metrics, including followers, views, and engagement, are sample values.",
                "팔로워·조회수·참여율 등 모든 지표는 예시 값입니다.",
                "粉丝数、播放量和互动率等所有指标均为示例值。",
              )}
            </p>
            <h3>{t("Content topics", "콘텐츠 주제", "内容主题")}</h3>
            <div className={styles.tags}>
              {detail.tags.map((tag) => (
                <span key={tag}>{tagLabel(tag, locale)}</span>
              ))}
            </div>
            {detail.content.length > 0 && (
              <>
                <h3>{t("Sample posts", "예시 게시물", "示例内容")}</h3>
                <ul>
                  {detail.content.map((content) => (
                    <li key={content}>{content}</li>
                  ))}
                </ul>
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className={styles.success} role="status">
                {notice}
              </p>
            )}
            {activeCollection ? (
              <Button
                fullWidth
                leadingContent={<Bookmark size={17} />}
                disabled={busy}
                loading={busy}
                onClick={() => void state.saveCreator(detail)}
              >
                {activeCollection.creatorIds.includes(detail.id)
                  ? t("Remove from collection", "즐겨찾기에서 해제", "取消收藏")
                  : t(
                      `Save to ${activeCollection.name}`,
                      `${activeCollection.name}에 저장`,
                      `保存至 ${activeCollection.name}`,
                    )}
              </Button>
            ) : (
              <Button
                as={Link}
                href={localHref("/storage/collect")}
                fullWidth
                leadingContent={<FolderHeart size={17} />}
              >
                {t(
                  "Create a collection to save",
                  "저장할 즐겨찾기 폴더 만들기",
                  "创建收藏夹以保存",
                )}
              </Button>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
