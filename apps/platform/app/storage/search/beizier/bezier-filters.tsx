"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Checkbox,
  FormControl,
  FormLabel,
  ListItem,
  Select,
  TextField,
  type SelectRef,
} from "@channel.io/bezier-react";

import type { Locale } from "../../../_components/landing-copy";
import { tagLabel, translate } from "../../_components/directory-filters";
import {
  DIRECTORY_TAGS,
  platformCapabilities,
  type DirectoryFilters,
} from "../../../../lib/creator-directory";

export function BezierSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const selectRef = useRef<SelectRef>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusFrame = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [dropdownContainer, setDropdownContainer] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    // The results panel clips its contents; keep menus outside that boundary.
    setDropdownContainer(document.body);
    return () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);

  function cancelPendingFocus() {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = null;
  }

  function close(restoreFocus = false) {
    cancelPendingFocus();
    selectRef.current?.handleHideDropdown();
    setOpen(false);
    if (restoreFocus) {
      (selectRef.current?.getDOMNode() as HTMLElement | null)?.focus();
    }
  }

  function focusOption(last = false) {
    cancelPendingFocus();
    // Bezier mounts its Overlay over successive animation frames. Wait until
    // its options exist instead of dropping the first keyboard-open request.
    let attempts = 0;
    function focusWhenMounted() {
      const items =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      const selected = menuRef.current?.querySelector<HTMLButtonElement>(
        '[aria-selected="true"]',
      );
      const option =
        selected ?? (last ? items?.[items.length - 1] : items?.[0]);
      if (option) {
        option.focus();
        focusFrame.current = null;
      } else if (++attempts < 12) {
        focusFrame.current = requestAnimationFrame(focusWhenMounted);
      } else {
        focusFrame.current = null;
      }
    }
    focusFrame.current = requestAnimationFrame(focusWhenMounted);
  }

  function navigateOptions(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ??
        [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(true);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next]?.focus();
    }
  }

  return (
    <FormControl className="bz-field" id={id} disabled={disabled}>
      <FormLabel id={`${id}-label`} htmlFor={id}>
        {label}
      </FormLabel>
      <Select
        ref={selectRef}
        id={id}
        size="m"
        text={options.find((option) => option.value === value)?.label}
        placeholder={placeholder}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-controls={open ? `${id}-options` : undefined}
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        dropdownClassName="bz-select-dropdown"
        dropdownContainer={dropdownContainer}
        dropdownPosition="bottom-right"
        dropdownKeepInContainer
        dropdownStyle={{ maxWidth: "calc(100vw - 32px)" }}
        onClickTrigger={(event) => {
          setOpen((wasOpen) => !wasOpen);
          if (open) cancelPendingFocus();
          else if (event.detail === 0) focusOption();
        }}
        onHideDropdown={() => {
          cancelPendingFocus();
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) event.currentTarget.click();
            focusOption(event.key === "ArrowUp");
          } else if (event.key === "Escape") {
            close(true);
          }
        }}
      >
        <div
          ref={menuRef}
          id={`${id}-options`}
          className="bz-select-options"
          role="listbox"
          aria-labelledby={`${id}-label`}
          onKeyDown={navigateOptions}
        >
          {options.map((option) => (
            <ListItem
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              tabIndex={-1}
              size="m"
              content={option.label}
              active={value === option.value}
              variant="cobalt"
              onClick={() => {
                onChange(option.value);
                close(true);
              }}
            />
          ))}
        </div>
      </Select>
    </FormControl>
  );
}

