import type { BrowserContext, CDPSession, HTTPRequest, HTTPResponse, Page } from "puppeteer";
import type { Protocol } from "puppeteer";
import { privateNetworkAllowed } from "../net-guard";
import { getSetCookieHeader, parseSetCookieHeader } from "./set-cookie";
import type { CookieSource, StorageKind } from "./types";

export interface PageCookieObservation {
  name: string;
  domain: string;
  path: string;
  expires: number | null;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  partitioned: boolean;
  size: number;
  source: CookieSource;
  setByUrl: string | null;
}

export interface PageStorageObservation {
  key: string;
  storageType: StorageKind;
  host: string;
  valueLength: number;
}

export interface PageRequestObservation {
  url: string;
  resourceType: string;
}

export interface PageCapture {
  finalUrl: string;
  status: number | null;
  title: string | null;
  cookies: PageCookieObservation[];
  storage: PageStorageObservation[];
  requests: PageRequestObservation[];
  links: string[];
  /** the page's rel="canonical" address, when it declares one */
  canonical: string | null;
  /** Rendered DOM after scripts ran (capped), for the dashboard's HTML classifier. */
  html: string;
  /** Raw Set-Cookie headers seen while loading the page (each line one cookie). */
  setCookieHeaders: string[];
  /** Requests the network guard refused (private / metadata addresses). */
  blocked: string[];
  /** Non-fatal problems (e.g. networkidle timeout) worth surfacing in the scan log. */
  warnings: string[];
}

export interface CaptureOptions {
  userAgent: string;
  timeoutMs: number;
  settleMs: number;
  /** Decides whether each request may leave the browser (SSRF guard). Omitted = allow all. */
  guard?: (url: string) => Promise<boolean>;
  /** Cap on the HTML kept for classification. */
  maxHtmlBytes?: number;
}

const DEFAULT_MAX_HTML = 2_000_000;

interface DomSnapshot {
  host: string;
  local: Array<[string, number]>;
  session: Array<[string, number]>;
  documentCookies: string[];
  links: string[];
  canonical?: string | null;
}

/**
 * In-page collector, kept as plain JavaScript source on purpose: functions passed to page.evaluate are
 * serialised with Function#toString, so any helper a bundler injects (e.g. esbuild keepNames `__name`)
 * would throw inside the page. Names and value lengths only — storage values never leave the page.
 */
const COLLECT_DOM_SCRIPT = `(() => {
  function readStorage(area) {
    var out = [];
    if (!area) return out;
    for (var i = 0; i < area.length; i++) {
      var key = area.key(i);
      if (key !== null) out.push([key, (area.getItem(key) || "").length]);
    }
    return out;
  }
  var local = [], session = [], documentCookies = [], links = [], canonical = null;
  try { local = readStorage(window.localStorage); } catch (e) { local = []; }
  try { session = readStorage(window.sessionStorage); } catch (e) { session = []; }
  try {
    documentCookies = document.cookie.split(";").map(function (p) { return (p.split("=")[0] || "").trim(); }).filter(Boolean);
  } catch (e) { documentCookies = []; }
  try {
    links = Array.prototype.map.call(document.querySelectorAll("a[href]"), function (a) { return a.href; }).slice(0, 2000);
  } catch (e) { links = []; }
  try {
    var c = document.querySelector('link[rel="canonical"][href]');
    canonical = c ? c.href : null;
  } catch (e) { canonical = null; }
  return { host: location.host, local: local, session: session, documentCookies: documentCookies, links: links, canonical: canonical };
})()`;

/** Scrolls the page to trigger lazy-loaded embeds and scroll-depth beacons (plain JS for the same reason). */
const SCROLL_SCRIPT = `(async () => {
  var step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  var max = Math.min((document.body && document.body.scrollHeight) || 0, 12000);
  for (var y = 0; y < max; y += step) {
    window.scrollTo(0, y);
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  window.scrollTo(0, 0);
})()`;

/** Makes navigator.serviceWorker.register reject in every frame before page scripts run (plain JS, see above). */
const NO_SERVICE_WORKER_SCRIPT = `(() => {
  try {
    if (typeof ServiceWorkerContainer !== "undefined") {
      Object.defineProperty(ServiceWorkerContainer.prototype, "register", {
        configurable: false,
        writable: false,
        value: function () { return Promise.reject(new DOMException("Service workers are disabled", "SecurityError")); },
      });
    }
  } catch (e) {}
})()`;

/**
 * Wraps the WebSocket constructor so handshakes to literal loopback, private, link-local and internal
 * hosts throw before connecting. Chromium's request interception and CDP URL blocking both miss
 * WebSockets, so this runs in every frame before page scripts (plain JS, see above). Not covered: a host
 * name that resolves privately, and sockets opened from workers (see net-guard.ts, residual risk).
 */
