import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Medialab — Global games. Local influence.",
  description:
    "Game marketing connecting global brands with approved Korean MCNs and agencies, from campaign planning and localization to review and settlement.",
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
