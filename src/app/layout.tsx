import { NavigationProgress } from "@/components/navigation-progress";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import { switzer } from "./fonts/switzer";
import "./globals.css";

// Interface face: Switzer, the website's face (self-hosted), for the site, sign-in, dashboard and console.
// Set on <html> so portalled menus and dialogs get it too. Data face: JetBrains Mono for figures,
// hashes, cookie names and code.
const dataFont = JetBrains_Mono({ subsets: ["latin"], variable: "--font-data", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: site.keywords,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    siteName: site.name,
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    site: site.twitter,
    title: `${site.name}: ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false },
  // Search Console and Bing Webmaster verification, set per environment (no tag when unset)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior: smooth scrolling for in-page anchors only, not on route changes (Next reads it)
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${switzer.variable} ${dataFont.variable}`}>
      <body>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
