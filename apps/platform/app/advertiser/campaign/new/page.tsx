import type { Metadata } from "next";
import { BrandWorkspacePage } from "../../_components/brand-workspace-page";

export const preferredRegion = "sin1";
export const metadata: Metadata = { title: "New campaign — Futures Medialab", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<{ lang?: string; draft?: string; route?: string }> }) {
  return <BrandWorkspacePage mode="new" searchParams={searchParams} />;
}
