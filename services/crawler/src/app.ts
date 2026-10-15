/**
 * The dashboard modules the worker reuses, imported in one place. The worker never re-implements
 * classification or storage: findings come from the same tracker database and HTML classifier as
 * the dashboard's fetch scan, and results go through the same store and triage rules.
 */
export { classifyPages, cookieLifetime, type PageCapture as HtmlPageCapture } from "@/lib/scan";
export { matchCookie, matchUrl, primaryPattern, type TrackerDef } from "@/lib/tracker-db";
export { registrableDomain, sameSite } from "@/lib/site-audit/crawl";
export { isPrivate } from "@/lib/safe-fetch";
export { getStore } from "@/lib/store";
export { id } from "@/lib/crypto";
export {
  SCAN_LOG_KEEP,
  candidatesFrom,
  isScanActive,
  mergeScan,
  trackerPatch,
  type Finding,
  type ScanLogLine,
  type ScanPage,
  type ScanReport,
} from "@/lib/trackers";
export type { CrawlMessage } from "@/lib/crawler";
