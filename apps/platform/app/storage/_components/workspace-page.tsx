import { cookies, headers } from "next/headers";
import { requireBrandWorkspace } from "../../../lib/brand-access";
import { resolveLocale } from "../../../lib/locale";
import { CreatorWorkspace, type WorkspaceMode } from "./creator-workspace";

export async function WorkspacePage({
  mode,
  searchParams,
}: {
  mode: WorkspaceMode;
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
  const account = await requireBrandWorkspace(locale);
  return <CreatorWorkspace mode={mode} initialLocale={locale} {...account} />;
}
