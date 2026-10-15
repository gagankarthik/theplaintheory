export type CookieSource = "cdp-jar" | "set-cookie-header" | "document.cookie";

export interface CapturedCookie {
  name: string;
  /** Cookie Domain as reported ("." prefix = domain cookie, none = host-only). */
  domain: string;
  path: string;
  /** Absolute expiry in epoch seconds; null = session cookie. */
  expires: number | null;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  partitioned: boolean;
  size: number;
  sources: CookieSource[];
  /** URL of the response that set it (header-derived cookies only). */
  setByUrl: string | null;
  /** Pages on which the cookie was observed. */
  seenOnUrls: string[];
}

export type StorageKind = "LOCAL_STORAGE" | "SESSION_STORAGE";

export interface CapturedStorageKey {
  key: string;
  storageType: StorageKind;
  /** Origin host (with port) that owns the storage area. */
  host: string;
  valueLength: number;
  seenOnUrls: string[];
}

export interface CapturedRequestHost {
  host: string;
  requestCount: number;
  resourceTypes: string[];
  sampleUrl: string;
  /** Distinct request URLs (query stripped) with their resource type, at most 25 per host. */
  samples: Array<{ url: string; resourceType: string }>;
  /** Pages on which requests to this host were made (at most 20). */
  pages: string[];
  /** True when the host is outside the scanned site's registrable domain. */
  thirdParty: boolean;
}

export interface PageResult {
  url: string;
  finalUrl: string;
  depth: number;
  status: number | null;
  title: string | null;
  ok: boolean;
  error: string | null;
  durationMs: number;
  cookiesSeen: number;
  requestsSeen: number;
  linksFound: number;
}

export type ScanLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface ScanProgress {
  pagesScanned: number;
  pagesQueued: number;
  cookiesFound: number;
  trackersFound: number;
}

export interface ScanOptions {
  startUrl: string;
  maxDepth: number;
  maxPages: number;
  pageTimeoutMs?: number;
  settleMs?: number;
  pageDelayMs?: number;
  respectRobots?: boolean;
  /**
   * Wall-clock budget for the whole crawl. Once spent, no new page is started (the first page always
   * is) and the result comes back with timedOut set and whatever was captured so far.
   */
  deadlineMs?: number;
  signal?: AbortSignal;
  onLog?: (level: ScanLogLevel, message: string, url?: string | null, meta?: Record<string, unknown>) => void;
  onProgress?: (progress: ScanProgress) => void;
  /** Called after each page with its rendered HTML and raw Set-Cookie headers. */
  onPage?: (page: { url: string; html: string; setCookies: string[] }) => void;
  /** SSRF guard applied to every browser request (see net-guard.ts). */
  guard?: (url: string) => Promise<boolean>;
}

export interface ScanResult {
  startUrl: string;
  /** Host of the start URL after redirects (no port). */
  siteHost: string;
  startedAt: string;
  finishedAt: string;
  aborted: boolean;
  /** Stopped early because deadlineMs ran out; pages and findings are partial. */
  timedOut: boolean;
  pages: PageResult[];
  cookies: CapturedCookie[];
  storage: CapturedStorageKey[];
  requestHosts: CapturedRequestHost[];
  skippedByRobots: string[];
  userAgent: string;
}
