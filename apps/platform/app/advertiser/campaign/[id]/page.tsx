import type { Metadata } from "next";
import { BrandWorkspacePage } from "../../_components/brand-workspace-page";

export const preferredRegion = "sin1";
export const metadata: Metadata = { title: "Campaign — Futures Medialab", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  return <BrandWorkspacePage mode="detail" campaignId={id} searchParams={searchParams} />;
}
