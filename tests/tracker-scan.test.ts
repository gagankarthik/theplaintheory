import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KNOWN_TRACKERS } from "@/lib/defaults";
import { toPublicConfig } from "@/lib/public-config";
import { classifyPages, cookieLifetime, pickPages, type PageCapture } from "@/lib/scan";
import { TRACKER_DB, matchCookie, matchInline, matchUrl, primaryPattern, urlPatternMatches } from "@/lib/tracker-db";
import { candidatesFrom, heldTrackers, mergeScan, sdkTrackers, statusOf, suggested, type Finding, type ScanReport } from "@/lib/trackers";
import type { Property, Tracker } from "@/lib/types";
import type { Store } from "@/lib/store/types";

describe("tracker database", () => {
  it("has at least 150 entries with unique ids and complete metadata", () => {
    expect(TRACKER_DB.length).toBeGreaterThanOrEqual(150);
    expect(new Set(TRACKER_DB.map((t) => t.id)).size).toBe(TRACKER_DB.length);
    for (const t of TRACKER_DB) {
      expect(t.name && t.vendor && t.purpose, t.id).toBeTruthy();
      expect((t.urls?.length ?? 0) + (t.cookies?.length ?? 0), `${t.id} matches nothing`).toBeGreaterThan(0);
    }
  });

  it("agrees with KNOWN_TRACKERS (the SDK's built-in list): same pattern, same category", () => {
    for (const k of KNOWN_TRACKERS) {
      const m = matchUrl(`https://${k.pattern}/x.js`);
      expect(m, k.pattern).not.toBeNull();
      expect(primaryPattern(m!.def), k.name).toBe(k.pattern);
      expect(m!.def.category, k.name).toBe(k.category);
    }
  });

  it("matches hosts and their subdomains, not look-alikes", () => {
    expect(matchUrl("https://www.clarity.ms/tag/abc")?.def.id).toBe("microsoft-clarity");
    expect(matchUrl("https://clarity.ms/tag/abc")?.def.id).toBe("microsoft-clarity");
    expect(matchUrl("https://notclarity.ms/tag.js")).toBeNull();
    expect(matchUrl("https://clarity.ms.evil.example/tag.js")).toBeNull();
    expect(matchUrl("//static.hotjar.com/c/hotjar-1.js?sv=6")?.def.id).toBe("hotjar");
    expect(matchUrl("data:text/javascript,1")).toBeNull();
  });

  it("prefers the most specific pattern: host + path beats host", () => {
    expect(matchUrl("https://www.googletagmanager.com/gtag/js?id=G-ABC")?.def.id).toBe("google-analytics");
    expect(matchUrl("https://www.googletagmanager.com/gtm.js?id=GTM-1")?.def.id).toBe("google-tag-manager");
    expect(matchUrl("https://tt.omtrdc.net/rest/v1")?.def.id).toBe("adobe-target");
    expect(matchUrl("https://acme.sc.omtrdc.net/b/ss")?.def.id).toBe("adobe-analytics");
    expect(matchUrl("https://www.youtube.com/embed/xyz")?.def.id).toBe("youtube");
    expect(matchUrl("https://www.youtube.com/watch?v=1")).toBeNull();
  });

  it("matches first-party path patterns on any host", () => {
    expect(matchUrl("https://acme.in/_vercel/insights/script.js")?.def.id).toBe("vercel-analytics");
    expect(matchUrl("https://stats.acme.in/matomo.js")?.def.id).toBe("matomo");
    expect(urlPatternMatches("/_vercel/insights", "acme.in", "/_vercel/insights/view")).toBe(true);
    expect(urlPatternMatches("googletagmanager.com/gtag", "www.googletagmanager.com", "/gtag/js")).toBe(true);
    expect(urlPatternMatches("googletagmanager.com/gtag", "www.googletagmanager.com", "/gtm.js")).toBe(false);
  });

  it("matches cookie names exactly or by wildcard, exact first", () => {
    expect(matchCookie("_ga")?.def.id).toBe("google-analytics");
    expect(matchCookie("_ga_ABC123")).toMatchObject({ matched: "_ga_*", expiry: "2 years" });
    expect(matchCookie("_gid")?.def.id).toBe("google-analytics-legacy");
    expect(matchCookie("_hjSessionUser_12345")?.def.id).toBe("hotjar");
    expect(matchCookie("_pk_id.1.abcd")?.def.id).toBe("matomo");
    expect(matchCookie("PHPSESSID")?.def.category).toBe("essential");
    expect(matchCookie("__cf_bm")?.def.id).toBe("cloudflare-bot");
    expect(matchCookie("_GA")).toBeNull();
    expect(matchCookie("my_app_pref")).toBeNull();
  });

  it("recognises inline snippets", () => {
    expect(matchInline("!function(f,b,e,v,n,t,s){...}; fbq('init', '123');").map((d) => d.id)).toContain("meta-pixel");
    expect(matchInline("window._hjSettings={hjid:1}").map((d) => d.id)).toContain("hotjar");
    expect(matchInline("console.log('hi')")).toEqual([]);
  });
});

