import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LandingPage } from "../_components/landing-page";
import { resolveLocale } from "../../lib/locale";
import "../landing.css";

export const metadata: Metadata = {
  title: "Previous main design — Futures Medialab",
  description:
    "The previous Futures Medialab main-page design, preserved for comparison.",
  robots: { index: false, follow: false },
};

export default async function PreviousHomePage({
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

  return <LandingPage initialLocale={locale} />;
}
