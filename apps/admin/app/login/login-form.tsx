"use client";
import { useState, type FormEvent } from "react";

export function LoginForm({ denied }: { denied: boolean }) {
  const [busy, setBusy] = useState(false);
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
          required
          maxLength={254}
          disabled={busy}
        />
      </label>
      <label>
        비밀번호
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={busy}
        />
      </label>
      {error && (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "권한 확인 중…" : "로그인"}
      </button>
    </form>
  );
}
