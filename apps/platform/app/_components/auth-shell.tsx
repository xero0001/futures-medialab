"use client";

import { useId, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "./landing-copy";
import { LanguageSwitcher } from "./language-switcher";
import "../login/login.css";

const copy = {
  en: {
    home: "Back to home",
    language: "Language",
    firstLine: "Global games.",
    secondLine: "Local influence.",
    description:
      "One place to connect global game campaigns with Korean partners.",
  },
  ko: {
    home: "홈으로 돌아가기",
    language: "언어",
    firstLine: "세계의 게임을,",
    secondLine: "한국의 영향력으로.",
    description: "글로벌 게임 캠페인과 한국 파트너를 한곳에서 연결합니다.",
  },
  zh: {
    home: "返回首页",
    language: "语言",
    firstLine: "全球游戏，",
    secondLine: "本土影响力。",
    description: "在一个平台连接全球游戏营销与韩国本地合作伙伴。",
  },
};

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M6 8h28l-6 9H0L6 8Zm8 15h16l-6 9H8l6-9Z" fill="currentColor" />
    </svg>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.93A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.93V7.48H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.52l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"
      />
    </svg>
  );
}

export function AuthShell({
  locale,
  onLocaleChange,
  headingId,
  children,
  className = "",
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  headingId: string;
  children: ReactNode;
  className?: string;
}) {
  const t = copy[locale];
  const artId = useId();

  return (
    <main
      className={`fml-page ${className}`}
      lang={locale === "zh" ? "zh-CN" : locale}
    >
      <aside className="fml-brand-panel">
        <a
          className="fml-wordmark"
          href={`/?lang=${locale}`}
          aria-label={t.home}
        >
          <BrandMark />
          <span>
            futures<span>MEDIALAB</span>
          </span>
        </a>
        <div className="fml-brand-content">
          <h2>
            {t.firstLine}
            <br />
            <span>{t.secondLine}</span>
          </h2>
          <p>{t.description}</p>
          <svg
            className="fml-brand-art"
            viewBox="0 0 480 350"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={`${artId}-ring`}
                x1="90"
                y1="30"
                x2="350"
                y2="310"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#b4bcff" />
                <stop offset="1" stopColor="#4355db" />
              </linearGradient>
              <linearGradient
                id={`${artId}-ring-front`}
                x1="280"
                y1="60"
                x2="410"
                y2="280"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#3040bd" />
                <stop offset="1" stopColor="#8a9aff" />
              </linearGradient>
            </defs>
            <circle cx="240" cy="175" r="156" stroke="#dce0fb" />
            <g transform="rotate(-30 240 175)">
              <rect
                x="81"
                y="55"
                width="186"
                height="230"
                rx="93"
                stroke={`url(#${artId}-ring)`}
                strokeWidth="44"
              />
              <rect
                x="213"
                y="65"
                width="186"
                height="230"
                rx="93"
                stroke={`url(#${artId}-ring-front)`}
                strokeWidth="44"
              />
              <path
                d="M174 285c51.4 0 93-41.6 93-93v-44"
                stroke={`url(#${artId}-ring)`}
                strokeWidth="44"
              />
            </g>
          </svg>
        </div>
        <a className="fml-home-link" href={`/?lang=${locale}`}>
          <ArrowLeft size={18} />
          {t.home}
        </a>
      </aside>

      <section className="fml-form-panel" aria-labelledby={headingId}>
        <LanguageSwitcher
          className="fml-language"
          locale={locale}
          label={t.language}
          onChange={onLocaleChange}
        />
        {children}
      </section>
    </main>
  );
}
