"use client";

import { Chip, Option, Select, TextField } from "@montage-ui/core";
import { ChevronDown } from "lucide-react";
import type { Locale } from "../../../_components/landing-copy";
import {
  DIRECTORY_TAGS,
  platformCapabilities,
  type DirectoryFilters,
} from "../../../../lib/creator-directory";
import { tagLabel, translate } from "../../_components/directory-filters";
import styles from "./montage-filters.module.css";

export function MontageFilters({
  filters,
  setFilters,
  locale,
  disabled = false,
}: {
  filters: DirectoryFilters;
  setFilters: (filters: DirectoryFilters) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const caps = platformCapabilities(filters.platform);
  const update = <K extends keyof DirectoryFilters>(
    key: K,
    value: DirectoryFilters[K],
  ) => setFilters({ ...filters, [key]: value });
  const all = t("Any", "전체", "全部");
  const countries: [string, string][] = [
    ["KR", t("South Korea", "대한민국", "韩国")],
    ["US", t("United States", "미국", "美国")],
    ["JP", t("Japan", "일본", "日本")],
    ["CN", t("China", "중국", "中国")],
    ["GB", t("United Kingdom", "영국", "英国")],
    ["SG", t("Singapore", "싱가포르", "新加坡")],
  ];
  const languages: [string, string][] = [
    ["en", "English"],
    ["ko", "한국어"],
    ["zh", "中文"],
    ["ja", "日本語"],
  ];

  function select<K extends keyof DirectoryFilters>(
    key: K,
    label: string,
    options: [string, string][],
    includeAny = true,
  ) {
    const id = `montage-filter-${key}`;
    return (
      <div className={styles.field}>
        <span id={`${id}-label`}>{label}</span>
        <Select
          id={id}
          aria-labelledby={`${id}-label`}
          size="medium"
          width="100%"
          disabled={disabled}
          placeholder={all}
          value={String(filters[key])}
          onChange={(value) => update(key, value as DirectoryFilters[K])}
        >
          {includeAny && <Option value="">{all}</Option>}
          {options.map(([value, text]) => (
            <Option key={value} value={value}>
              {text}
            </Option>
          ))}
        </Select>
      </div>
    );
  }

  function range(
    label: string,
    min: "followersMin" | "viewsMin",
    max: "followersMax" | "viewsMax",
  ) {
    return (
      <fieldset className={styles.field}>
        <legend>
          {label} <span className={styles.unit}>(K)</span>
        </legend>
        <div className={styles.range}>
          <TextField
            size="medium"
            width="100%"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            disabled={disabled}
            aria-label={`${label} ${t("minimum", "최솟값", "最小值")}`}
            placeholder={t("Min", "최소", "最小")}
            value={filters[min]}
            onChange={(event) => update(min, event.target.value)}
          />
          <span aria-hidden="true">–</span>
          <TextField
            size="medium"
            width="100%"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            disabled={disabled}
            aria-label={`${label} ${t("maximum", "최댓값", "最大值")}`}
            placeholder={t("Max", "최대", "最大")}
            value={filters[max]}
            onChange={(event) => update(max, event.target.value)}
          />
        </div>
      </fieldset>
    );
  }

  function topics(key: "includeTags" | "excludeTags", label: string) {
    const id = `montage-filter-${key}`;
    return (
      <fieldset className={styles.field}>
        <legend id={`${id}-label`}>{label}</legend>
        <details className={styles.topics}>
          <summary aria-labelledby={`${id}-label ${id}-value`}>
            <span id={`${id}-value`}>
              {filters[key].length
                ? filters[key].map((tag) => tagLabel(tag, locale)).join(", ")
                : all}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className={styles.topicOptions} role="group" aria-label={label}>
            {DIRECTORY_TAGS.map((tag) => (
              <Chip
                type="button"
                key={tag}
                size="small"
                variant="outlined"
                disabled={disabled}
                active={filters[key].includes(tag)}
                aria-pressed={filters[key].includes(tag)}
                onClick={() =>
                  update(
                    key,
                    filters[key].includes(tag)
                      ? filters[key].filter((item) => item !== tag)
                      : [...filters[key], tag],
                  )
                }
              >
                {tagLabel(tag, locale)}
              </Chip>
            ))}
          </div>
        </details>
      </fieldset>
    );
  }

  return (
    <div className={styles.filters}>
      <section
        className={styles.section}
        aria-labelledby="montage-content-filters"
      >
        <h3 id="montage-content-filters">{t("Content", "콘텐츠", "内容")}</h3>
        <div className={styles.grid}>
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
          {topics("includeTags", t("Include topics", "주제 포함", "包含主题"))}
          {topics("excludeTags", t("Exclude topics", "주제 제외", "排除主题"))}
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
          {caps.keywords && (
            <>
              <label className={styles.field}>
                <span>
                  {t(
                    "Include channel keywords",
                    "채널 키워드 포함",
                    "包含频道关键词",
                  )}
                </span>
                <TextField
                  size="medium"
                  width="100%"
                  disabled={disabled}
                  value={filters.keywordInclude}
                  placeholder={t(
                    "Separate with commas",
                    "쉼표로 구분",
                    "用逗号分隔",
                  )}
                  onChange={(event) =>
                    update("keywordInclude", event.target.value)
                  }
                />
              </label>
              <label className={styles.field}>
                <span>
                  {t(
                    "Exclude channel keywords",
                    "채널 키워드 제외",
                    "排除频道关键词",
                  )}
                </span>
                <TextField
                  size="medium"
                  width="100%"
                  disabled={disabled}
                  value={filters.keywordExclude}
                  placeholder={t(
                    "Separate with commas",
                    "쉼표로 구분",
                    "用逗号分隔",
                  )}
                  onChange={(event) =>
                    update("keywordExclude", event.target.value)
                  }
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

      <section
        className={styles.section}
        aria-labelledby="montage-channel-filters"
      >
        <div className={styles.sectionHeading}>
          <h3 id="montage-channel-filters">{t("Channel", "채널", "频道")}</h3>
          <span>
            {t(
              "Range unit K = 1,000",
              "숫자 범위 단위 K = 1,000",
              "范围单位 K = 1,000",
            )}
          </span>
        </div>
        <div className={styles.grid}>
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
          {range(
            t("Average views", "평균 조회수", "平均播放量"),
            "viewsMin",
            "viewsMax",
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
          {caps.volatility &&
            select(
              "volatility",
              t("View volatility", "조회수 변동성", "播放量波动率"),
              [
                ["low", t("Low", "낮음", "低")],
                ["medium", t("Medium", "보통", "中")],
                ["high", t("High", "높음", "高")],
              ],
            )}
          {select(
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

      <section
        className={styles.section}
        aria-labelledby="montage-audience-filters"
      >
        <h3 id="montage-audience-filters">{t("Audience", "시청자", "受众")}</h3>
        <div className={styles.grid}>
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
    </div>
  );
}
