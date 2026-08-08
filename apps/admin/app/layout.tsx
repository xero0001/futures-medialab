import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Medialab Admin",
  description: "Internal operations console for Futures Medialab.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
