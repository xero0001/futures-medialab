import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPostAuthDestination } from "../../../lib/brand-access";
import { resolveLocale } from "../../../lib/locale";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Continue — Futures Medialab",
  robots: { index: false, follow: false },
};

export default async function ContinueAfterAuth({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [query, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
  ]);
  const locale = resolveLocale(
    query.lang,
    cookieStore.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
  // Destinations are selected on the server, never from a caller-provided URL.
  redirect(await getPostAuthDestination(locale));
}
