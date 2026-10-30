"use client";

import type { ReactNode } from "react";
import { TextButton, Typography } from "@montage-ui/core";
import { IconArrowLeft } from "@montage-ui/icon";
import { Wordmark } from "../brand-logo";
import { LanguageSwitcher } from "../language-switcher";
import type { Locale } from "../landing-copy";
import { WorkspaceProvider } from "../workspace/workspace-provider";
import styles from "./auth-layout.module.css";

const copy = {
  en: {
    home: "Back to home",
    language: "Language",
    workspace: "Your next collaboration starts here.",
  },
  ko: {
    home: "홈으로 돌아가기",
    language: "언어",
    workspace: "새로운 협업의 시작, Futures Medialab",
  },
  zh: {
    home: "返回首页",
    language: "语言",
    workspace: "在 Futures Medialab 开启新的合作。",
  },
};

export function AuthLayout({
  locale,
  onLocaleChange,
  headingId,
  supportingText,
  wide = false,
  children,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  headingId: string;
  supportingText?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const t = copy[locale];

  return (
    <WorkspaceProvider>
      <div className={styles.page} lang={locale === "zh" ? "zh-CN" : locale}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Wordmark href={`/?lang=${locale}`} />
          </div>
          <LanguageSwitcher
            className={styles.language}
            locale={locale}
            label={t.language}
            onChange={onLocaleChange}
          />
        </header>
        <main className={styles.main}>
          <div className={`${styles.content}${wide ? ` ${styles.wide}` : ""}`}>
            <section className={styles.card} aria-labelledby={headingId}>
              {children}
            </section>
            {supportingText && (
              <Typography
                as="p"
                variant="caption1"
                className={styles.partnerNote}
              >
                {supportingText}
              </Typography>
            )}
            <div className={styles.home}>
              <TextButton
                as="a"
                href={`/?lang=${locale}`}
                color="assistive"
                size="small"
                leadingContent={<IconArrowLeft />}
              >
                {t.home}
              </TextButton>
            </div>
          </div>
        </main>
        <footer className={styles.footer}>
          <Typography as="p" variant="caption1">
            {t.workspace}
          </Typography>
          <Typography as="p" variant="caption2">
            © Futures Medialab
          </Typography>
        </footer>
      </div>
    </WorkspaceProvider>
  );
}
