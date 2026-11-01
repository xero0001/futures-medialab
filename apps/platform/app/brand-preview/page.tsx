import type { Metadata } from "next";
import BrandPreview from "./_components/brand-preview";

export const metadata: Metadata = {
  title: "브랜드 워크스페이스 시안 — Futures MediaLab",
  description: "Futures MediaLab 브랜드 화면 검토용 시안. 모든 캠페인과 인물은 예시입니다.",
  robots: { index: false, follow: false },
};

export default function BrandPreviewPage() {
  return <BrandPreview />;
}
