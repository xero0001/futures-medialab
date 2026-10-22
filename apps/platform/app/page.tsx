import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LandingPage } from "./_components/landing-page";
import { resolveLocale } from "../lib/locale";
import "./landing.css";

export const metadata: Metadata = {
  title: "Futures Medialab — Global games. Local influence.",
  description:
    "Connect your game to Korean audiences through local MCN partners, culturally relevant content, and coordinated campaign delivery.",
};

export default async function HomePage({
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
