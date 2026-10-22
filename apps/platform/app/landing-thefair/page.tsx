import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "../../lib/locale";
import { LandingExperience } from "../landing/landing-experience";
import "../landing/landing.css";
import "../landing/landing-themes.css";

export const metadata: Metadata = {
  title: "Aqua & charcoal preview | Futures Medialab",
  description:
    "Explore the Futures Medialab landing page in crisp aqua, white, neutral gray, and charcoal.",
  robots: { index: false, follow: false },
};

export default async function TheFairLandingPage({
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

  return <LandingExperience initialLocale={locale} theme="thefair" />;
}
