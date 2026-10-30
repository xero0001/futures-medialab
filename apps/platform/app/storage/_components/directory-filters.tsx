"use client";

import { BrandInput } from "./brand-controls";

import type { Locale } from "../../_components/landing-copy";
import { BrandSelect as ProfileSelect } from "./brand-controls";
import {
  DIRECTORY_TAGS,
  platformCapabilities,
  type DirectoryFilters,
} from "../../../lib/creator-directory";

export const translate = (locale: Locale, en: string, ko: string, zh: string) =>
  ({ en, ko, zh })[locale];
export const platformNames = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitch: "Twitch",
  x: "X",
  facebook: "Facebook",
};
export function tagLabel(tag: string, locale: Locale) {
  const names: Record<string, [string, string, string]> = {
    lineage: ["Lineage", "리니지", "天堂"],
    maplestory: ["MapleStory", "메이플스토리", "冒险岛"],
    lostark: ["Lost Ark", "로스트아크", "失落的方舟"],
    gaming: ["Gaming", "게임", "游戏"],
    rpg: ["RPG", "RPG", "角色扮演"],
    strategy: ["Strategy", "전략", "策略"],
    esports: ["Esports", "이스포츠", "电竞"],
    anime: ["Anime", "애니메이션", "动漫"],
    technology: ["Technology", "테크", "科技"],
    lifestyle: ["Lifestyle", "라이프스타일", "生活方式"],
    entertainment: ["Entertainment", "엔터테인먼트", "娱乐"],
    travel: ["Travel", "여행", "旅行"],
    food: ["Food", "푸드", "美食"],
    mukbang: ["Mukbang", "먹방", "吃播"],
    reviews: ["Reviews", "리뷰", "评测"],
    economy: ["Economy", "경제", "经济"],
    knowledge: ["Knowledge", "지식", "知识"],
    talk: ["Talk", "토크", "访谈"],
    comedy: ["Comedy", "코미디", "喜剧"],
    fitness: ["Fitness", "운동", "健身"],
    cooking: ["Cooking", "요리", "烹饪"],
  };
  const values = names[tag];
  return values ? translate(locale, ...values) : tag;
}
export function DirectoryFiltersPanel({
  filters,
  setFilters,
  locale,
  compact = false,
}: {
  filters: DirectoryFilters;
  setFilters: (filters: DirectoryFilters) => void;
  locale: Locale;
  compact?: boolean;
}) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const caps = platformCapabilities(filters.platform);
  const update = (key: keyof DirectoryFilters, value: string | string[]) =>
    setFilters({ ...filters, [key]: value });
  const all = t("Any", "전체", "全部");
  const countries = [
    ["KR", t("South Korea", "대한민국", "韩国")],
    ["US", t("United States", "미국", "美国")],
    ["JP", t("Japan", "일본", "日本")],
    ["CN", t("China", "중국", "中国")],
    ["GB", t("United Kingdom", "영국", "英国")],
    ["SG", t("Singapore", "싱가포르", "新加坡")],
  ];
  const languages = [
    ["en", "English"],
    ["ko", "한국어"],
    ["zh", "中文"],
    ["ja", "日本語"],
  ];
  function select(
    key: keyof DirectoryFilters,
    label: string,
    options: string[][],
    includeAny = true,
  ) {
    return (
      <ProfileSelect
        id={`filter-${key}`}
        label={label}
        placeholder={all}
        value={String(filters[key])}
        onChange={(value) => update(key, value)}
        options={[
          ...(includeAny ? [{ value: "", label: all }] : []),
          ...options.map(([value = "", label = ""]) => ({ value, label })),
        ]}
      />
    );
  }
  function range(
    label: string,
    min: "followersMin" | "viewsMin",
    max: "followersMax" | "viewsMax",
  ) {
    return (
      <fieldset className="cw-range">
        <legend>
          {label} <span>(K)</span>
        </legend>
        <div>
          <BrandInput
            aria-label={`${label} ${t("minimum", "최솟값", "最小值")}`}
            placeholder={t("Min", "최소", "最小")}
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            value={filters[min]}
            onChange={(e) => update(min, e.target.value)}
          />
          <span>–</span>
          <BrandInput
            aria-label={`${label} ${t("maximum", "최댓값", "最大值")}`}
            placeholder={t("Max", "최대", "最大")}
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            value={filters[max]}
            onChange={(e) => update(max, e.target.value)}
          />
        </div>
      </fieldset>
    );
  }
  return (
    <div className={`cw-filters ${compact ? "cw-filters-compact" : ""}`}>
      {!compact && (
        <section className="cw-filter-section">
          <h3>{t("Content", "콘텐츠", "内容属性")}</h3>
          <div className="cw-grid">
            {caps.videoType &&
              select(
                "videoType",
                t("Video type", "영상 유형", "视频类型"),
                [
                  ["all", all],
                  ["video", t("Videos", "일반 영상", "长视频")],
                  ["shorts", "Shorts"],
                  ["live", t("Live", "라이브", "直播")],
                ],
                false,
              )}
            {select(
              "tagMatch",
              t("Match included topics", "포함 주제 조건", "主题匹配方式"),
              [
                ["any", t("Any topic (OR)", "하나 이상 (OR)", "任意主题 (OR)")],
                [
                  "all",
                  t("All topics (AND)", "모두 포함 (AND)", "所有主题 (AND)"),
                ],
              ],
              false,
            )}
            {(["includeTags", "excludeTags"] as const).map((key) => (
              <fieldset className="cw-topic-field" key={key}>
                <legend>
                  {key === "includeTags"
                    ? t("Include topics", "주제 포함", "包含主题")
                    : t("Exclude topics", "주제 제외", "排除主题")}
                </legend>
                <details>
                  <summary>
                    {filters[key].length
                      ? filters[key]
                          .map((tag) => tagLabel(tag, locale))
                          .join(", ")
                      : all}
                  </summary>
                  <div className="cw-topic-menu">
                    {DIRECTORY_TAGS.map((tag) => (
                      <label key={tag}>
                        <BrandInput
                          type="checkbox"
                          checked={filters[key].includes(tag)}
                          onChange={(event) =>
                            update(
                              key,
                              event.target.checked
                                ? [...filters[key], tag]
                                : filters[key].filter((item) => item !== tag),
                            )
                          }
                        />
                        {tagLabel(tag, locale)}
                      </label>
                    ))}
                  </div>
                </details>
              </fieldset>
            ))}
            {caps.keywords && (
              <>
                <label className="cw-field">
                  {t(
                    "Include channel keywords",
                    "채널 키워드 포함",
                    "包含频道关键词",
                  )}
                  <BrandInput
                    value={filters.keywordInclude}
                    placeholder={t(
                      "Separate with commas",
                      "쉼표로 구분",
                      "用逗号分隔",
                    )}
                    onChange={(e) => update("keywordInclude", e.target.value)}
                  />
                </label>
                <label className="cw-field">
                  {t(
                    "Exclude channel keywords",
                    "채널 키워드 제외",
                    "排除频道关键词",
                  )}
                  <BrandInput
                    value={filters.keywordExclude}
                    onChange={(e) => update("keywordExclude", e.target.value)}
                  />
                </label>
                {select(
                  "keywordMatch",
                  t("Match keywords", "키워드 조건", "关键词匹配"),
                  [
                    ["any", "OR"],
                    ["all", "AND"],
                  ],
                  false,
                )}
              </>
            )}
          </div>
        </section>
      )}
      <section className="cw-filter-section">
        <h3>{t("Channel", "채널", "频道属性")}</h3>
        <div className="cw-grid">
          {select(
            "country",
            t("Country / region", "국가 / 지역", "国家 / 地区"),
            countries,
          )}
          {range(
            t("Followers", "팔로워", "粉丝数"),
            "followersMin",
            "followersMax",
          )}
          {select(
            "viewsWindow",
            t("Views measured over", "조회수 집계 기준", "播放量统计周期"),
            [
              ["last10", t("Last 10 posts", "최근 게시물 10개", "最近10条")],
              ["last30", t("Last 30 days", "최근 30일", "最近30天")],
            ],
            false,
          )}
          {range(
            t("Average views", "평균 조회수", "平均播放量"),
            "viewsMin",
            "viewsMax",
          )}
          {!compact &&
            caps.volatility &&
            select(
              "volatility",
              t("View volatility", "조회수 변동성", "播放量波动率"),
              [
                ["low", t("Low", "낮음", "低")],
                ["medium", t("Medium", "보통", "中")],
                ["high", t("High", "높음", "高")],
              ],
            )}
          {!compact &&
            select(
              "lastPosted",
              t("Last published", "최근 게시일", "最近发布时间"),
              [
                ["7", t("Within 7 days", "7일 이내", "7天内")],
                ["30", t("Within 30 days", "30일 이내", "30天内")],
                ["90", t("Within 90 days", "90일 이내", "90天内")],
              ],
            )}
          {select(
            "language",
            t("Content language", "콘텐츠 언어", "内容语言"),
            languages,
          )}
        </div>
      </section>
      {!compact && (
        <section className="cw-filter-section">
          <h3>{t("Audience", "시청자", "受众属性")}</h3>
          <div className="cw-grid">
            {select(
              "audienceCountry",
              t("Audience country", "시청자 국가", "受众国家"),
              countries,
            )}
            {select(
              "audienceAge",
              t("Primary age group", "주요 연령대", "主要年龄段"),
              [
                ["18-24", "18–24"],
                ["25-34", "25–34"],
                ["35-44", "35–44"],
                ["45+", "45+"],
              ],
            )}
            {select(
              "audienceGender",
              t("Audience gender", "시청자 성별", "受众性别"),
              [
                ["male", t("Mostly male", "남성 중심", "男性为主")],
                ["female", t("Mostly female", "여성 중심", "女性为主")],
                ["mixed", t("Mixed", "혼합", "均衡")],
              ],
            )}
          </div>
        </section>
      )}
    </div>
  );
}
