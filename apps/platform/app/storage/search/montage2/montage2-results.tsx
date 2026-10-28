"use client";

import Link from "next/link";
import {
  Avatar,
  Button,
  ContentBadge,
  IconButton,
  Loading,
  Option,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Typography,
} from "@montage-ui/core";
import {
  IconBookmark,
  IconBookmarkFill,
  IconFolder,
  IconListOrdered,
  IconSearch,
} from "@montage-ui/icon";
import type { Locale } from "../../../_components/landing-copy";
import type { Creator } from "../../../../lib/creator-directory";
import {
  platformNames,
  tagLabel,
  translate,
} from "../../_components/directory-filters";
import type { useMontageSearch } from "../montage/use-montage-search";
import styles from "./montage2-results.module.css";

type Props = {
  locale: Locale;
  state: ReturnType<typeof useMontageSearch>;
  onProfile: (creator: Creator) => void;
};

export function Montage2Results({ locale, state, onProfile }: Props) {
  const {
    data,
    error,
    busy,
    sorted,
    sort,
    page,
    pages,
    activeCollection,
    applied,
    filters,
  } = state;
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const resultFilters = applied ?? filters;
  const isDirty =
    applied && JSON.stringify(applied) !== JSON.stringify(filters);
  const visibleCreators = sorted.slice((page - 1) * 8, page * 8);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const count = data
    ? new Intl.NumberFormat(locale).format(sorted.length)
    : "—";
  const countries: Record<string, string> = {
    KR: t("South Korea", "대한민국", "韩国"),
    US: t("United States", "미국", "美国"),
    JP: t("Japan", "일본", "日本"),
    CN: t("China", "중국", "中国"),
    GB: t("United Kingdom", "영국", "英国"),
    SG: t("Singapore", "싱가포르", "新加坡"),
  };
  const viewsWindowLabel =
    resultFilters.viewsWindow === "last10"
      ? t("Last 10 posts", "최근 게시물 10개", "最近10条")
      : t("Last 30 days", "최근 30일", "最近30天");
  const averageViews = (creator: Creator) =>
    number(
      creator[resultFilters.viewsWindow === "last10" ? "views10" : "views30"],
    );
  const lastPosted = (creator: Creator) =>
    creator.daysSincePosted === 0
      ? t("Today", "오늘", "今天")
      : t(
          `${creator.daysSincePosted}d ago`,
          `${creator.daysSincePosted}일 전`,
          `${creator.daysSincePosted}天前`,
        );

  function profile(creator: Creator) {
    return (
      <button
        type="button"
        className={styles.profile}
        onClick={() => onProfile(creator)}
        aria-label={t(
          `View ${creator.name}'s profile`,
          `${creator.name} 프로필 보기`,
          `查看${creator.name}的资料`,
        )}
      >
        <Avatar size="medium" alt="" />
        <span className={styles.profileText}>
          <Typography
            as="span"
            variant="body1"
            weight="bold"
            display="block"
            noWrap
          >
            {creator.name.replace(/\s*\(Demo\)$/, "")}
          </Typography>
          <Typography
            as="span"
            variant="caption1"
            color="semantic.foreground.neutral.secondary"
            display="block"
            noWrap
          >
            {countries[creator.country] ?? creator.country} · {creator.handle}
          </Typography>
        </span>
      </button>
    );
  }

  function topics(creator: Creator) {
    return (
      <div className={styles.topics}>
        {creator.tags.slice(0, 2).map((tag) => (
          <ContentBadge key={tag} size="small" color="neutral">
            {tagLabel(tag, locale)}
          </ContentBadge>
        ))}
      </div>
    );
  }

  function saveButton(creator: Creator) {
    const saved = activeCollection?.creatorIds.includes(creator.id) ?? false;
    return (
      <IconButton
        size="xlarge"
        aria-label={`${saved ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
        aria-pressed={saved}
        disabled={busy}
        color={
          saved
            ? "semantic.foreground.brand.primary"
            : "semantic.foreground.neutral.secondary"
        }
        onClick={() => void state.saveCreator(creator)}
      >
        {saved ? <IconBookmarkFill /> : <IconBookmark />}
      </IconButton>
    );
  }

  return (
    <section
      className={styles.results}
      aria-label={t("Creator results", "크리에이터 검색 결과", "达人搜索结果")}
      aria-busy={busy}
    >
      <div className={styles.toolbar}>
        <div className={styles.heading}>
          <Typography as="h2" variant="heading2" weight="bold">
            {applied
              ? t("Search results", "검색 결과", "搜索结果")
              : t("Creators", "크리에이터", "达人")}{" "}
            <Typography
              as="span"
              variant="heading2"
              weight="bold"
              color="semantic.foreground.brand.primary"
            >
              {t(count, `${count}명`, `${count}位`)}
            </Typography>
          </Typography>
          <Typography
            as="p"
            variant="label2"
            color="semantic.foreground.neutral.secondary"
            aria-live="polite"
          >
            {isDirty
              ? t(
                  "Filters changed. Search to apply them.",
                  "검색 조건이 변경됐어요. 검색하기를 눌러 적용해 주세요.",
                  "筛选已更改，请点击搜索应用。",
                )
              : t(
                  `${platformNames[resultFilters.platform]} creators for your next collaboration`,
                  `다음 협업을 위한 ${platformNames[resultFilters.platform]} 크리에이터`,
                  `寻找下一次合作的${platformNames[resultFilters.platform]}达人`,
                )}
          </Typography>
        </div>
        <div className={styles.controls}>
          <div className={styles.collectionControl}>
            {data && data.collections.length > 0 ? (
              <Select
                size="medium"
                width="100%"
                aria-label={t("Save to collection", "저장할 폴더", "收藏至")}
                leadingContent={<IconFolder />}
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
              <Button
                as={Link}
                href={`/storage/collect?lang=${locale}`}
                variant="outlined"
                color="assistive"
                size="medium"
                leadingContent={<IconFolder />}
              >
                {t("Create a folder", "저장 폴더 만들기", "创建收藏夹")}
              </Button>
            )}
          </div>
          <div className={styles.sortControl}>
            <Select
              size="medium"
              width="100%"
              aria-label={t("Sort by", "정렬", "排序")}
              leadingContent={<IconListOrdered />}
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
              <Option value="views">{t("Views", "조회수순", "播放量")}</Option>
              <Option value="engagement">
                {t("Engagement", "참여율순", "互动率")}
              </Option>
            </Select>
          </div>
        </div>
      </div>

      {!data ? (
        <div className={styles.status} role="status">
          {busy ? (
            <Loading variant="circular" size="var(--dimension-24)" />
          ) : null}
          <Typography
            as="p"
            variant="body1"
            color="semantic.foreground.neutral.secondary"
          >
            {error && !busy
              ? t(
                  "Workspace unavailable",
                  "작업 공간을 불러올 수 없습니다",
                  "工作区不可用",
                )
              : t(
                  "Loading creators…",
                  "크리에이터를 불러오고 있어요…",
                  "正在加载达人…",
                )}
          </Typography>
          {error && !busy ? (
            <Button
              variant="outlined"
              size="medium"
              onClick={() => void state.reload()}
            >
              {t("Try again", "다시 불러오기", "重新加载")}
            </Button>
          ) : null}
        </div>
      ) : sorted.length ? (
        <>
          <div className={styles.desktopTable}>
            <Table>
              <caption className={styles.srOnly}>
                {t(
                  "Creator profiles and performance metrics",
                  "크리에이터 프로필과 성과 지표",
                  "达人资料与表现数据",
                )}
              </caption>
              <TableHead>
                <TableRow>
                  <TableHeadCell scope="col">
                    {t("Creator", "크리에이터", "达人")}
                  </TableHeadCell>
                  <TableHeadCell scope="col" align="right">
                    {t("Followers", "팔로워", "粉丝数")}
                  </TableHeadCell>
                  <TableHeadCell scope="col" align="right">
                    {t("Average views", "평균 조회수", "平均播放量")}
                  </TableHeadCell>
                  <TableHeadCell scope="col">
                    {t("Topics", "콘텐츠 주제", "内容主题")}
                  </TableHeadCell>
                  <TableHeadCell scope="col" align="right">
                    {t("Engagement", "참여율", "互动率")}
                  </TableHeadCell>
                  <TableHeadCell scope="col" align="right">
                    {t("Last posted", "최근 게시", "最近发布")}
                  </TableHeadCell>
                  <TableHeadCell scope="col" align="center">
                    {t("Save", "저장", "收藏")}
                  </TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleCreators.map((creator) => (
                  <TableRow key={creator.id}>
                    <TableCell>{profile(creator)}</TableCell>
                    <TableCell align="right" className={styles.numeric}>
                      {number(creator.followers)}
                    </TableCell>
                    <TableCell align="right" className={styles.numeric}>
                      {averageViews(creator)}
                      <Typography
                        as="span"
                        variant="caption1"
                        display="block"
                        color="semantic.foreground.neutral.secondary"
                      >
                        {viewsWindowLabel}
                      </Typography>
                    </TableCell>
                    <TableCell>{topics(creator)}</TableCell>
                    <TableCell align="right" className={styles.numeric}>
                      {creator.engagement.toFixed(1)}%
                    </TableCell>
                    <TableCell
                      align="right"
                      color="semantic.foreground.neutral.secondary"
                      className={styles.numeric}
                    >
                      {lastPosted(creator)}
                    </TableCell>
                    <TableCell align="center">{saveButton(creator)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className={styles.mobileList}>
            {visibleCreators.map((creator) => (
              <li key={creator.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeading}>
                  {profile(creator)}
                  {saveButton(creator)}
                </div>
                {topics(creator)}
                <dl className={styles.mobileMetrics}>
                  <div>
                    <Typography
                      as="dt"
                      variant="caption1"
                      color="semantic.foreground.neutral.secondary"
                    >
                      {t("Followers", "팔로워", "粉丝数")}
                    </Typography>
                    <Typography as="dd" variant="body1" weight="bold">
                      {number(creator.followers)}
                    </Typography>
                  </div>
                  <div>
                    <Typography
                      as="dt"
                      variant="caption1"
                      color="semantic.foreground.neutral.secondary"
                    >
                      {t("Average views", "평균 조회수", "平均播放量")}
                    </Typography>
                    <Typography as="dd" variant="body1" weight="bold">
                      {averageViews(creator)}
                    </Typography>
                  </div>
                  <div>
                    <Typography
                      as="dt"
                      variant="caption1"
                      color="semantic.foreground.neutral.secondary"
                    >
                      {t("Engagement", "참여율", "互动率")}
                    </Typography>
                    <Typography as="dd" variant="body1" weight="bold">
                      {creator.engagement.toFixed(1)}%
                    </Typography>
                  </div>
                </dl>
                <div className={styles.mobileCardFoot}>
                  <Typography
                    as="span"
                    variant="caption1"
                    color="semantic.foreground.neutral.secondary"
                  >
                    {t("Views", "조회수 기준", "播放量")} · {viewsWindowLabel}
                  </Typography>
                  <Typography
                    as="span"
                    variant="caption1"
                    color="semantic.foreground.neutral.secondary"
                  >
                    {t("Last posted", "최근 게시", "最近发布")} ·{" "}
                    {lastPosted(creator)}
                  </Typography>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.pagination}>
            <Typography
              as="p"
              variant="label2"
              color="semantic.foreground.neutral.secondary"
              className={styles.range}
            >
              {t(
                `${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)} of ${count} creators`,
                `전체 ${count}명 중 ${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)}명`,
                `共${count}位达人，第${(page - 1) * 8 + 1}–${Math.min(page * 8, sorted.length)}位`,
              )}
            </Typography>
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
        <div className={styles.status}>
          <IconSearch className={styles.emptyIcon} aria-hidden="true" />
          <Typography as="h3" variant="headline1" weight="bold">
            {t(
              "No matching creators",
              "일치하는 크리에이터가 없어요",
              "没有符合条件的达人",
            )}
          </Typography>
          <Typography
            as="p"
            variant="body2"
            color="semantic.foreground.neutral.secondary"
          >
            {t(
              "Try another keyword or broaden your filters.",
              "다른 키워드를 입력하거나 검색 조건을 넓혀보세요.",
              "请尝试其他关键词或放宽筛选条件。",
            )}
          </Typography>
          <Button
            variant="outlined"
            size="medium"
            disabled={busy}
            onClick={() => state.reset()}
          >
            {t("Reset search", "검색 조건 초기화", "重置搜索")}
          </Button>
        </div>
      )}
    </section>
  );
}
