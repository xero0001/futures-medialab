import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveLocale } from "../../../lib/locale";
import { RegisterForm } from "../register-form";
import { isRegistrationRole } from "../register-copy";

export const metadata: Metadata = {
  title: "Create your account — Futures Medialab",
  description: "Set up your organization profile for Futures Medialab.",
};

export default async function RoleRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [route, query, cookieStore, requestHeaders] = await Promise.all([
    params,
    searchParams,
    cookies(),
    headers(),
  ]);
  if (!isRegistrationRole(route.role)) notFound();
  const locale = resolveLocale(
    query.lang,
    cookieStore.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
  return (
    <RegisterForm key={route.role} initialLocale={locale} role={route.role} />
  );
}
