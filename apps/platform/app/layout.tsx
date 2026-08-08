import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Medialab",
  description: "Global creator campaigns, managed with confidence.",
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
