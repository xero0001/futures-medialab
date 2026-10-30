import { cookies, headers } from "next/headers";
import { requireBrandWorkspace } from "../../../lib/brand-access";
import { resolveLocale } from "../../../lib/locale";
import { Montage2Search } from "../search/montage2/montage2-search";
import { CreatorWorkspace, type WorkspaceMode } from "./creator-workspace";

export async function WorkspacePage({
  mode,
  searchParams,
  variant = "default",
}: {
  mode: WorkspaceMode;
  searchParams: Promise<{ lang?: string }>;
  variant?: "default" | "tds";
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
  if (mode === "search" && variant === "default")
    return (
      <Montage2Search
        locale={locale}
        {...account}
        isGuest={false}
        serviceView
      />
    );
  return (
    <CreatorWorkspace
      mode={mode}
      variant={variant}
      initialLocale={locale}
      {...account}
    />
  );
}
