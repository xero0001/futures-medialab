import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { getSearchWorkspaceAccount } from "../../../../lib/brand-access";
import { resolveLocale } from "../../../../lib/locale";
import { SeedSearchWorkspace } from "./seed-search-workspace";
import "@seed-design/css/all.css";
import "./seed-search.css";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Creator search · SEED — Futures Medialab",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [query, jar, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
  ]);
  const locale = resolveLocale(
    query.lang,
    jar.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
  const account = await getSearchWorkspaceAccount(locale);
  return <SeedSearchWorkspace locale={locale} {...account} />;
}