export function BezierFiltersPanel({
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
  const update = (key: keyof DirectoryFilters, value: string | string[]) =>
    setFilters({ ...filters, [key]: value });
  const countries = [
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
    options: string[][],
    includeAny = true,
  ) {
    return (
      <BezierSelect
        id={`bz-filter-${key}`}
        label={label}
        value={String(filters[key])}
        placeholder={all}
        disabled={disabled}
        options={[
          ...(includeAny ? [{ value: "", label: all }] : []),
          ...options.map(([value = "", label = ""]) => ({ value, label })),
        ]}
        onChange={(value) => update(key, value)}
      />
    );
  }

  function range(
    label: string,
    min: "followersMin" | "viewsMin",
    max: "followersMax" | "viewsMax",
  ) {
    return (
      <fieldset className="bz-range" disabled={disabled}>
        <legend>
          {label} <span>(K)</span>
        </legend>
        <div className="bz-range-inputs">
          <TextField
            id={`bz-filter-${min}`}
            size="m"
            aria-label={`${label} ${t("minimum in thousands", "최솟값, 천 단위", "最小值，千为单位")}`}
            placeholder={t("Min", "최소", "最小")}
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            value={filters[min]}
            disabled={disabled}
            onChange={(event) => update(min, event.target.value)}
          />
          <span aria-hidden="true">–</span>
          <TextField
            id={`bz-filter-${max}`}
            size="m"
            aria-label={`${label} ${t("maximum in thousands", "최댓값, 천 단위", "最大值，千为单位")}`}
            placeholder={t("Max", "최대", "最大")}
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            value={filters[max]}
            disabled={disabled}
            onChange={(event) => update(max, event.target.value)}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <div className="bz-filters">
      <section
        className="bz-filter-section"
        aria-labelledby="bz-channel-filters"
      >
        <h3 className="bz-filter-title" id="bz-channel-filters">
          {t("Channel", "채널", "频道属性")}
        </h3>
        <div className="bz-filter-grid">
          {select(
            "country",
            t("Country / region", "국가 / 지역", "国家 / 地区"),
            countries,
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
          {select(
            "lastPosted",
            t("Last published", "최근 게시일", "最近发布时间"),
            [
              ["7", t("Within 7 days", "7일 이내", "7天内")],
              ["30", t("Within 30 days", "30일 이내", "30天内")],
              ["90", t("Within 90 days", "90일 이내", "90天内")],
            ],
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
        </div>
      </section>

      <details className="bz-advanced-filters">
        <summary>
          {t(
            "Content & audience filters",
            "콘텐츠 · 시청자 상세 조건",
            "内容与受众筛选",
          )}
        </summary>
        <section
          className="bz-filter-section"
          aria-labelledby="bz-content-filters"
        >
          <h3 className="bz-filter-title" id="bz-content-filters">
            {t("Content", "콘텐츠", "内容属性")}
          </h3>
          <div className="bz-filter-grid">
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
              <fieldset
                className="bz-field bz-topic-picker"
                key={key}
                disabled={disabled}
              >
                <legend>
                  {key === "includeTags"
                    ? t("Include topics", "주제 포함", "包含主题")
                    : t("Exclude topics", "주제 제외", "排除主题")}
                </legend>
                <details>
                  <summary
                    aria-disabled={disabled}
                    onClick={(event) => {
                      if (disabled) event.preventDefault();
                    }}
                  >
                    {filters[key].length
                      ? filters[key]
                          .map((tag) => tagLabel(tag, locale))
                          .join(", ")
                      : all}
                  </summary>
                  <div className="bz-topic-menu">
                    {DIRECTORY_TAGS.map((tag) => (
                      <Checkbox
                        key={tag}
                        id={`bz-${key}-${tag}`}
                        size="m"
                        disabled={disabled}
                        checked={filters[key].includes(tag)}
                        onCheckedChange={(checked) =>
                          update(
                            key,
                            checked
                              ? [...filters[key], tag]
                              : filters[key].filter((item) => item !== tag),
                          )
                        }
                      >
                        {tagLabel(tag, locale)}
                      </Checkbox>
                    ))}
                  </div>
                </details>
              </fieldset>
            ))}
            {caps.keywords && (
              <>
                {(["keywordInclude", "keywordExclude"] as const).map((key) => (
                  <FormControl
                    className="bz-field"
                    id={`bz-filter-${key}`}
                    key={key}
                    disabled={disabled}
                  >
                    <FormLabel htmlFor={`bz-filter-${key}`}>
                      {key === "keywordInclude"
                        ? t(
                            "Include channel keywords",
                            "채널 키워드 포함",
                            "包含频道关键词",
                          )
                        : t(
                            "Exclude channel keywords",
                            "채널 키워드 제외",
                            "排除频道关键词",
                          )}
                    </FormLabel>
                    <TextField
                      id={`bz-filter-${key}`}
                      size="m"
                      value={filters[key]}
                      disabled={disabled}
                      placeholder={t(
                        "Separate with commas",
                        "쉼표로 구분",
                        "用逗号分隔",
                      )}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  </FormControl>
                ))}
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
          className="bz-filter-section"
          aria-labelledby="bz-audience-filters"
        >
          <h3 className="bz-filter-title" id="bz-audience-filters">
            {t("Audience", "시청자", "受众属性")}
          </h3>
          <div className="bz-filter-grid">
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
      </details>
    </div>
  );
}