/* ---------------- classification of a fixture crawl ---------------- */

const home: PageCapture = {
  url: "https://www.acme.in/",
  html: `<!doctype html><html><head>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC"></script>
    <script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('config', 'G-ABC');</script>
    <script>(function(w,d,s,l,i){var j=d.createElement(s);j.src='https://www.googletagmanager.com/gtm.js?id='+i;})(window,document,'script','dataLayer','GTM-X');</script>
    <script src="/static/app.js"></script>
    <script src="https://cdn.acme-assets.in/x.js"></script>
    <script src="https://cdn.unknownvendor.io/track.js"></script>
    <script type="application/ld+json">{"@context":"https://schema.org"}</script>
    <!-- <script src="https://static.hotjar.com/commented-out.js"></script> -->
  </head><body>
    <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1&ev=PageView&noscript=1"/></noscript>
    <img src="https://images.example-cdn.com/hero.jpg" width="800" height="400">
    <img src="https://px.unknown-ads.net/p.gif" width="1" height="1">
    <iframe src="https://www.youtube.com/embed/abc"></iframe>
    <a href="/pricing">Pricing</a>
  </body></html>`,
  setCookies: ["PHPSESSID=abc; Path=/; HttpOnly", "_ga=GA1.1.1; Domain=.acme.in; Max-Age=63072000; Path=/", "weird_cookie=1; Max-Age=86400", "ads_id=1; Domain=.adnetwork.example; Max-Age=600"],
};
const pricing: PageCapture = {
  url: "https://www.acme.in/pricing",
  html: `<script src="https://static.hotjar.com/c/hotjar-1.js?sv=6"></script><script src="https://www.googletagmanager.com/gtag/js?id=G-ABC"></script>`,
  setCookies: [],
};

describe("classifyPages", () => {
  const findings = classifyPages([home, pricing], "www.acme.in");
  const by = (pred: (f: Finding) => boolean) => findings.filter(pred);
  const one = (pred: (f: Finding) => boolean) => {
    const hits = by(pred);
    expect(hits).toHaveLength(1);
    return hits[0];
  };

  it("classifies known scripts and records every page they're on", () => {
    const ga = one((f) => f.kind === "script" && f.dbId === "google-analytics");
    expect(ga).toMatchObject({ name: "Google Analytics", vendor: "Google", category: "analytics", party: "third", pattern: "googletagmanager.com/gtag" });
    expect(ga.pages).toEqual(["https://www.acme.in/", "https://www.acme.in/pricing"]);
    expect(one((f) => f.dbId === "hotjar").pages).toEqual(["https://www.acme.in/pricing"]);
  });

  it("finds loaders written inside inline snippets", () => {
    expect(one((f) => f.dbId === "google-tag-manager")).toMatchObject({ kind: "script", category: "essential" });
  });

  it("finds pixels and embeds", () => {
    expect(one((f) => f.dbId === "meta-pixel")).toMatchObject({ kind: "pixel", category: "marketing", pattern: "connect.facebook.net" });
    expect(one((f) => f.dbId === "youtube")).toMatchObject({ kind: "iframe", category: "marketing" });
    expect(one((f) => f.host === "px.unknown-ads.net")).toMatchObject({ kind: "pixel", category: null, party: "third" });
    expect(by((f) => f.host === "images.example-cdn.com")).toEqual([]);
  });

  it("puts unknown third-party hosts in review and leaves the site's own files out", () => {
    expect(one((f) => f.host === "cdn.unknownvendor.io")).toMatchObject({ kind: "script", category: null, party: "third", pattern: "cdn.unknownvendor.io" });
    expect(one((f) => f.host === "cdn.acme-assets.in")).toMatchObject({ category: null, party: "third" });
    expect(by((f) => f.sample?.includes("/static/app.js") ?? false)).toEqual([]);
    expect(by((f) => f.sample?.includes("commented-out") ?? false)).toEqual([]);
    expect(by((f) => f.sample?.includes("schema.org") ?? false)).toEqual([]);
  });

  it("ignores framework hydration data that quotes snippets (e.g. a docs page)", () => {
    const docs: PageCapture = {
      url: "https://www.acme.in/docs",
      html: `<script>self.__next_f.push([1,"src=\\"https://www.googletagmanager.com/gtag/js?id=G-X\\" fbq('init', '1')"])</script>`,
      setCookies: [],
    };
    expect(classifyPages([docs], "www.acme.in")).toEqual([]);
  });

  it("lists cookies with party, category and lifetime", () => {
    expect(one((f) => f.sample === "PHPSESSID")).toMatchObject({ kind: "cookie", category: "essential", party: "first", expiry: "Session", pattern: "PHPSESSID" });
    expect(one((f) => f.sample === "_ga")).toMatchObject({ kind: "cookie", category: "analytics", party: "first", expiry: "2 years", pattern: "googletagmanager.com/gtag" });
    expect(one((f) => f.sample === "weird_cookie")).toMatchObject({ category: null, party: "first", expiry: "1 day" });
    expect(one((f) => f.sample === "ads_id")).toMatchObject({ party: "third", host: "adnetwork.example" });
  });

  it("reads cookie lifetimes", () => {
    expect(cookieLifetime("a=1; Max-Age=1800")).toBe("30 minutes");
    expect(cookieLifetime("a=1; Max-Age=31536000")).toBe("1 year");
    expect(cookieLifetime("a=1; Max-Age=0")).toBe("Deleted");
    expect(cookieLifetime("a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT", Date.parse("2026-10-14T07:28:00Z"))).toBe("7 days");
    expect(cookieLifetime("a=1; Path=/")).toBe("Session");
  });

  it("picks same-site pages across sections, shallow first, skipping assets and sign-out", () => {
    const html = `<a href="/blog/a">a</a><a href="/blog/b">b</a><a href="/pricing">p</a><a href="/about#team">t</a><a href="https://other.example/x">x</a>
      <a href="/files/terms.pdf">pdf</a><a href="/logout">out</a><a href="https://shop.acme.in/">shop</a><a href="/">home</a>`;
    const picked = pickPages(html, "https://www.acme.in/", "acme.in", new Set(["https://www.acme.in/"]));
    expect(picked).toEqual(["https://shop.acme.in/", "https://www.acme.in/about", "https://www.acme.in/pricing", "https://www.acme.in/blog/a", "https://www.acme.in/blog/b"]);
  });
});

