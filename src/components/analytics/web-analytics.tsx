"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * The owner's own measurement of the public marketing site, both from Vercel and both cookieless:
 *   - Web Analytics: aggregate page views (visitor counts)
 *   - Speed Insights: real-visitor Core Web Vitals (how fast pages load and respond)
 * Mounted in the marketing layout and the 404 page only, so customers using the dashboard are never measured.
 * Both send the path alone: query strings (e.g. ?next=, ?plan=) and fragments are dropped so nothing a
 * visitor typed can leave the page, and the banner preview iframe isn't measured.
 */
function cleanUrl<T extends { url: string }>(event: T): T | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith("/preview-frame")) return null;
  return { ...event, url: `${url.origin}${url.pathname}` };
}

export function WebAnalytics() {
  return (
    <>
      <Analytics beforeSend={(e: BeforeSendEvent) => cleanUrl(e)} />
      <SpeedInsights beforeSend={cleanUrl} />
    </>
  );
}
