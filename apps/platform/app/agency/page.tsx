import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { requireAgencyWorkspace } from "../../lib/agency-access";
import { resolveLocale } from "../../lib/locale";
import { AgencyWorkspace } from "./agency-workspace";
import { agencySections, type AgencySection } from "./agency-workspace-copy";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Agency workspace — Futures Medialab",
  robots: { index: false, follow: false },
};

export default async function AgencyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; section?: string }>;
}) {
  const [query, jar, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const locale = resolveLocale(query.lang, jar.get("fm-locale")?.value, requestHeaders.get("accept-language"));
  const account = await requireAgencyWorkspace(locale);
  const section = agencySections.includes(query.section as AgencySection) ? query.section as AgencySection : "offers";
  return <AgencyWorkspace initialLocale={locale} initialSection={section} {...account} />;
}
