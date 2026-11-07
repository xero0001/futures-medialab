import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { requireBrandWorkspace } from "../../lib/brand-access";
import { resolveLocale } from "../../lib/locale";
import { BrandActivityProvider } from "./_components/brand-activity-provider";

export default async function AdvertiserLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    undefined,
    jar.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
  const account = await requireBrandWorkspace(locale);
  return (
    <BrandActivityProvider key={account.draftScope} scope={account.draftScope}>
      {children}
    </BrandActivityProvider>
  );
}
