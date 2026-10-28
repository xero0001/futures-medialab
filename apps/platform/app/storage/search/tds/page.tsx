import type { Metadata } from "next";
import { WorkspacePage } from "../../_components/workspace-page";
import "../../_components/tds-workspace.css";
import "../../_components/tds-shell.css";

export const preferredRegion = "sin1";
export const metadata: Metadata = {
  title: "Creator search · Blue — Futures Medialab",
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return (
    <WorkspacePage mode="search" variant="tds" searchParams={searchParams} />
  );
}
