import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { resolveLocale } from "../lib/locale";
import { PublicHome } from "./_components/public-home/public-home";
import { homeCopy } from "./_components/public-home/copy";

type HomeProps = { searchParams: Promise<{ lang?: string }> };
const requestLocale = cache(async (requested?: string) => {
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  return resolveLocale(
    requested,
    cookieStore.get("fm-locale")?.value,
    requestHeaders.get("accept-language"),
  );
});
export async function generateMetadata({
  searchParams,
}: HomeProps): Promise<Metadata> {
  const locale = await requestLocale((await searchParams).lang);
  const { title, description } = homeCopy[locale];
  return { title, description };
}
export default async function HomePage({ searchParams }: HomeProps) {
  const locale = await requestLocale((await searchParams).lang);
  return <PublicHome initialLocale={locale} />;
}