/* ---------------- triage ---------------- */

describe("triage", () => {
  const now = "2026-10-07T10:00:00.000Z";
  let n = 0;
  const newId = () => `trk_new${++n}`;
  const findings = classifyPages([home, pricing], "www.acme.in");
  const candidates = candidatesFrom(findings);

  it("groups findings into one candidate per vendor product", () => {
    const ga = candidates.filter((c) => c.pattern === "googletagmanager.com/gtag");
    expect(ga).toHaveLength(1);
    // the _ga cookie joins the script finding, so approving it holds the script
    expect(ga[0]).toMatchObject({ kind: "script", category: "analytics", vendor: "Google" });
    expect(ga[0].samples).toContain("_ga");
    expect(candidates.find((c) => c.pattern === "PHPSESSID")).toMatchObject({ kind: "cookie", category: "essential" });
  });

  it("adds new trackers to review: classified ones with a category, unknown ones without", () => {
    const { trackers, added } = mergeScan([], candidates, { now, newId });
    expect(added.length).toBe(candidates.length);
    expect(trackers.every((t) => t.status === "review" && t.source === "scan")).toBe(true);
    expect(trackers.find((t) => t.pattern === "cdn.unknownvendor.io")?.category).toBeNull();
    expect(trackers.find((t) => t.pattern === "static.hotjar.com")).toMatchObject({ category: "analytics", vendor: "Contentsquare", foundOn: ["https://www.acme.in/pricing"], pageCount: 1, seenAt: now });
    expect(sdkTrackers(trackers)).toEqual([]);
    expect(suggested(trackers).map((t) => t.pattern)).toContain("static.hotjar.com");
    expect(suggested(trackers).map((t) => t.pattern)).not.toContain("cdn.unknownvendor.io");
  });

  it("never changes an approved tracker's status, category or pattern", () => {
    const existing: Tracker[] = [{ id: "trk_ga", name: "GA (ours)", category: "marketing", pattern: "googletagmanager.com/gtag" }];
    const { trackers, added } = mergeScan(existing, candidates, { now, newId });
    const ga = trackers.find((t) => t.id === "trk_ga")!;
    expect(statusOf(ga)).toBe("approved");
    expect(ga).toMatchObject({ name: "GA (ours)", category: "marketing", pattern: "googletagmanager.com/gtag", vendor: "Google", seenAt: now });
    expect(added.some((t) => t.pattern === "googletagmanager.com/gtag")).toBe(false);
  });

  it("recognises an existing hand-written pattern inside an address it covers", () => {
    const existing: Tracker[] = [{ id: "trk_hj", name: "Hotjar", category: "analytics", pattern: "hotjar.com/c/" }];
    const { added } = mergeScan(existing, candidates, { now, newId });
    expect(added.some((t) => t.pattern === "static.hotjar.com")).toBe(false);
  });

  it("remembers ignored trackers across rescans", () => {
    const first = mergeScan([], candidates, { now, newId });
    const ignored = first.trackers.map((t) => (t.pattern === "cdn.unknownvendor.io" ? { ...t, status: "ignored" as const } : t));
    const again = mergeScan(ignored, candidates, { now: "2026-10-08T00:00:00.000Z", newId });
    expect(again.added).toEqual([]);
    expect(again.trackers.find((t) => t.pattern === "cdn.unknownvendor.io")).toMatchObject({ status: "ignored", seenAt: "2026-10-08T00:00:00.000Z" });
    expect(again.trackers).toHaveLength(first.trackers.length);
  });

  it("keeps trackers a later scan didn't see", () => {
    const existing: Tracker[] = [{ id: "trk_x", name: "Login-only widget", category: "functional", pattern: "widget.example.com", status: "approved", source: "manual" }];
    expect(mergeScan(existing, [], { now, newId }).trackers).toEqual(existing);
  });

  it("publishes only approved, categorised, non-essential, address-based trackers", () => {
    const list: Tracker[] = [
      { id: "1", name: "Legacy", category: "analytics", pattern: "clarity.ms" },
      { id: "2", name: "Review", category: "marketing", pattern: "ads.example", status: "review" },
      { id: "3", name: "Ignored", category: "marketing", pattern: "ign.example", status: "ignored" },
      { id: "4", name: "Unknown", category: null, pattern: "u.example", status: "review" },
      { id: "5", name: "Stripe", category: "essential", pattern: "js.stripe.com", status: "approved" },
      { id: "6", name: "Session", category: "essential", pattern: "PHPSESSID", status: "approved", kind: "cookie" },
      { id: "7", name: "Ads cookie", category: "marketing", pattern: "_fbp", status: "approved", kind: "cookie" },
      { id: "8", name: "Meta", category: "marketing", pattern: "connect.facebook.net", status: "approved", kind: "pixel" },
    ];
    expect(sdkTrackers(list)).toEqual([
      { p: "clarity.ms", c: "analytics" },
      { p: "connect.facebook.net", c: "marketing" },
    ]);
    expect(heldTrackers(list).map((t) => t.id)).toEqual(["1", "5", "6", "7", "8"]);
    const cfg = toPublicConfig({ siteKey: "k", trackers: list, config: { regions: {}, version: 1 } } as unknown as Property);
    expect(cfg.trackers).toEqual(sdkTrackers(list));
  });
});

