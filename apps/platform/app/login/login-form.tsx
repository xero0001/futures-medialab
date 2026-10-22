"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import type { Locale } from "../_components/landing-copy";
import { AuthShell } from "../_components/auth-shell";
import { authClient } from "../../lib/auth-client";

const copy = {
  en: {
    title: "Log in",
    subtitle: "Welcome to Futures Medialab.",
    email: "Email",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    login: "Log in",
    signingIn: "Logging in…",
    register: "Create an account",
    partnerNote:
      "Campaign access is reserved for approved brands, MCNs, agencies, and studios.",
    invalid: "The email or password is incorrect. Please try again.",
    tooMany: "Too many attempts. Please wait a moment and try again.",
    failed: "We couldn’t log you in. Check your connection and try again.",
  },
  ko: {
    title: "로그인",
    subtitle: "Futures Medialab에 오신 것을 환영합니다.",
    email: "이메일",
    password: "비밀번호",
    passwordPlaceholder: "비밀번호를 입력하세요",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    login: "로그인",
    signingIn: "로그인 중…",
    register: "회원가입",
    partnerNote: "캠페인은 승인된 브랜드·MCN·에이전시·스튜디오에만 공개됩니다.",
    invalid: "이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.",
    tooMany: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    failed: "로그인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
  },
  zh: {
    title: "登录",
    subtitle: "欢迎来到 Futures Medialab。",
    email: "邮箱",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    login: "登录",
    signingIn: "正在登录…",
    register: "注册",
    partnerNote: "营销活动仅向通过审核的品牌、MCN、代理机构和工作室开放。",
    invalid: "邮箱或密码不正确，请重新确认。",
    tooMany: "尝试次数过多，请稍后重试。",
    failed: "登录失败，请检查网络连接后重试。",
  },
};

export function LoginForm({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"invalid" | "tooMany" | "failed" | null>(
    null,
  );
  const requestPending = useRef(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setPending(true);
    setStatus(null);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe: false,
      });
      if (result.error) {
        setStatus(
          result.error.status === 429
            ? "tooMany"
            : result.error.status === 401 ||
                result.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "invalid"
              : "failed",
        );
        return;
      }
      window.location.assign(`/auth/continue?lang=${locale}`);
    } catch {
      setStatus("failed");
    } finally {
      requestPending.current = false;
      setPending(false);
    }
  }

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={changeLocale}
      headingId="login-title"
    >
      <div className="fml-form-wrap">
        <h1 id="login-title">{t.title}</h1>
        <p className="fml-subtitle">{t.subtitle}</p>
        <form
          className="fml-login-form"
          onSubmit={submit}
          onChange={() => setStatus(null)}
          aria-busy={pending}
          aria-describedby="login-status"
        >
          <label className="fml-field">
            <span>{t.email}</span>
            <input
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
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
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
                required
                maxLength={128}
              />
              <button
                type="button"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                aria-pressed={showPassword}
                disabled={pending}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </span>
          </div>
          <button className="fml-submit" type="submit" disabled={pending}>
            {pending ? t.signingIn : t.login}
          </button>
          <p
            role="alert"
            id="login-status"
            className="fml-status fml-error-status"
          >
            {status ? t[status] : ""}
          </p>
        </form>
        <div className="fml-account-links">
          <a href={`/register?lang=${locale}`}>
            {t.register}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <p className="fml-partner-note">{t.partnerNote}</p>
      </div>
    </AuthShell>
  );
}
