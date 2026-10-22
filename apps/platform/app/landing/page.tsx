import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "../../lib/locale";
import { LandingExperience } from "./landing-experience";
import "./landing.css";

export const metadata: Metadata = {
  title: "New worlds. New connections. | Futures Medialab",
  description:
    "A new connection for global games and Korean creators. Bring your next campaign to life with Futures Medialab.",
};

export default async function NewLandingPage({
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

  return <LandingExperience initialLocale={locale} />;
}
