import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Medialab Admin",
  description: "Internal operations console for Futures Medialab.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