/* ---------------- local store ---------------- */

const scan = (propertyId: string, i: number): ScanReport => ({
  id: `scan_${propertyId}_${i}`,
  propertyId,
  startedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
  finishedAt: new Date(Date.UTC(2026, 9, 1, 0, i, 9)).toISOString(),
  status: i % 5 === 0 ? "failed" : "ok",
  ...(i % 5 === 0 ? { error: "Took too long to respond." } : {}),
  pages: [{ url: "https://acme.in/", status: 200 }],
  findings: [],
});

describe("local store: tracker scans", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-scans-"));
  let store: Store;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps the newest 20 per site, newest first", async () => {
    for (let i = 1; i <= 23; i++) await store.saveScan(scan("p1", i));
    await store.saveScan(scan("p2", 1));
    const list = await store.listScans("p1", 50);
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe("scan_p1_23");
    expect(list[19].id).toBe("scan_p1_4");
    expect(list.find((s) => s.id === "scan_p1_20")).toMatchObject({ status: "failed", error: "Took too long to respond." });
    expect((await store.listScans("p1", 2)).map((s) => s.id)).toEqual(["scan_p1_23", "scan_p1_22"]);
    expect(await store.listScans("p2", 5)).toHaveLength(1);
    expect(await store.listScans("p1", 0)).toEqual([]);
  });

  it("removes a site's scans with the site", async () => {
    await store.deleteProperty("p1");
    expect(await store.listScans("p1", 10)).toEqual([]);
    expect(await store.listScans("p2", 10)).toHaveLength(1);
  });
});
