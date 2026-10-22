import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "../../lib/locale";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Sign up — Futures Medialab",
  description: "Join Futures Medialab as an agency, studio, or brand.",
};

export default async function RegisterPage({
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
  return <RegisterForm initialLocale={locale} />;
}
