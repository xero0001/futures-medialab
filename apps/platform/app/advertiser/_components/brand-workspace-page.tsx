import { cookies, headers } from "next/headers";
import { requireBrandWorkspace } from "../../../lib/brand-access";
import { resolveLocale } from "../../../lib/locale";
import { LiveBrandWorkspace, type LiveBrandWorkspaceMode } from "./live-brand-workspace";

export async function BrandWorkspacePage({
  mode,
  searchParams,
  campaignId,
}: {
  mode: LiveBrandWorkspaceMode;
  searchParams: Promise<{ lang?: string; draft?: string; route?: string }>;
  campaignId?: string;
}) {
  const [query, jar, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const locale = resolveLocale(query.lang, jar.get("fm-locale")?.value, requestHeaders.get("accept-language"));
  const account = await requireBrandWorkspace(locale);
  return <LiveBrandWorkspace locale={locale} account={account} mode={mode} campaignId={campaignId ?? query.draft} initialRoute={query.route === "open" ? "open" : "managed"} />;
}