const NO_PRIVATE_WEBSOCKET_SCRIPT = String.raw`(() => {
  try {
    var Native = window.WebSocket;
    if (!Native) return;
    var isPrivateHost = function (host) {
      var h = String(host).toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
      if (h === "localhost" || /\.(localhost|internal)$/.test(h)) return true;
      var m = h.match(/^(?:::ffff:)?(\d+)\.(\d+)\.\d+\.\d+$/);
      if (m) {
        var a = +m[1], b = +m[2];
        return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
      }
      return h.indexOf(":") !== -1 && (h === "::" || h === "::1" || /^(fc|fd|fe80|::ffff:)/.test(h));
    };
    var Guarded = function WebSocket(url, protocols) {
      var parsed = null;
      try { parsed = new URL(String(url), location.href); } catch (e) {}
      if (parsed && isPrivateHost(parsed.hostname)) throw new DOMException("WebSockets to private addresses are blocked", "SecurityError");
      return arguments.length > 1 ? new Native(url, protocols) : new Native(url);
    };
    Guarded.prototype = Native.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { Object.defineProperty(Guarded, k, { value: Native[k] }); });
    Object.defineProperty(window, "WebSocket", { value: Guarded, configurable: false, writable: false });
  } catch (e) {}
})()`;

const MAX_REQUESTS_PER_PAGE = 2000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Visits one URL in the given (incognito) context and records every cookie, storage key and network
 * request observed. Uses a dedicated CDP session so raw Set-Cookie headers — including HttpOnly
 * cookies that JavaScript can never see — are read from Network.responseReceivedExtraInfo.
 */
