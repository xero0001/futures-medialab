"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Avatar,
  Button,
  Chip,
  ContentBadge,
  Divider,
  FilterButton,
  IconButton,
  Modal,
  ModalContainer,
  ModalContent,
  ModalNavigation,
  ModalNavigationButton,
  Option,
  SearchField,
  SectionMessage,
  Select,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
  TextButton,
  Typography,
} from "@montage-ui/core";
import {
  IconBookmark,
  IconChevronRight,
  IconClock,
  IconRefresh,
  IconSearch,
} from "@montage-ui/icon";
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
import { MontageProvider } from "../montage/montage-provider";
import { MontageShell } from "../montage/montage-shell";
import { useMontageSearch } from "../montage/use-montage-search";
import { Montage2Filters } from "./montage2-filters";
import { Montage2Results } from "./montage2-results";
import styles from "./montage2-search.module.css";

type Props = {
  locale: Locale;
  organizationName: string;
  status: "PENDING" | "ACTIVE";
  userName: string;
};

export function Montage2Search(props: Props) {
  return (
    <MontageProvider>
      <Workspace {...props} />
    </MontageProvider>
  );
}

function Workspace({ locale, organizationName, status, userName }: Props) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const state = useMontageSearch(locale);
  const { filters, applied, busy, data, error, notice } = state;
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<Creator | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaults = defaultFilters(filters.platform);
  const changedCount = Object.keys(defaults).filter((key) => {
    const field = key as keyof DirectoryFilters;
    return (
      !["query", "platform", "searchMode"].includes(field) &&
      JSON.stringify(defaults[field]) !== JSON.stringify(filters[field])
    );
  }).length;
  const dirty = applied && JSON.stringify(applied) !== JSON.stringify(filters);
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const quickFilters = [
    {
      key: "country",
      value: "KR",
      label: t("South Korea", "대한민국", "韩国"),
    },
    { key: "includeTags", value: "gaming", label: tagLabel("gaming", locale) },
    { key: "includeTags", value: "rpg", label: tagLabel("rpg", locale) },
    {
      key: "includeTags",
      value: "esports",
      label: tagLabel("esports", locale),
    },
  ] as const;

  function quickFilter(key: "country" | "includeTags", value: string) {
    const next =
      key === "country"
        ? { ...filters, country: filters.country === value ? "" : value }
        : {
            ...filters,
            includeTags: filters.includeTags.includes(value)
              ? filters.includeTags.filter((item) => item !== value)
              : [...filters.includeTags, value],
          };
    state.setFilters(next);
    void state.search(next);
  }

  return (
    <div className={styles.workspace} lang={locale === "zh" ? "zh-CN" : locale}>
      <MontageShell
        locale={locale}
        organizationName={organizationName}
        userName={userName}
        busy={busy}
        onSignOut={() => void state.signOut()}
        searchPath="/storage/search/montage2"
      />
      <main id="montage-main" className={styles.main}>
        <div className={styles.container}>
          <nav
            className={styles.breadcrumb}
            aria-label={t("Breadcrumb", "현재 위치", "当前位置")}
          >
            <Typography
              variant="caption1"
              color="semantic.foreground.neutral.tertiary"
            >
              {t("Discover", "크리에이터 탐색", "达人探索")}
            </Typography>
            <IconChevronRight aria-hidden />
            <Typography
              variant="caption1"
              color="semantic.foreground.neutral.secondary"
            >
              {t("Creator search", "크리에이터 검색", "达人查询")}
            </Typography>
          </nav>
          <div className={styles.heading}>
            <div className={styles.titleBlock}>
              <Typography as="h1" variant="title1" weight="bold">
                {t("Creator search", "크리에이터 검색", "达人查询")}
              </Typography>
              <Typography
                as="p"
                variant="body2"
                color="semantic.foreground.neutral.secondary"
              >
                {t(
                  "Find the right voices for your next brand collaboration.",
                  "우리 브랜드와 함께할 크리에이터를 찾아보세요.",
                  "寻找适合与您的品牌合作的达人。",
                )}
              </Typography>
            </div>
            <Button
              as={Link}
              href={`/storage/collect?lang=${locale}`}
              variant="outlined"
              color="assistive"
              size="medium"
              leadingContent={<IconBookmark aria-hidden />}
            >
              {t("Saved creators", "저장한 크리에이터", "已收藏达人")}
            </Button>
          </div>

          {status === "PENDING" && (
            <SectionMessage
              variant="cautionary"
              description={t(
                "Your brand account is awaiting approval.",
                "브랜드 계정 승인 대기 중입니다.",
                "品牌账户正在等待审核。",
              )}
            >
              {t("Approval pending", "승인 대기", "待审核")}
            </SectionMessage>
          )}

          <section
            aria-label={t("Search criteria", "검색 조건", "搜索条件")}
            className={styles.searchSection}
          >
            <Tab
              value={filters.platform}
              onValueChange={(value) => state.reset(value as PlatformId)}
            >
              <TabList
                size="medium"
                resize="hug"
                aria-label={t("Platform", "플랫폼", "平台")}
              >
                {(Object.keys(platformNames) as PlatformId[]).map(
                  (platform) => (
                    <TabListItem
                      key={platform}
                      value={platform}
                      disabled={busy}
                    >
                      {platformNames[platform]}
                    </TabListItem>
                  ),
                )}
              </TabList>
              {(Object.keys(platformNames) as PlatformId[]).map((platform) => (
                <TabPanel key={platform} value={platform} mountMode="always">
                  {platform === filters.platform && (
                    <form
                      className={styles.searchBody}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void state.search();
                      }}
                    >
                      <div className={styles.searchRow}>
                        <div className={styles.modeSelect}>
                          <Select
                            aria-label={t("Search by", "검색 기준", "搜索依据")}
                            size="large"
                            width="100%"
                            disabled={busy}
                            value={filters.searchMode}
                            onChange={(value) =>
                              state.setFilters({
                                ...filters,
                                searchMode: value as SearchMode,
                              })
                            }
                          >
                            <Option value="creator">
                              {t("Name or channel", "이름·채널", "姓名·频道")}
                            </Option>
                            <Option value="content">
                              {t("Content", "콘텐츠", "内容")}
                            </Option>
                            <Option value="bio">
                              {t("Bio", "소개", "简介")}
                            </Option>
                            <Option value="brand">
                              {t("Brand mentions", "브랜드 언급", "品牌提及")}
                            </Option>
                          </Select>
                        </div>
                        <SearchField
                          ref={inputRef}
                          size="large"
                          width="100%"
                          variant="outlined"
                          value={filters.query}
                          disabled={busy}
                          aria-label={t(
                            "Creator search",
                            "크리에이터 검색",
                            "达人查询",
                          )}
                          placeholder={t(
                            "Search names, channels, or keywords",
                            "크리에이터 이름, 채널 또는 키워드를 입력하세요",
                            "输入达人姓名、频道或关键词",
                          )}
                          onChange={(event) =>
                            state.setFilters({
                              ...filters,
                              query: event.target.value,
                            })
                          }
                          onReset={() =>
                            state.setFilters({ ...filters, query: "" })
                          }
                        />
                        <Button
                          type="submit"
                          size="large"
                          loading={busy}
                          disabled={!data}
                          leadingContent={<IconSearch aria-hidden />}
                        >
                          {t("Search", "검색하기", "搜索")}
                        </Button>
                      </div>
                      <div className={styles.filterRow}>
                        <Typography
                          variant="label2"
                          color="semantic.foreground.neutral.tertiary"
                        >
                          {t("Quick filters", "빠른 필터", "快速筛选")}
                        </Typography>
                        <div className={styles.chips}>
                          {quickFilters.map(({ key, value, label }) => (
                            <Chip
                              key={value}
                              as="button"
                              type="button"
                              size="medium"
                              variant="outlined"
                              active={
                                key === "country"
                                  ? filters.country === value
                                  : filters.includeTags.includes(value)
                              }
                              disabled={busy}
                              onClick={() => quickFilter(key, value)}
                            >
                              {label}
                            </Chip>
                          ))}
                        </div>
                        <div className={styles.filterActions}>
                          <FilterButton
                            type="button"
                            size="medium"
                            variant="outlined"
                            expanded={expanded}
                            active={changedCount > 0}
                            activeLabel={changedCount}
                            aria-expanded={expanded}
                            aria-controls="montage2-filters"
                            onClick={() => setExpanded(!expanded)}
                          >
                            {t("All filters", "상세 필터", "全部筛选")}
                          </FilterButton>
                          <IconButton
                            type="button"
                            size="xlarge"
                            disabled={busy}
                            aria-label={t(
                              "Reset search criteria",
                              "검색 조건 초기화",
                              "重置搜索条件",
                            )}
                            onClick={() => state.reset()}
                          >
                            <IconRefresh aria-hidden />
                          </IconButton>
                        </div>
                      </div>
                      {expanded && (
                        <div id="montage2-filters" className={styles.advanced}>
                          <Divider />
                          <Montage2Filters
                            filters={filters}
                            setFilters={state.setFilters}
                            locale={locale}
                            disabled={busy}
                          />
                          <div className={styles.applyRow}>
                            <TextButton
                              type="button"
                              color="assistive"
                              disabled={busy}
                              onClick={() => state.reset()}
                            >
                              {t("Reset all", "모든 조건 초기화", "重置全部")}
                            </TextButton>
                            <Button
                              type="submit"
                              size="medium"
                              loading={busy}
                              disabled={!data}
                            >
                              {t("Apply filters", "필터 적용", "应用筛选")}
                            </Button>
                          </div>
                        </div>
                      )}
                      {dirty && (
                        <Typography
                          as="p"
                          variant="caption1"
                          color="semantic.foreground.brand.primary"
                        >
                          {t(
                            "Apply your updated criteria to refresh the results.",
                            "변경한 조건을 적용하려면 검색하기를 눌러주세요.",
                            "点击搜索以应用更新后的条件。",
                          )}
                        </Typography>
                      )}
                    </form>
                  )}
                </TabPanel>
              ))}
            </Tab>
          </section>

          <div className={styles.demoNotice}>
            <ContentBadge size="small">
              {t("Demo", "데모", "演示")}
            </ContentBadge>
            <Typography
              as="p"
              variant="caption1"
              color="semantic.foreground.neutral.tertiary"
            >
              {t(
                "Profiles and metrics are fictional. Searches and collections are saved to your workspace.",
                "프로필과 지표는 가상 데이터입니다. 검색 이력과 즐겨찾기는 작업 공간에 저장됩니다.",
                "达人与指标为虚构数据。搜索记录与收藏保存在工作区。",
              )}
            </Typography>
          </div>
          {error && (
            <SectionMessage
              variant="negative"
              role="alert"
              description={error}
              trailingButton={
                <TextButton
                  size="small"
                  disabled={busy}
                  onClick={() => void state.reload()}
                >
                  {t("Refresh", "새로고침", "刷新")}
                </TextButton>
              }
            >
              {t("Please check", "확인이 필요해요", "请检查")}
            </SectionMessage>
          )}
          {notice && (
            <SectionMessage
              variant="positive"
              role="status"
              description={notice}
            >
              {t("Workspace updated", "작업 공간 업데이트", "工作区已更新")}
            </SectionMessage>
          )}

          <Montage2Results
            locale={locale}
            state={state}
            onProfile={setProfile}
          />

          {!!data?.recentSearches.length && (
            <section
              className={styles.history}
              aria-label={t("Recent searches", "최근 검색", "最近搜索")}
            >
              <div className={styles.historyLabel}>
                <IconClock aria-hidden />
                <Typography
                  variant="label2"
                  weight="medium"
                  color="semantic.foreground.neutral.secondary"
                >
                  {t("Recent searches", "최근 검색", "最近搜索")}
                </Typography>
              </div>
              {data.recentSearches
                .filter((run) => run.mode === "search")
                .slice(0, 3)
                .map((run) => (
                  <div className={styles.historyItem} key={run.id}>
                    <Typography variant="label2">
                      {run.query ||
                        t("Filtered search", "조건 검색", "条件搜索")}
                    </Typography>
                    <Typography
                      variant="caption1"
                      color="semantic.foreground.neutral.tertiary"
                    >
                      {new Date(run.createdAt).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Typography>
                  </div>
                ))}
            </section>
          )}
          <footer className={styles.footer}>
            <Typography
              variant="caption1"
              color="semantic.foreground.neutral.tertiary"
            >
              © Futures Medialab
            </Typography>
            <TextButton
              as={Link}
              href={`/storage/search/montage?lang=${locale}`}
              color="assistive"
              size="small"
            >
              {t("View Montage 1", "Montage 1 비교하기", "查看 Montage 1")}
            </TextButton>
          </footer>
        </div>
      </main>

      <Modal
        open={!!profile}
        onOpenChange={(open) => {
          if (!open) setProfile(null);
        }}
      >
        <ModalContainer
          size="medium"
          variant="popup"
          className={styles.profileDialog}
          aria-label={profile?.name}
        >
          <ModalNavigation
            trailingContent={
              <ModalNavigationButton
                variant="close-button"
                aria-label={t("Close profile", "프로필 닫기", "关闭资料")}
              />
            }
          >
            {t("Creator profile", "크리에이터 프로필", "达人资料")}
          </ModalNavigation>
          {profile && (
            <ModalContent gap="24px" verticalPadding="bottom-only">
              <div className={styles.profileHeading}>
                <Avatar size="xlarge" alt="" />
                <div className={styles.profileTitle}>
                  <ContentBadge size="small">
                    {t("Demo profile", "가상 프로필", "虚构资料")}
                  </ContentBadge>
                  <Typography as="h2" variant="title3" weight="bold">
                    {profile.name.replace(/\s*\(Demo\)$/, "")}
                  </Typography>
                  <Typography
                    variant="label1"
                    color="semantic.foreground.neutral.secondary"
                  >
                    {profile.handle} · {platformNames[profile.platform]}
                  </Typography>
                </div>
              </div>
              <div className={styles.profileStats}>
                {[
                  [
                    t("Followers", "팔로워", "粉丝"),
                    compact(profile.followers),
                  ],
                  [
                    t("Average views", "평균 조회수", "平均播放量"),
                    compact(
                      profile[
                        (applied ?? filters).viewsWindow === "last10"
                          ? "views10"
                          : "views30"
                      ],
                    ),
                  ],
                  [
                    t("Engagement", "참여율", "互动率"),
                    `${profile.engagement.toFixed(1)}%`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <Typography variant="title3" weight="bold">
                      {value}
                    </Typography>
                    <Typography
                      variant="caption1"
                      color="semantic.foreground.neutral.tertiary"
                    >
                      {label}
                    </Typography>
                  </div>
                ))}
              </div>
              <Divider />
              <div className={styles.profileSection}>
                <Typography variant="label1" weight="bold">
                  {t("Topics", "콘텐츠 주제", "内容主题")}
                </Typography>
                <div className={styles.chips}>
                  {profile.tags.map((tag) => (
                    <ContentBadge key={tag} size="medium">
                      {tagLabel(tag, locale)}
                    </ContentBadge>
                  ))}
                </div>
              </div>
              <div className={styles.profileSection}>
                <Typography variant="label1" weight="bold">
                  {t("Example posts", "예시 게시물", "示例内容")}
                </Typography>
                {profile.content.map((content) => (
                  <Typography
                    key={content}
                    as="p"
                    variant="body2"
                    color="semantic.foreground.neutral.secondary"
                  >
                    {content}
                  </Typography>
                ))}
              </div>
              {error && (
                <SectionMessage
                  variant="negative"
                  role="alert"
                  description={error}
                >
                  {t("Please check", "확인이 필요해요", "请检查")}
                </SectionMessage>
              )}
              {notice && (
                <Typography
                  variant="label2"
                  role="status"
                  color="semantic.foreground.brand.primary"
                >
                  {notice}
                </Typography>
              )}
              {state.activeCollection ? (
                <Button
                  disabled={busy}
                  loading={busy}
                  leadingContent={<IconBookmark aria-hidden />}
                  onClick={() => void state.saveCreator(profile)}
                >
                  {state.activeCollection.creatorIds.includes(profile.id)
                    ? t("Remove from collection", "즐겨찾기 해제", "取消收藏")
                    : t("Save creator", "크리에이터 저장", "收藏达人")}
                </Button>
              ) : (
                <Button
                  as={Link}
                  href={`/storage/collect?lang=${locale}`}
                  leadingContent={<IconBookmark aria-hidden />}
                >
                  {t(
                    "Create a collection",
                    "즐겨찾기 폴더 만들기",
                    "创建收藏夹",
                  )}
                </Button>
              )}
            </ModalContent>
          )}
        </ModalContainer>
      </Modal>
    </div>
  );
}
