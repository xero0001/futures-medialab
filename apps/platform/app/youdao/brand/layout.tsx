import type { Metadata } from "next";
import ReferenceShell from "./_components/reference-shell";

export const metadata: Metadata = {
  title: "Youdao Ads 한국어 화면 참고 — Futures MediaLab",
  description:
    "Youdao Ads 브랜드 화면의 한국어 UI 참고. 모든 데이터는 화면 검토를 위한 예시입니다.",
  robots: { index: false, follow: false },
};

export default function YoudaoBrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReferenceShell>{children}</ReferenceShell>;
}