export async function capturePage(context: BrowserContext, url: string, opts: CaptureOptions): Promise<PageCapture> {
  const page: Page = await context.newPage();
  const cookies: PageCookieObservation[] = [];
  const requests = new Map<string, PageRequestObservation>();
  const requestUrlsById = new Map<string, string>();
  const warnings: string[] = [];

  const recordRequest = (reqUrl: string, resourceType: string) => {
    if (!/^https?:/i.test(reqUrl) || requests.size >= MAX_REQUESTS_PER_PAGE) return;
    const key = `${resourceType}|${reqUrl}`;
    if (!requests.has(key)) requests.set(key, { url: reqUrl, resourceType: resourceType.toLowerCase() });
  };

  const setCookieHeaders: string[] = [];
  const blocked: string[] = [];

  const recordSetCookie = (header: string | null, responseUrl: string) => {
    if (!header) return;
    for (const line of header.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && setCookieHeaders.length < 500 && !setCookieHeaders.includes(trimmed)) setCookieHeaders.push(trimmed);
    }
    const responseHost = hostOf(responseUrl);
    for (const parsed of parseSetCookieHeader(header)) {
      cookies.push({
        name: parsed.name,
        domain: parsed.domain ? (parsed.domain.startsWith(".") ? parsed.domain : `.${parsed.domain}`) : responseHost,
        path: parsed.path ?? "/",
        expires: parsed.expires,
        httpOnly: parsed.httpOnly,
        secure: parsed.secure,
        sameSite: parsed.sameSite,
        partitioned: parsed.partitioned,
        size: parsed.name.length + parsed.valueLength,
        source: "set-cookie-header",
        setByUrl: responseUrl,
      });
    }
  };

  let cdp: CDPSession | null = null;
  try {
    await page.setUserAgent({ userAgent: opts.userAgent });
    await page.setViewport({ width: 1366, height: 900 });

    cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    // Cached responses replay without Set-Cookie; force the network so every cookie write is observed.
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    cdp.on("Network.requestWillBeSent", (e: Protocol.Network.RequestWillBeSentEvent) => {
      requestUrlsById.set(e.requestId, e.request.url);
      recordRequest(e.request.url, e.type ?? "Other");
    });
    cdp.on("Network.responseReceived", (e: Protocol.Network.ResponseReceivedEvent) => {
      recordRequest(e.response.url, e.type ?? "Other");
      // Fallback for engines that still surface Set-Cookie in the filtered header map.
      recordSetCookie(getSetCookieHeader(e.response.headers as Record<string, string>), e.response.url);
    });
    cdp.on("Network.responseReceivedExtraInfo", (e: Protocol.Network.ResponseReceivedExtraInfoEvent) => {
      const responseUrl = requestUrlsById.get(e.requestId) ?? url;
      recordSetCookie(getSetCookieHeader(e.headers as Record<string, string>), responseUrl);
    });

    // SSRF guard: every request (including redirects and subresources) is decided before it is sent.
    const guard = opts.guard;
    if (guard) {
      // Service workers fetch outside request interception, so pages may not register one, and any
      // request a worker would answer goes to the network (and through the guard) instead.
      await page.evaluateOnNewDocument(NO_SERVICE_WORKER_SCRIPT);
      await page.setBypassServiceWorker(true);
      // WebSocket handshakes are not interceptable either; refuse literal private addresses outright.
      if (!privateNetworkAllowed()) await page.evaluateOnNewDocument(NO_PRIVATE_WEBSOCKET_SCRIPT);
      await page.setRequestInterception(true);
      page.on("request", (req: HTTPRequest) => {
        if (req.isInterceptResolutionHandled()) return;
        // Every intercepted request is resolved exactly once: continued when the guard says yes,
        // aborted when it says no or throws. A request left unresolved would hang until the page timeout.
        void guard(req.url())
          .catch(() => false)
          .then((ok) => {
            if (req.isInterceptResolutionHandled()) return;
            if (ok) return req.continue();
            if (blocked.length < 100) blocked.push(req.url().slice(0, 300));
            return req.abort("blockedbyclient");
          })
          // Only fails when the page or request is already gone; nothing is left to resolve.
          .catch(() => undefined);
      });
    }

    // Puppeteer's own events also cover out-of-process iframes (YouTube, ad frames) that the page-level
    // CDP session cannot see; its response headers already merge the ExtraInfo Set-Cookie values.
    page.on("request", (req: HTTPRequest) => recordRequest(req.url(), req.resourceType()));
    page.on("response", (res: HTTPResponse) => {
      const req = res.request();
      recordRequest(res.url(), req.resourceType());
      if (req.frame() && req.frame() !== page.mainFrame()) {
        recordSetCookie(getSetCookieHeader(res.headers()), res.url());
      }
    });

    let status: number | null = null;
    try {
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: opts.timeoutMs });
      status = response?.status() ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A page that never goes network-idle (long-polling, chat widgets) is still worth inspecting.
      if (/timeout/i.test(message) && page.url() && page.url() !== "about:blank") {
        warnings.push(`Network did not settle within ${opts.timeoutMs}ms; captured what loaded`);
      } else {
        throw err;
      }
    }

    // Let consent-less tags fire, then scroll to trigger lazy-loaded embeds and scroll-depth beacons.
    await sleep(opts.settleMs);
    await page.evaluate(SCROLL_SCRIPT).catch(() => undefined);
    await sleep(Math.min(opts.settleMs, 1000));

    const finalUrl = page.url();
    const title = await page.title().catch(() => null);
    const maxHtml = opts.maxHtmlBytes ?? DEFAULT_MAX_HTML;
    const html = await page
      .content()
      .then((h) => (h.length > maxHtml ? h.slice(0, maxHtml) : h))
      .catch((err: unknown) => {
        warnings.push(`Could not read the rendered HTML: ${err instanceof Error ? err.message : String(err)}`);
        return "";
      });

    // Authoritative cookie jar for every URL the page talked to (includes HttpOnly and partitioned cookies).
    const jarUrls = [finalUrl, ...[...requests.values()].map((r) => r.url)];
    const uniqueJarUrls = [...new Set(jarUrls)].slice(0, 500);
    try {
      const { cookies: jar } = await cdp.send("Network.getCookies", { urls: uniqueJarUrls });
      for (const c of jar) {
        cookies.push({
          name: c.name,
          domain: c.domain,
          path: c.path,
          expires: c.session || c.expires <= 0 ? null : Math.floor(c.expires),
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite ?? null,
          partitioned: Boolean(c.partitionKey),
          size: c.size,
          source: "cdp-jar",
          setByUrl: null,
        });
      }
    } catch (err) {
      warnings.push(`CDP cookie jar read failed: ${err instanceof Error ? err.message : String(err)}`);
      const jar = await context.cookies().catch(() => []);
      for (const c of jar) {
        cookies.push({
          name: c.name,
          domain: c.domain,
          path: c.path,
          expires: c.session || c.expires <= 0 ? null : Math.floor(c.expires),
          httpOnly: c.httpOnly ?? false,
          secure: c.secure,
          sameSite: c.sameSite ?? null,
          partitioned: Boolean(c.partitionKey),
          size: c.size,
          source: "cdp-jar",
          setByUrl: null,
        });
      }
    }

    // What page scripts can see. Names only; values are never read beyond their length.
    const dom = await page
      .evaluate(COLLECT_DOM_SCRIPT)
      .then((value) => value as DomSnapshot)
      .catch((err: unknown) => {
        warnings.push(`DOM inspection failed: ${err instanceof Error ? err.message : String(err)}`);
        return { host: hostOf(finalUrl), local: [], session: [], documentCookies: [], links: [] } as DomSnapshot;
      });

    const pageHost = hostOf(finalUrl);
    for (const name of dom.documentCookies) {
      cookies.push({
        name,
        domain: pageHost,
        path: "/",
        expires: null,
        httpOnly: false,
        secure: false,
        sameSite: null,
        partitioned: false,
        size: name.length,
        source: "document.cookie",
        setByUrl: null,
      });
    }

    const storage: PageStorageObservation[] = [
      ...dom.local.map(([key, valueLength]) => ({ key, storageType: "LOCAL_STORAGE" as const, host: dom.host, valueLength })),
      ...dom.session.map(([key, valueLength]) => ({ key, storageType: "SESSION_STORAGE" as const, host: dom.host, valueLength })),
    ];

    return {
      finalUrl,
      status,
      title,
      cookies,
      storage,
      requests: [...requests.values()],
      links: dom.links,
      canonical: dom.canonical ?? null,
      html,
      setCookieHeaders,
      blocked,
      warnings,
    };
  } finally {
    if (cdp) await cdp.detach().catch(() => undefined);
    await page.close().catch(() => undefined);
  }
}
