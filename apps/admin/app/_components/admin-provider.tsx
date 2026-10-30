"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@montage-ui/core";
import { AppRouterCacheProvider } from "@montage-ui/nextjs";
import "@montage-ui/core/theme.css";

export function AdminProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "fm-admin" }}>
      <ThemeProvider disableDefaultGlobalStyle>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
