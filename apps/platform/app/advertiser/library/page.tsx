import type { Metadata } from "next";
import { BrandWorkspacePage } from "../_components/brand-workspace-page";

export const preferredRegion = "sin1";
export const metadata: Metadata = { title: "Library — Futures Medialab", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  return <BrandWorkspacePage mode="library" searchParams={searchParams} />;
}
