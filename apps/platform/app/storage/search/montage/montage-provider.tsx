"use client";

import { Global, ThemeProvider } from "@montage-ui/core";
import { AppRouterCacheProvider } from "@montage-ui/nextjs";
import type { ReactNode } from "react";
import "@montage-ui/core/theme.css";

export function MontageProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "fm-montage" }}>
      <ThemeProvider disableDefaultGlobalStyle>
        <Global
          styles={{
            '[role="menu"], [role="listbox"]': {
              fontFamily:
                "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            },
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
