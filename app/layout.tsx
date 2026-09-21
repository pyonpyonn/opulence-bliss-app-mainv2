// SETUP: code "app/layout.tsx"
//
// Root layout — fonts, metadata, and the components that appear on every page.

import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import Toaster from "@/components/Toaster";
import RatingGate from "@/components/RatingGate";
import SupportChat from "@/components/SupportChat";
import EnvironmentBanner from "@/components/EnvironmentBanner";

// Self-hosted by Next, so no extra request to Google and no flash of
// unstyled text. Components ask for "Nunito" by name and get this.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Opulence Bliss — trusted home cleaning in London",
  description:
    "Vetted home cleaners across London. Book flexible home-cleaning visits and pay securely after the visit.",
  robots:
    process.env.VERCEL_ENV === "preview"
      ? { index: false, follow: false, noarchive: true }
      : { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${nunito.className} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <body>
        <EnvironmentBanner />
        <TopBar />
        <SiteHeader />
        {children}
        <Toaster />
        <RatingGate />
        <SupportChat />
      </body>
    </html>
  );
}
