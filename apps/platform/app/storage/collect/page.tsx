import type { Metadata } from "next";
import { WorkspacePage } from "../../storage/_components/workspace-page";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Collections — Futures Medialab",
  robots: { index: false, follow: false },
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return <WorkspacePage mode="collect" searchParams={searchParams} />;
}
