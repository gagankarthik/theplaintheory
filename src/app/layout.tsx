import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import { switzer } from "./fonts/switzer";
import "./globals.css";
import Script from "next/script";

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
  alternates: { canonical: "/" },
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
    <html lang="en" suppressHydrationWarning className={`${switzer.variable} ${dataFont.variable}`}>
      <body>
      <Script
          src="https://d34dtur9cre43o.cloudfront.net/sdk/v1/plain-consent.js"
          data-site="pk_cCHNxnAZH9iKfdjV"
          data-api="https://www.theplaintheory.in/api/v1"
          data-config-url="https://d34dtur9cre43o.cloudfront.net/c/pk_cCHNxnAZH9iKfdjV.json"
          data-gcm="true"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
