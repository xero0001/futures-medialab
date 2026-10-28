"use client";

import { useId } from "react";
import { Checkbox, Chip, Field, TextField } from "@seed-design/react";
import { ChevronDown } from "lucide-react";
import type { Locale } from "../../../_components/landing-copy";
import {
  DIRECTORY_TAGS,
  platformCapabilities,
  type DirectoryFilters,
} from "../../../../lib/creator-directory";
import { tagLabel, translate } from "../../_components/directory-filters";

type SelectOption = { value: string; label: string };

export function SeedSelect({
  label,
  value,
  onChange,
  options,
  id,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? `seed-select-${generatedId}`;
  const hasValue = options.some((option) => option.value === value);

  return (
    <Field.Root className="seed-search-select-field">
      <Field.Label asChild>
        <label htmlFor={selectId}>{label}</label>
      </Field.Label>
      <div className="seed-search-select-wrap">
        <select
          id={selectId}
          className="seed-search-select"
          value={hasValue ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || options.length === 0}
        >
          {!hasValue && (
            <option value="" disabled>
              {placeholder ?? label}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="seed-search-select-chevron"
          aria-hidden="true"
        />
      </div>
    </Field.Root>
  );
}

export function SeedFilters({
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
  const all = t("Any", "전체", "全部");
  const update = <Key extends keyof DirectoryFilters>(
    key: Key,
    value: DirectoryFilters[Key],
  ) => setFilters({ ...filters, [key]: value });
  const countries: [string, string][] = [
    ["KR", t("South Korea", "대한민국", "韩国")],
    ["US", t("United States", "미국", "美国")],
    ["JP", t("Japan", "일본", "日本")],
    ["CN", t("China", "중국", "中国")],
    ["GB", t("United Kingdom", "영국", "英国")],
    ["SG", t("Singapore", "싱가포르", "新加坡")],
  ];

  function select(
    key: keyof DirectoryFilters,
    label: string,
    options: [string, string][],
    includeAny = true,
  ) {
    return (
      <SeedSelect
        id={`seed-filter-${key}`}
        label={label}
        value={String(filters[key])}
        onChange={(value) => update(key, value)}
        disabled={disabled}
        options={[
          ...(includeAny ? [{ value: "", label: all }] : []),
          ...options.map(([value, optionLabel]) => ({
            value,
            label: optionLabel,
          })),
        ]}
      />
    );
  }

  function range(
    label: string,
    minimum: "followersMin" | "viewsMin",
    maximum: "followersMax" | "viewsMax",
  ) {
    return (
      <fieldset className="seed-search-range" disabled={disabled}>
        <legend>
          {label} <span>(K)</span>
        </legend>
        <div className="seed-search-range-inputs">
          <TextField.Root>
            <TextField.Input
              aria-label={`${label} ${t("minimum", "최솟값", "最小值")}`}
              placeholder={t("Min", "최소", "最小")}
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={filters[minimum]}
              disabled={disabled}
              onChange={(event) => update(minimum, event.target.value)}
            />
          </TextField.Root>
          <span aria-hidden="true">–</span>
          <TextField.Root>
            <TextField.Input
              aria-label={`${label} ${t("maximum", "최댓값", "最大值")}`}
              placeholder={t("Max", "최대", "最大")}
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={filters[maximum]}
              disabled={disabled}
              onChange={(event) => update(maximum, event.target.value)}
            />
          </TextField.Root>
        </div>
      </fieldset>
    );
  }

  function topics(key: "includeTags" | "excludeTags") {
    const label =
      key === "includeTags"
        ? t("Include topics", "주제 포함", "包含主题")
        : t("Exclude topics", "주제 제외", "排除主题");
    return (
      <fieldset className="seed-search-topic-field" disabled={disabled}>
        <legend>{label}</legend>
        <details>
          <summary className="seed-search-topic-summary">
            <span>
              {filters[key].length
                ? filters[key].map((tag) => tagLabel(tag, locale)).join(", ")
                : all}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="seed-search-topic-options">
            {DIRECTORY_TAGS.map((tag) => (
              <Chip.Toggle
                key={tag}
                size="small"
                variant="outlineWeak"
                checked={filters[key].includes(tag)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  update(
                    key,
                    checked
                      ? [...filters[key], tag]
                      : filters[key].filter((item) => item !== tag),
                  )
                }
              >
                <Chip.Label>{tagLabel(tag, locale)}</Chip.Label>
                <Checkbox.HiddenInput
                  aria-label={`${label}: ${tagLabel(tag, locale)}`}
                />
              </Chip.Toggle>
            ))}
          </div>
        </details>
      </fieldset>
    );
  }

  function keywords(key: "keywordInclude" | "keywordExclude", label: string) {
    return (
      <Field.Root className="seed-search-keyword-field">
        <Field.Label>{label}</Field.Label>
        <TextField.Root>
          <TextField.Input
            value={filters[key]}
            disabled={disabled}
            placeholder={t("Separate with commas", "쉼표로 구분", "用逗号分隔")}
            onChange={(event) => update(key, event.target.value)}
          />
        </TextField.Root>
      </Field.Root>
    );
  }

  return (
    <div className="seed-search-filters">
      <section
        className="seed-search-filter-section"
        aria-labelledby="seed-content-filters"
      >
        <h3 id="seed-content-filters">{t("Content", "콘텐츠", "内容属性")}</h3>
        <div className="seed-search-filter-grid">
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
          {topics("includeTags")}
          {topics("excludeTags")}
          {caps.keywords && (
            <>
              {keywords(
                "keywordInclude",
                t(
                  "Include channel keywords",
                  "채널 키워드 포함",
                  "包含频道关键词",
                ),
              )}
              {keywords(
                "keywordExclude",
                t(
                  "Exclude channel keywords",
                  "채널 키워드 제외",
                  "排除频道关键词",
                ),
              )}
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
        className="seed-search-filter-section"
        aria-labelledby="seed-channel-filters"
      >
        <h3 id="seed-channel-filters">{t("Channel", "채널", "频道属性")}</h3>
        <div className="seed-search-filter-grid">
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
            [
              ["en", "English"],
              ["ko", "한국어"],
              ["zh", "中文"],
              ["ja", "日本語"],
            ],
          )}
        </div>
      </section>

      <section
        className="seed-search-filter-section"
        aria-labelledby="seed-audience-filters"
      >
        <h3 id="seed-audience-filters">
          {t("Audience", "시청자", "受众属性")}
        </h3>
        <div className="seed-search-filter-grid">
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
