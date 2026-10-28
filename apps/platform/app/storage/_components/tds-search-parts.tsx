import {
  ArrowUpRight,
  Bookmark,
  Facebook,
  Instagram,
  Music2,
  Twitch,
  Youtube,
} from "lucide-react";
import type { Locale } from "../../_components/landing-copy";
import type { Creator, PlatformId } from "../../../lib/creator-directory";
import { platformNames, tagLabel, translate } from "./directory-filters";

// Independently implemented presentation inspired by the public TDS guidance.
// No restricted TDS packages, fonts, or brand assets are used.
export function TdsPlatformIcon({
  platform,
  size = 18,
}: {
  platform: PlatformId;
  size?: number;
}) {
  const Icon = {
    youtube: Youtube,
    tiktok: Music2,
    instagram: Instagram,
    twitch: Twitch,
    facebook: Facebook,
  }[platform as Exclude<PlatformId, "x">];
  return Icon ? (
    <Icon size={size} aria-hidden="true" />
  ) : (
    <span aria-hidden="true">𝕏</span>
  );
}

export function TdsCreatorGrid({
  creators,
  locale,
  viewsWindow,
  savedIds,
  busy,
  onDetail,
  onSave,
}: {
  creators: Creator[];
  locale: Locale;
  viewsWindow: "last10" | "last30";
  savedIds: string[];
  busy: boolean;
  onDetail: (creator: Creator) => void;
  onSave: (creator: Creator) => void;
}) {
  const t = (en: string, ko: string, zh: string) =>
    translate(locale, en, ko, zh);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const countryNames: Record<string, string> = {
    KR: t("South Korea", "대한민국", "韩国"),
    US: t("United States", "미국", "美国"),
    JP: t("Japan", "일본", "日本"),
    CN: t("China", "중국", "中国"),
    GB: t("United Kingdom", "영국", "英国"),
    SG: t("Singapore", "싱가포르", "新加坡"),
  };

  return (
    <div className="tds-creator-grid">
      {creators.map((creator) => {
        const saved = savedIds.includes(creator.id);
        return (
          <article className="tds-creator-card" key={creator.id}>
            <div className="tds-card-top">
              <button
                type="button"
                className="tds-creator-identity"
                onClick={() => onDetail(creator)}
                aria-label={`${creator.name} ${t("profile", "프로필 보기", "查看资料")}`}
              >
                <span className="tds-creator-avatar" aria-hidden="true">
                  {creator.name.slice(0, 1)}
                </span>
                <span>
                  <strong>{creator.name.replace(/ \(Demo\)$/, "")}</strong>
                  <small>{creator.handle}</small>
                </span>
              </button>
              <button
                type="button"
                className="cw-icon-button"
                disabled={busy}
                aria-pressed={saved}
                aria-label={`${saved ? t("Unsave", "저장 해제", "取消收藏") : t("Save", "저장", "收藏")} ${creator.name}`}
                onClick={() => onSave(creator)}
              >
                <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="tds-creator-context">
              <span>
                <TdsPlatformIcon platform={creator.platform} size={15} />
                {platformNames[creator.platform]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{countryNames[creator.country] ?? creator.country}</span>
            </div>
            <div className="tds-card-tags">
              {creator.tags.slice(0, 3).map((tag) => (
                <span className="cw-tag" key={tag}>
                  {tagLabel(tag, locale)}
                </span>
              ))}
            </div>
            <div className="tds-card-metrics">
              <div>
                <span>{t("Followers", "팔로워", "粉丝数")}</span>
                <strong>{number(creator.followers)}</strong>
              </div>
              <div>
                <span>{t("Avg. views", "평균 조회수", "平均播放量")}</span>
                <strong>
                  {number(
                    viewsWindow === "last10"
                      ? creator.views10
                      : creator.views30,
                  )}
                </strong>
              </div>
              <div>
                <span>{t("Engagement", "참여율", "互动率")}</span>
                <strong>
                  {creator.engagement.toFixed(1)}
                  <small>%</small>
                </strong>
              </div>
            </div>
            <div className="tds-card-footer">
              <span>
                {t(
                  `Posted ${creator.daysSincePosted}d ago`,
                  `${creator.daysSincePosted}일 전 게시`,
                  `${creator.daysSincePosted}天前发布`,
                )}
              </span>
              <button
                type="button"
                className="tds-detail-button"
                onClick={() => onDetail(creator)}
                aria-label={`${creator.name} ${t("details", "상세 보기", "查看详情")}`}
              >
                {t("View profile", "자세히 보기", "查看资料")}
                <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
