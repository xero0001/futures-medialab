import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "관리자 로그인 — Futures Medialab" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const query = await searchParams;
  return <LoginForm denied={query.denied === "1"} />;
}
