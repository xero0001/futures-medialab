import type { Metadata } from "next";
import { PretendardFont } from "@futures-medialab/ui/pretendard-font";

import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Medialab Admin",
  description: "Internal operations console for Futures Medialab.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Montage forces light mode before hydration; emit the same attributes on the server.
  return (
    <html lang="ko" data-theme="light" style={{ colorScheme: "light" }}>
      <head>
        <PretendardFont />
      </head>
      <body>{children}</body>
    </html>
  );
}
