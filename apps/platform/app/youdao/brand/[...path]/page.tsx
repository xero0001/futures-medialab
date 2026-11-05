import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DiscoveryScreen } from "../_components/discovery-screens";
import { AgentScreen } from "../_components/agent-screens";
import { OperationsScreen } from "../_components/operations-screens";

const paths = [
  "storage/search",
  "storage/similar-search",
  "storage/similar-brands",
  "storage/similar-brands/example",
  "storage/collect",
  "agent",
  "agent/social-media-data",
  "mention",
  "comment/analyze",
  "shortLinks",
  "advertiser/campaign",
  "advertiser/accountManagement",
] as const;

export function generateStaticParams() {
  return paths.map((path) => ({ path: path.split("/") }));
}

export default async function YoudaoReferencePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const route = path.join("/");
  let content;
  switch (route) {
    case "storage/search":
      content = <DiscoveryScreen page="search" />;
      break;
    case "storage/similar-search":
      content = <DiscoveryScreen page="similar-search" />;
      break;
    case "storage/similar-brands":
      content = <DiscoveryScreen page="similar-brands" />;
      break;
    case "storage/similar-brands/example":
      content = <DiscoveryScreen page="similar-brands-example" />;
      break;
    case "storage/collect":
      content = <DiscoveryScreen page="collect" />;
      break;
    case "agent":
      content = <AgentScreen page="agent" />;
      break;
    case "agent/social-media-data":
      content = <AgentScreen page="social-media-data" />;
      break;
    case "mention":
      content = <AgentScreen page="mention" />;
      break;
    case "comment/analyze":
      content = <AgentScreen page="comment-analyze" />;
      break;
    case "shortLinks":
      content = <OperationsScreen page="short-links" />;
      break;
    case "advertiser/campaign":
      content = <OperationsScreen page="campaign" />;
      break;
    case "advertiser/accountManagement":
      content = <OperationsScreen page="account" />;
      break;
    default:
      notFound();
  }
  return (
    <Suspense fallback={<p role="status">화면을 불러오는 중입니다.</p>}>
      {content}
    </Suspense>
  );
}
