import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LandingPage } from "./_components/landing-page";
import type { Locale } from "./_components/landing-copy";
import "./landing.css";

export const metadata: Metadata = {
  title: "Futures Medialab — Global games. Local influence.",
  description:
    "Connect your game to Korean audiences through local MCN partners, culturally relevant content, and coordinated campaign delivery.",
};

const isLocale = (value?: string): value is Locale =>
  value === "en" || value === "ko" || value === "zh";

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
  const savedLocale = cookieStore.get("fm-locale")?.value;
  const preferredLocales = (requestHeaders.get("accept-language") ?? "en")
    .split(",")
    .map((entry) => {
      const [language = "en", weight] = entry.trim().split(";");
      return {
        locale: language.toLowerCase().split("-")[0],
        weight: weight?.startsWith("q=") ? Number(weight.slice(2)) : 1,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const browserLocale = preferredLocales.find((entry) =>
    isLocale(entry.locale),
  )?.locale;
  const locale = isLocale(params.lang)
    ? params.lang
    : isLocale(savedLocale)
      ? savedLocale
      : isLocale(browserLocale)
        ? browserLocale
        : "en";
  return <LandingPage initialLocale={locale} />;
}
