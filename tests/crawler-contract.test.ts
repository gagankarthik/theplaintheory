import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Store } from "@/lib/store/types";
import { isScanActive, trackerPatch, type ScanReport } from "@/lib/trackers";
import type { Property, Tracker } from "@/lib/types";

/**
 * The scan contract shared by the dashboard (lib/crawler, tracker-actions) and the headless crawler
 * worker (services/crawler): queued → running → ok/failed/cancelled, guarded status transitions,
 * stale-scan recovery and the tracker-list patch both sides apply.
 */

const queued = (propertyId: string, id: string, at = new Date()): ScanReport => ({
  id,
  propertyId,
  startedAt: at.toISOString(),
  finishedAt: "",
  status: "queued",
  engine: "headless",
  pages: [],
  findings: [],
  log: [{ at: at.toISOString(), level: "info", message: "Queued." }],
});

describe("crawler contract (local file store)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-crawler-"));
  let store: Store;
  let crawler: typeof import("@/lib/crawler");

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    delete process.env.STORE_DRIVER;
    delete process.env.CRAWLER_QUEUE_URL;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
    crawler = await import("@/lib/crawler");
  });
  afterEach(() => {
    delete process.env.CRAWLER_MODE;
    delete process.env.CRAWLER_QUEUE_URL;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("picks the engine from the environment", () => {
    expect(crawler.crawlerMode()).toBe("fetch");
    process.env.CRAWLER_MODE = "local";
    expect(crawler.crawlerMode()).toBe("headless-local");
    process.env.CRAWLER_QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/1/pt-staging-aps1-crawl-queue";
    expect(crawler.crawlerMode()).toBe("headless-sqs");
  });

  it("queues a headless crawl with clamped limits and a first log line", async () => {
    process.env.CRAWLER_MODE = "local";
    const report = await crawler.requestCrawl({ propertyId: "p1", domain: "acme.in", runBy: "usr_1", maxPages: 500, maxDepth: 0 });
    expect(report).toMatchObject({ status: "queued", engine: "headless", finishedAt: "", limits: { maxPages: 100, maxDepth: 1 }, runBy: "usr_1" });
    expect(report.log?.[0]?.message).toContain("Queued");
    expect(await crawler.getScan("p1", report.id)).toEqual(report);
    expect((await crawler.activeScan("p1"))?.id).toBe(report.id);
    expect((await store.listQueuedScans(10)).map((s) => s.id)).toContain(report.id);
  });

  it("claims exactly once and stops progress writes after a cancel", async () => {
    await store.saveScan(queued("p2", "scan_claim"));
    const first = await store.updateScan("p2", "scan_claim", { status: "running", workerId: "w1" }, { ifStatus: ["queued"] });
    const second = await store.updateScan("p2", "scan_claim", { status: "running", workerId: "w2" }, { ifStatus: ["queued"] });
    expect(first?.workerId).toBe("w1");
    expect(second).toBeNull();

    const progress = await store.updateScan("p2", "scan_claim", { progress: { pagesScanned: 1, pagesQueued: 3, findings: 4 } }, { ifStatus: ["running"] });
    expect(progress?.progress?.findings).toBe(4);
    expect(progress?.startedAt).toBe(first?.startedAt);

    const cancelled = await crawler.cancelCrawl("p2", "scan_claim");
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.log?.at(-1)?.message).toBe("Cancelled.");
    expect(await store.updateScan("p2", "scan_claim", { progress: { pagesScanned: 2, pagesQueued: 0, findings: 5 } }, { ifStatus: ["running"] })).toBeNull();
    expect(await crawler.cancelCrawl("p2", "scan_claim")).toBeNull();
    expect(await crawler.activeScan("p2")).toBeNull();
  });

  it("never lets another site read or change a scan", async () => {
    await store.saveScan(queued("p3", "scan_owned"));
    expect(await store.getScan("p4", "scan_owned")).toBeNull();
    expect(await store.updateScan("p4", "scan_owned", { status: "cancelled" })).toBeNull();
    expect((await store.getScan("p3", "scan_owned"))?.status).toBe("queued");
  });

  it("fails a stale crawl instead of blocking the next one", async () => {
    const old = new Date(Date.now() - crawler.STALE_SCAN_MS - 60_000);
    await store.saveScan({ ...queued("p5", "scan_stale", old), status: "running" });
    expect(await crawler.activeScan("p5")).toBeNull();
    const after = await store.getScan("p5", "scan_stale");
    expect(after?.status).toBe("failed");
    expect(isScanActive(after!)).toBe(false);
    expect(after?.error).toMatch(/stopped responding/);
  });

  it("runs the fetch engine in-process and stores the finished report", async () => {
    const report = await crawler.requestCrawl({ propertyId: "p6", domain: "nonexistent.invalid" });
    expect(report.engine).toBe("fetch");
    expect(report.status).toBe("failed");
    expect(report.finishedAt).not.toBe("");
    expect((await store.getScan("p6", report.id))?.id).toBe(report.id);
  }, 30_000);
});

describe("trackerPatch", () => {
  const property = {
    trackers: [{ id: "t1", name: "GA", pattern: "googletagmanager.com", category: "analytics", status: "approved" }] as Tracker[],
    config: { version: 7 } as Property["config"],
  };

  it("bumps the draft version only when the approved inventory changes", () => {
    const review: Tracker = { id: "t2", name: "Pixel", pattern: "connect.facebook.net", category: "marketing", status: "review" };
    expect(trackerPatch(property, [...property.trackers, review]).config).toBeUndefined();
    const approved = trackerPatch(property, [...property.trackers, { ...review, status: "approved" }]);
    expect(approved.config?.version).toBe(8);
  });
});
