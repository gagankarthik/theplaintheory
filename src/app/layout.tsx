import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Plain Theory",
  description: "Minimalist habit tracking app",
  
  keywords: [
    "habit tracker",
    "minimalist productivity app",
    "daily routines",
    "goal tracking",
    "self improvement",
    "The Plain Theory",
    "track habits",
    "productivity tools",
  ],

  authors: [
    {
      name: "Gagan Mullapudi",
    },
  ],
  other: {
    "google-site-verification": "google91f2696981cae7ed.html",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
