"use client";

import { useState } from "react";
import { publicChannelThumbnailUrl } from "@futures-medialab/database/proposal-validation";
import s from "./influencer-avatar.module.css";

export function InfluencerAvatar({
  name,
  thumbnailUrl,
  size = 44,
}: {
  name: string;
  thumbnailUrl?: string | null;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = thumbnailUrl ? publicChannelThumbnailUrl(thumbnailUrl) : null;
  const initial = Array.from(name.trim())[0] || "?";
  return (
    <span className={s.avatar} style={{ width: size, height: size }}>
      {url && url !== failedUrl ? (
        // Fetch approved public channel images in the browser without an image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${name} 채널 썸네일`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span
          role="img"
          aria-label={`${name || "인플루언서"} 채널 이미지 없음`}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
