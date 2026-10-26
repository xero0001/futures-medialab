"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function LoginForm({ denied }: { denied: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    denied ? "이 계정에는 관리자 권한이 없습니다." : "",
  );
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? "").trim(),
          password: String(data.get("password") ?? ""),
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
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={signIn}>
      <label>
        이메일
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="이메일 주소를 입력해주세요"
          required
          maxLength={254}
          disabled={busy}
        />
      </label>
      <div className="admin-password-field">
        <label htmlFor="admin-password">비밀번호</label>
        <div className="admin-password-input">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            placeholder="비밀번호를 입력해주세요"
            required
            maxLength={128}
            disabled={busy}
          />
          <button
            type="button"
            className="admin-password-toggle"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            aria-pressed={showPassword}
            disabled={busy}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      )}
      <button className="primary admin-login-submit" disabled={busy}>
        {busy ? "권한 확인 중…" : "로그인"}
        {busy ? (
          <LoaderCircle className="admin-spin" size={19} />
        ) : (
          <ArrowRight size={19} />
        )}
      </button>
    </form>
  );
}
