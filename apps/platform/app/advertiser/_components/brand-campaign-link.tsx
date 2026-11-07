"use client";

import Link from "next/link";
import Image from "next/image";
import { Typography } from "@montage-ui/core";
import { IconMegaphone } from "@montage-ui/icon";
import type { Locale } from "../../_components/landing-copy";
import type { BrandCampaign } from "../../../lib/brand-workspace-types";
import styles from "./brand-campaign-link.module.css";

export function BrandCampaignLink({
  campaign,
  href,
  locale,
}: {
  campaign: BrandCampaign;
  href: string;
  locale: Locale;
}) {
  return (
    <Link href={href} className={styles.link}>
      <span className={styles.icon}>
        {campaign.gameIconUrl ? (
          <Image
            src={campaign.gameIconUrl}
            alt={
              campaign.gameName ??
              { ko: "게임", en: "Game", zh: "游戏" }[locale]
            }
            width={40}
            height={40}
          />
        ) : (
          <IconMegaphone aria-hidden="true" />
        )}
      </span>
      <span>
        <Typography as="strong" variant="label1" weight="bold">
          {campaign.title}
        </Typography>
        <Typography as="span" variant="caption1" className={styles.muted}>
          {campaign.type === "MANAGED" ? "Managed" : "Open"}
          {campaign.platforms.length
            ? ` · ${campaign.platforms.join(" · ")}`
            : ""}
        </Typography>
      </span>
    </Link>
  );
}
