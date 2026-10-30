"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  Divider,
  FormControl,
  FormControlField,
  FormControlLabel,
  IconButton,
  TextButton,
  TextField,
  TextFieldContent,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowLeft,
  IconChevronRight,
  IconCircleExclamation,
  IconEye,
  IconEyeSlash,
} from "@montage-ui/icon";
import type { Locale } from "../_components/landing-copy";
import { Wordmark } from "../_components/brand-logo";
import { LanguageSwitcher } from "../_components/language-switcher";
import { WorkspaceProvider } from "../_components/workspace/workspace-provider";
import { authClient } from "../../lib/auth-client";
import styles from "./login.module.css";

const copy = {
  en: {
    title: "Log in",
    subtitle: "Welcome to Futures Medialab.",
    home: "Back to home",
    language: "Language",
    newAccount: "New to Futures Medialab?",
    workspace: "Your next collaboration starts here.",
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
    home: "홈으로 돌아가기",
    language: "언어",
    newAccount: "아직 계정이 없으신가요?",
    workspace: "새로운 협업의 시작, Futures Medialab",
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
    home: "返回首页",
    language: "语言",
    newAccount: "还没有账号？",
    workspace: "在 Futures Medialab 开启新的合作。",
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
  return (
    <WorkspaceProvider>
      <LoginContent initialLocale={initialLocale} />
    </WorkspaceProvider>
  );
}

function LoginContent({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"invalid" | "tooMany" | "failed" | null>(
    null,
  );
  const requestPending = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);

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
    <div className={styles.page} lang={locale === "zh" ? "zh-CN" : locale}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Wordmark href={`/?lang=${locale}`} />
        </div>
        <LanguageSwitcher
          className={styles.language}
          locale={locale}
          label={t.language}
          onChange={changeLocale}
        />
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          <section className={styles.card} aria-labelledby="login-title">
            <div className={styles.intro}>
              <Typography as="h1" id="login-title" variant="title1" weight="bold">
                {t.title}
              </Typography>
              <Typography
                as="p"
                variant="body2"
                color="semantic.foreground.neutral.secondary"
              >
                {t.subtitle}
              </Typography>
            </div>
            <form
              className={styles.form}
              onSubmit={submit}
              aria-busy={pending}
            >
              <FormControl size="large">
                <FormControlLabel htmlFor="login-email">
                  {t.email}
                </FormControlLabel>
                <FormControlField>
                  <TextField
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setStatus(null);
                    }}
                    status={status === "invalid" ? "negative" : "normal"}
                    aria-describedby={status ? "login-status" : undefined}
                    disabled={pending}
                    required
                    maxLength={254}
                    width="100%"
                  />
                </FormControlField>
              </FormControl>
              <FormControl size="large">
                <FormControlLabel htmlFor="login-password">
                  {t.password}
                </FormControlLabel>
                <FormControlField>
                  <TextField
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setStatus(null);
                    }}
                    status={status === "invalid" ? "negative" : "normal"}
                    aria-describedby={status ? "login-status" : undefined}
                    disabled={pending}
                    required
                    maxLength={128}
                    width="100%"
                    trailingContent={
                      <TextFieldContent variant="icon-button">
                        <IconButton
                          type="button"
                          size="large"
                          sx={{ width: 40, height: 40 }}
                          aria-label={
                            showPassword ? t.hidePassword : t.showPassword
                          }
                          aria-pressed={showPassword}
                          disabled={pending}
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? <IconEyeSlash /> : <IconEye />}
                        </IconButton>
                      </TextFieldContent>
                    }
                  />
                </FormControlField>
              </FormControl>
              {status && (
                <div
                  ref={statusRef}
                  role="alert"
                  id="login-status"
                  className={styles.error}
                  tabIndex={-1}
                >
                  <IconCircleExclamation aria-hidden="true" />
                  <Typography as="p" variant="label2">
                    {t[status]}
                  </Typography>
                </div>
              )}
              <Button
                className={styles.submit}
                type="submit"
                size="large"
                color="primary"
                fullWidth
                loading={pending}
                disabled={pending}
                aria-label={pending ? t.signingIn : t.login}
              >
                {pending ? t.signingIn : t.login}
              </Button>
            </form>
            <Divider className={styles.divider} />
            <div className={styles.register}>
              <Typography
                as="p"
                variant="label1"
                color="semantic.foreground.neutral.secondary"
              >
                {t.newAccount}
              </Typography>
              <TextButton
                as="a"
                href={`/register?lang=${locale}`}
                size="small"
                trailingContent={<IconChevronRight />}
              >
                {t.register}
              </TextButton>
            </div>
          </section>
          <Typography as="p" variant="caption1" className={styles.partnerNote}>
            {t.partnerNote}
          </Typography>
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
  );
}
