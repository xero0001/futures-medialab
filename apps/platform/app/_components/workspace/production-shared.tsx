"use client";

import Image from "next/image";
import { VideoPreview } from "@futures-medialab/ui/video-submission";
import {
  productionMediaUrl,
  productionVideoSource,
} from "@futures-medialab/database/production-media-shared";
import { Typography } from "@montage-ui/core";
import { IconArrowUpRight } from "@montage-ui/icon";
import type { ProductionStatus } from "@futures-medialab/database/production-types";
import type { CampaignArtwork } from "../../../lib/campaign-artwork";
import type { Locale } from "../landing-copy";
import { StatusBadge, type StatusTone } from "./status-badge";
import styles from "./production-workspace.module.css";

export const productionText =
  (locale: Locale) => (ko: string, en: string, zh: string) =>
    ({ ko, en, zh })[locale];
export function productionDate(value: string | null, locale: Locale) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function ProductionBadge({
  status,
  locale,
}: {
  status: ProductionStatus;
  locale: Locale;
}) {
  const t = productionText(locale);
  const labels: Record<ProductionStatus, string> = {
    AWAITING_SUBMISSION: t("제작 중", "In production", "制作中"),
    ADMIN_REVIEW: t("퓨쳐스 검토 중", "Futures review", "Futures 审核中"),
    AGENCY_REVISION: t("제작 수정 중", "Production revision", "制作修改中"),
    BRAND_REVIEW: t(
      "브랜드 검수 대기",
      "Awaiting brand review",
      "等待品牌审核",
    ),
    BRAND_REVISION: t(
      "브랜드 수정 요청",
      "Brand changes requested",
      "品牌要求修改",
    ),
    APPROVED: t("콘텐츠 승인 완료", "Content approved", "内容已批准"),
  };
  const tones: Record<ProductionStatus, StatusTone> = {
    AWAITING_SUBMISSION: "blue",
    ADMIN_REVIEW: "blue",
    AGENCY_REVISION: "amber",
    BRAND_REVIEW: "amber",
    BRAND_REVISION: "amber",
    APPROVED: "green",
  };
  return <StatusBadge tone={tones[status]}>{labels[status]}</StatusBadge>;
}
export function ContentLink({ url, locale }: { url: string; locale: Locale }) {
  const t = productionText(locale);
  let safe: string | null = productionMediaUrl(url),
    demo = false;
  try {
    const value = new URL(url);
    demo = value.hostname === "example.invalid";
    if (
      value.protocol === "https:" &&
      !value.username &&
      !value.password &&
      !demo
    )
      safe = value.href;
  } catch {
    /* Malformed historical links remain non-interactive. */
  }
  return safe ? (
    <a
      className={styles.contentLink}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("콘텐츠 열기", "Open content", "打开内容")}
      <IconArrowUpRight />
    </a>
  ) : (
    <Typography variant="caption1" className={styles.muted}>
      {demo
        ? t(
            "시연 콘텐츠 · 외부 연결 없음",
            "Demo content · no external link",
            "演示内容 · 无外部链接",
          )
        : t("공유 링크 없음", "No shared link", "暂无共享链接")}
    </Typography>
  );
}
export function ProductionArtwork({
  artwork,
  locale,
}: {
  artwork?: Partial<CampaignArtwork>;
  locale: Locale;
}) {
  if (!artwork?.coverImageUrl) return null;
  const t = productionText(locale);
  return (
    <figure className={styles.artwork}>
      <Image
        src={artwork.coverImageUrl}
        alt={
          artwork.gameName ??
          t("게임 참고 이미지", "Game reference artwork", "游戏参考图")
        }
        width={2048}
        height={946}
      />
      <figcaption>
        {t("게임 참고 이미지", "Game reference artwork", "游戏参考图")} · ©
        Hotta Studio / Perfect World
        {artwork.gameSourceUrl && (
          <a
            href={artwork.gameSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("출처", "Source", "来源")}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
export function VersionContent({
  version,
  locale,
  timestamp,
  label,
}: {
  version: { version: number; title: string; url: string; note: string };
  locale: Locale;
  timestamp: string | null;
  label?: string;
}) {
  return (
    <div className={styles.versionBody}>
      <Typography variant="caption1" className={styles.muted}>
        {label ? `${label} · ` : ""}v{version.version} ·{" "}
        {productionDate(timestamp, locale)}
      </Typography>
      <Typography as="h3" variant="heading2" weight="bold">
        {version.title}
      </Typography>
      <VideoPreview
        source={productionVideoSource(version.url)}
        title={version.title}
      />
      <ContentLink url={version.url} locale={locale} />
      <Typography as="p" variant="body2" className={styles.note}>
        {version.note ||
          productionText(locale)(
            "별도 전달 내용이 없습니다.",
            "No additional notes.",
            "暂无补充说明。",
          )}
      </Typography>
    </div>
  );
}
