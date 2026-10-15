import type { CrawlMessage } from "./app";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Parses an SQS body into the crawl message sent by the dashboard (lib/crawler requestCrawl). */
export function parseCrawlMessage(body: string | undefined): CrawlMessage | null {
  if (!body) return null;
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "CRAWL") return null;
  if (typeof d.propertyId !== "string" || !ID.test(d.propertyId)) return null;
  if (typeof d.scanId !== "string" || !ID.test(d.scanId)) return null;
  return { type: "CRAWL", propertyId: d.propertyId, scanId: d.scanId };
}
