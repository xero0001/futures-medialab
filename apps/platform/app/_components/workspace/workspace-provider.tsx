"use client";

import { ThemeProvider } from "@montage-ui/core";
import { AppRouterCacheProvider } from "@montage-ui/nextjs";
import type { ReactNode } from "react";
import "@montage-ui/core/theme.css";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "fm-montage" }}>
      <ThemeProvider disableDefaultGlobalStyle>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
