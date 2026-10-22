"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import { LanguageSwitcher } from "../_components/language-switcher";

const copy = {
  en: {
    home: "Back to home",
    language: "Language",
    firstLine: "Global games.",
    secondLine: "Local influence.",
    description:
      "One place to connect global game campaigns with Korean partners.",
    title: "Log in",
    subtitle: "Welcome to Futures Medialab.",
    google: "Continue with Google",
    or: "or",
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    login: "Log in",
    forgot: "Forgot password?",
    partner: "Partner access",
    partnerNote: "For brands and approved MCNs, agencies, and studios.",
    preview:
      "Sign-in is not connected yet. This preview does not send or save your credentials.",
    unavailable:
      "Sign-in is not available in this preview. No credentials were sent.",
    recoveryUnavailable:
      "Password recovery is not connected yet. No reset email was sent.",
    googleUnavailable: "Google sign-in is not connected yet.",
  },
  ko: {
    home: "홈으로 돌아가기",
    language: "언어",
    firstLine: "세계의 게임을,",
    secondLine: "한국의 영향력으로.",
    description: "글로벌 게임 캠페인과 한국 파트너를 한곳에서 연결합니다.",
    title: "로그인",
    subtitle: "Futures Medialab에 오신 것을 환영합니다.",
    google: "Google 계정으로 계속하기",
    or: "또는",
    email: "이메일",
    emailPlaceholder: "you@company.com",
    password: "비밀번호",
    passwordPlaceholder: "비밀번호를 입력하세요",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    login: "로그인",
    forgot: "비밀번호를 잊으셨나요?",
    partner: "파트너 참여 안내",
    partnerNote: "브랜드 및 승인된 MCN·에이전시·스튜디오를 위한 서비스입니다.",
    preview:
      "아직 로그인 기능이 연결되지 않았습니다. 이 미리보기에서는 계정 정보를 전송하거나 저장하지 않습니다.",
    unavailable:
      "미리보기에서는 로그인할 수 없습니다. 계정 정보는 전송되지 않았습니다.",
    recoveryUnavailable:
      "비밀번호 재설정 기능은 아직 연결되지 않았습니다. 재설정 이메일은 발송되지 않았습니다.",
    googleUnavailable: "Google 로그인 기능은 아직 연결되지 않았습니다.",
  },
  zh: {
    home: "返回首页",
    language: "语言",
    firstLine: "全球游戏，",
    secondLine: "本土影响力。",
    description: "在一个平台连接全球游戏营销与韩国本地合作伙伴。",
    title: "登录",
    subtitle: "欢迎来到 Futures Medialab。",
    google: "使用 Google 账号继续",
    or: "或",
    email: "邮箱",
    emailPlaceholder: "you@company.com",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    login: "登录",
    forgot: "忘记密码？",
    partner: "合作伙伴申请说明",
    partnerNote: "面向品牌及通过审核的 MCN、代理机构和工作室。",
    preview: "登录功能尚未连接。此预览不会发送或保存您的账号信息。",
    unavailable: "此预览暂不支持登录。您的账号信息未被发送。",
    recoveryUnavailable: "密码找回功能尚未连接。未发送重置邮件。",
    googleUnavailable: "Google 登录功能尚未连接。",
  },
};

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M6 8h28l-6 9H0L6 8Zm8 15h16l-6 9H8l6-9Z" fill="currentColor" />
    </svg>
  );
}

function GoogleMark() {
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

export function LoginForm({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<
    "unavailable" | "recoveryUnavailable" | "googleUnavailable" | null
  >(null);
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("unavailable");
  }

  return (
    <main className="fml-page" lang={locale === "zh" ? "zh-CN" : locale}>
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
                id="login-ring"
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
                id="login-ring-front"
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
                stroke="url(#login-ring)"
                strokeWidth="44"
              />
              <rect
                x="213"
                y="65"
                width="186"
                height="230"
                rx="93"
                stroke="url(#login-ring-front)"
                strokeWidth="44"
              />
              <path
                d="M174 285c51.4 0 93-41.6 93-93v-44"
                stroke="url(#login-ring)"
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

      <section className="fml-form-panel" aria-labelledby="login-title">
        <LanguageSwitcher
          className="fml-language"
          locale={locale}
          label={t.language}
          onChange={changeLocale}
        />

        <div className="fml-form-wrap">
          <h1 id="login-title">{t.title}</h1>
          <p className="fml-subtitle">{t.subtitle}</p>
          <button
            className="fml-google"
            type="button"
            onClick={() => setStatus("googleUnavailable")}
          >
            <GoogleMark />
            {t.google}
          </button>
          <div className="fml-divider">
            <span>{t.or}</span>
          </div>

          <form
            onSubmit={submit}
            onChange={() => setStatus(null)}
            aria-describedby="login-preview-note"
          >
            <label className="fml-field">
              <span>{t.email}</span>
              <input
                type="email"
                autoComplete="username"
                placeholder={t.emailPlaceholder}
                required
                maxLength={254}
              />
            </label>
            <div className="fml-field">
              <label htmlFor="login-password" className="fml-field-label">
                {t.password}
              </label>
              <span className="fml-password">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t.passwordPlaceholder}
                  required
                  maxLength={128}
                />
                <button
                  type="button"
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </div>
            <button className="fml-submit" type="submit">
              {t.login}
            </button>
          </form>

          <div className="fml-account-links">
            <a href={`/?lang=${locale}#partners`}>
              {t.partner}
              <ArrowUpRight size={17} />
            </a>
            <button
              type="button"
              onClick={() => setStatus("recoveryUnavailable")}
            >
              {t.forgot}
            </button>
          </div>
          <p className="fml-partner-note">{t.partnerNote}</p>
          <p className="fml-preview-note" id="login-preview-note">
            {t.preview}
          </p>
          <p role="status" className="fml-status">
            {status ? t[status] : ""}
          </p>
        </div>
      </section>
    </main>
  );
}
