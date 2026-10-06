"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics: cookieless, no cross-site tracking, aggregate page views only.
 * We send the path alone: query strings (e.g. ?next=, ?plan=) and fragments are dropped so
 * nothing a visitor typed can end up in analytics, and the banner preview iframe isn't counted.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith("/preview-frame")) return null;
  return { ...event, url: `${url.origin}${url.pathname}` };
}

export function WebAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
