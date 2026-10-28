"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  name: string;
  avatarUrl?: string;
  size: number;
  className?: string;
};

export function CreatorAvatar({ name, avatarUrl, size, className }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name
    .replace(/\s*\(Demo\)$/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase();

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: "50%",
        color: "var(--semantic-foreground-neutral-secondary, currentColor)",
        backgroundColor: "var(--semantic-background-neutral-secondary)",
      }}
    >
      {avatarUrl && avatarUrl !== failedUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
