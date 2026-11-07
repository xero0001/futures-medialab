"use client";

import { useState } from "react";
import { publicChannelThumbnailUrl } from "@futures-medialab/database/proposal-validation";
import { futuresCreatorThumbnail } from "../../../lib/futures-creator-assets";
import styles from "./official-proposal-panel.module.css";

export function ProposalChannelAvatar({
  name,
  channelUrl,
  thumbnailUrl,
  alt,
}: {
  name: string;
  channelUrl: string;
  thumbnailUrl?: string | null;
  alt: string;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const url = [
    publicChannelThumbnailUrl(thumbnailUrl ?? ""),
    futuresCreatorThumbnail(channelUrl),
  ].find((candidate) => candidate && !failedUrls.includes(candidate));
  return (
    <span className={styles.avatar}>
      {url ? (
        // Use the published thumbnail or a verified company asset for this channel.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrls((failed) => [...failed, url])}
        />
      ) : (
        <span aria-hidden="true">{Array.from(name.trim())[0] || "?"}</span>
      )}
    </span>
  );
}
