import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Finding } from "../src/app";
import { FindingCollector, type ClassifiedCrawl } from "../src/classify";
import { scanSite } from "../src/scanner/crawl";
import type { ScanResult } from "../src/scanner/types";
import { startFixture, type Fixture } from "./fixture-server";

/** Real headless Chromium scan against local fixture origins, classified with the dashboard's tracker database. */
describe("end-to-end scan (headless Chromium)", () => {
  let fixture: Fixture;
  let result: ScanResult;
  let classified: ClassifiedCrawl;
  const logs: string[] = [];
  const htmlPages: string[] = [];

  beforeAll(async () => {
    fixture = await startFixture();
    const collector = new FindingCollector(new URL(fixture.siteUrl).hostname);
    result = await scanSite({
      startUrl: fixture.siteUrl,
      maxDepth: 1,
      maxPages: 5,
      settleMs: 300,
      pageDelayMs: 0,
      pageTimeoutMs: 15_000,
      onLog: (level, message) => logs.push(`${level} ${message}`),
      onPage: (p) => {
        htmlPages.push(p.url);
        collector.addHtmlPage(p);
      },
    });
    collector.setSiteHost(result.siteHost);
    collector.addRequestHosts(result.requestHosts);
    collector.addCookies(result.cookies);
    collector.addStorage(result.storage);
    classified = collector.result();
  }, 90_000);

  afterAll(async () => {
    await fixture?.close();
  });

  const finding = (name: string): Finding | undefined => classified.findings.find((f) => (f.sample ?? f.name) === name);

  it("crawls internal links, honours robots.txt and skips non-http links", () => {
    const visited = result.pages.map((p) => new URL(p.url).pathname);
    expect(visited).toEqual(["/", "/second"]);
    expect(result.skippedByRobots.map((u) => new URL(u).pathname)).toEqual(["/blocked"]);
    expect(result.cookies.find((c) => c.name === "should_not_appear")).toBeUndefined();
    expect(result.pages.every((p) => p.ok)).toBe(true);
    expect(htmlPages).toHaveLength(2);
  });

  it("captures HttpOnly cookies invisible to JavaScript via CDP", () => {
    const session = result.cookies.find((c) => c.name === "sessionid");
    expect(session).toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sources).toEqual(expect.arrayContaining(["cdp-jar", "set-cookie-header"]));
    expect(session!.sources).not.toContain("document.cookie");
    expect(finding("sessionid")).toMatchObject({ kind: "cookie", category: "essential", httpOnly: true, storage: "cookie", party: "first" });
  });

  it("classifies JS cookies, storage keys and third-party cookies against the tracker database", () => {
    // Chrome clamps cookie lifetimes to 400 days, so a requested 2-year _ga is stored for ~13 months.
    expect(finding("_ga")).toMatchObject({ category: "analytics", dbId: "google-analytics", expiry: "13 months", storage: "cookie" });
    expect(finding("cart_id")).toMatchObject({ category: null, pattern: "cart_id" });
    expect(finding("cart_id")?.pages[0]).toContain("/second");
    expect(finding("_hjSession_1")).toMatchObject({ dbId: "hotjar", storage: "localStorage" });
    expect(finding("ajs_anonymous_id")).toMatchObject({ dbId: "segment", storage: "sessionStorage" });
    expect(finding("_fbp")).toMatchObject({ category: "marketing", dbId: "meta-pixel", party: "third" });
  });

  it("records what loaded before consent, never essential items", () => {
    const names = classified.preConsent;
    const ga = finding("_ga")!.name;
    const fb = finding("_fbp")!.name;
    expect(names).toEqual(expect.arrayContaining([ga, fb]));
    expect(names).not.toContain(finding("sessionid")!.name);
    expect(logs.some((l) => l.startsWith("INFO Visiting"))).toBe(true);
  });

  it("produces findings the dashboard's triage accepts", async () => {
    const { candidatesFrom, mergeScan } = await import("../src/app");
    const merged = mergeScan([], candidatesFrom(classified.findings), { now: new Date().toISOString(), newId: () => Math.random().toString(36).slice(2) });
    expect(merged.added.length).toBeGreaterThan(0);
    expect(merged.trackers.every((t) => t.status === "review" && t.source === "scan")).toBe(true);
  });
});
