import { WorkspacePage } from "../../_components/workspace-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return <WorkspacePage mode="search" searchParams={searchParams} />;
}
