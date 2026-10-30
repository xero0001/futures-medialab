"use client";

import { useRef, useState, type FormEvent } from "react";
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
  ThemeProvider,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowLeft,
  IconChevronRight,
  IconCircleExclamation,
  IconEye,
  IconEyeSlash,
} from "@montage-ui/icon";
import { AppRouterCacheProvider } from "@montage-ui/nextjs";
import { BrandLogo } from "../brand-logo";
import "@montage-ui/core/theme.css";
import styles from "./login.module.css";

const serviceUrl = "https://futures-medialab.vercel.app";

export function LoginForm({ denied }: { denied: boolean }) {
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    denied ? "이 계정에는 관리자 권한이 없습니다." : "",
  );
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "로그인 시도가 많습니다. 잠시 후 다시 시도하세요."
            : "이메일과 비밀번호를 확인하세요.",
        );
      const access = await fetch("/api/admin/bootstrap", { cache: "no-store" });
      if (!access.ok) {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        throw new Error(
          access.status === 403
            ? "이 계정에는 관리자 권한이 없습니다."
            : "관리자 권한을 확인하지 못했습니다. 다시 시도하세요.",
        );
      }
      window.location.assign("/");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "로그인할 수 없습니다.",
      );
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }
  return (
    <AppRouterCacheProvider options={{ key: "fm-admin-auth" }}>
      <ThemeProvider disableDefaultGlobalStyle>
        <div className={styles.page}>
          <header className={styles.header}>
            <BrandLogo href={serviceUrl} />
            <Typography
              as="span"
              variant="caption1"
              weight="medium"
              className={styles.badge}
            >
              운영 콘솔
            </Typography>
          </header>
          <main className={styles.main}>
            <div className={styles.content}>
              <section className={styles.card} aria-labelledby="login-title">
                <div className={styles.intro}>
                  <Typography
                    as="h1"
                    id="login-title"
                    variant="title1"
                    weight="bold"
                  >
                    관리자 로그인
                  </Typography>
                  <Typography
                    as="p"
                    variant="body2"
                    color="semantic.foreground.neutral.secondary"
                  >
                    Futures Medialab 운영자 계정으로 로그인하세요.
                  </Typography>
                </div>
                <form
                  className={styles.form}
                  onSubmit={signIn}
                  aria-busy={busy}
                >
                  <FormControl size="large">
                    <FormControlLabel htmlFor="admin-email">
                      이메일
                    </FormControlLabel>
                    <FormControlField>
                      <TextField
                        id="admin-email"
                        type="email"
                        name="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="you@company.com"
                        required
                        maxLength={254}
                        disabled={busy}
                        width="100%"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError("");
                        }}
                        aria-describedby={error ? "login-status" : undefined}
                      />
                    </FormControlField>
                  </FormControl>
                  <FormControl size="large">
                    <FormControlLabel htmlFor="admin-password">
                      비밀번호
                    </FormControlLabel>
                    <FormControlField>
                      <TextField
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="current-password"
                        placeholder="비밀번호를 입력해 주세요"
                        required
                        maxLength={128}
                        disabled={busy}
                        width="100%"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setError("");
                        }}
                        aria-describedby={error ? "login-status" : undefined}
                        trailingContent={
                          <TextFieldContent variant="icon-button">
                            <IconButton
                              className={styles.passwordToggle}
                              type="button"
                              size="large"
                              aria-label={
                                showPassword
                                  ? "비밀번호 숨기기"
                                  : "비밀번호 표시"
                              }
                              aria-pressed={showPassword}
                              disabled={busy}
                              onClick={() =>
                                setShowPassword((visible) => !visible)
                              }
                            >
                              {showPassword ? <IconEyeSlash /> : <IconEye />}
                            </IconButton>
                          </TextFieldContent>
                        }
                      />
                    </FormControlField>
                  </FormControl>
                  {error && (
                    <div
                      role="alert"
                      id="login-status"
                      className={styles.error}
                    >
                      <IconCircleExclamation aria-hidden="true" />
                      <Typography as="p" variant="label2">
                        {error}
                      </Typography>
                    </div>
                  )}
                  <Button
                    className={styles.submit}
                    type="submit"
                    size="large"
                    color="primary"
                    fullWidth
                    loading={busy}
                    disabled={busy}
                    aria-label={busy ? "권한 확인 중" : "로그인"}
                  >
                    {busy ? "권한 확인 중…" : "로그인"}
                  </Button>
                </form>
                <Divider className={styles.divider} />
                <div className={styles.alternate}>
                  <Typography
                    as="p"
                    variant="label1"
                    color="semantic.foreground.neutral.secondary"
                  >
                    브랜드·에이전시 계정이신가요?
                  </Typography>
                  <TextButton
                    as="a"
                    href={`${serviceUrl}/login?lang=ko`}
                    size="small"
                    trailingContent={<IconChevronRight />}
                  >
                    서비스 로그인
                  </TextButton>
                </div>
              </section>
              <Typography
                as="p"
                variant="caption1"
                className={styles.partnerNote}
              >
                운영자로 지정된 계정만 접근할 수 있습니다.
              </Typography>
              <div className={styles.home}>
                <TextButton
                  as="a"
                  href={serviceUrl}
                  color="assistive"
                  size="small"
                  leadingContent={<IconArrowLeft />}
                >
                  홈으로 돌아가기
                </TextButton>
              </div>
            </div>
          </main>
          <footer className={styles.footer}>
            <Typography as="p" variant="caption1">
              Futures Medialab · 운영자 전용 공간
            </Typography>
            <Typography as="p" variant="caption2">
              © Futures Medialab
            </Typography>
          </footer>
        </div>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
