"use client";

import { ContentBadge, type ThemeColorsToken } from "@montage-ui/core";
import type { ReactNode } from "react";

export type StatusTone = "neutral" | "blue" | "amber" | "green" | "red";
const colors: Record<Exclude<StatusTone, "neutral">, ThemeColorsToken> = {
  blue: "semantic.foreground.brand.primary",
  amber: "atomic.orange.30",
  green: "atomic.green.30",
  red: "semantic.foreground.negative.strong",
};

export function StatusBadge({ tone, children, size = "small" }: { tone: StatusTone; children: ReactNode; size?: "xsmall" | "small" | "medium" }) {
  return <ContentBadge size={size} color={tone === "neutral" ? "neutral" : "accent"} neutralColor="semantic.foreground.neutral.secondary" accentColor={tone === "neutral" ? undefined : colors[tone]}>{children}</ContentBadge>;
}
