import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "../../lib/locale";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in — Futures Medialab",
  description:
    "Access the Futures Medialab campaign workspace for brands and approved partner organizations.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [params, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
  ]);
  const locale = resolveLocale(
    params.lang,
    cookieStore.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );

  return <LoginForm initialLocale={locale} />;
}
