import { describe, expect, it } from "vitest";
import { scanEta, remainingLabel, clock } from "@/lib/scan-eta";
import { scanSignal } from "@/lib/setup-signals";
import { setupProgress, type SetupSignals } from "@/lib/setup";
import type { ScanReport } from "@/lib/trackers";

const T0 = Date.parse("2026-10-18T10:00:00Z");
const iso = (ms: number) => new Date(T0 + ms).toISOString();
const report = (p: Partial<ScanReport>): ScanReport => ({
  id: "scan_1", propertyId: "prop_1", startedAt: iso(0), finishedAt: "", status: "queued", engine: "headless",
  pages: [], findings: [], limits: { maxPages: 25, maxDepth: 2 }, progress: { pagesScanned: 0, pagesQueued: 1, findings: 0 },
  log: [{ at: iso(0), level: "info", message: "Queued: up to 25 pages, 2 links deep." }], ...p,
});

describe("scanEta", () => {
  it("queued: starting a browser, with an estimate, then 'slow' after 3 minutes", () => {
    const e = scanEta(report({}), T0 + 20_000);
    expect(e.phase).toBe("starting");
    expect(e.remainingMs).toBeGreaterThan(55_000);
    const slow = scanEta(report({}), T0 + 200_000);
    expect(slow.slow).toBe(true);
    expect(slow.remainingMs).toBeNull();
  });

  it("running: uses the measured page rate and the pages actually discovered", () => {
    const r = report({
      status: "running",
      progress: { pagesScanned: 4, pagesQueued: 4, findings: 9 },
      log: [{ at: iso(0), level: "info", message: "Queued" }, { at: iso(60_000), level: "info", message: "Crawler started." }],
    });
    const e = scanEta(r, T0 + 60_000 + 20_000); // 4 pages in 20 s → 5 s/page, 4 left
    expect(e.phase).toBe("crawling");
    expect(e.pagesPlanned).toBe(8);
    expect(e.remainingMs).toBe(20_000);
  });

  it("labels", () => {
    expect(remainingLabel(30_000)).toBe("under a minute left");
    expect(remainingLabel(150_000)).toBe("about 3 min left");
    expect(clock(67_000)).toBe("1:07");
  });
});

describe("setup checklist and scans", () => {
  const signals = (scan: SetupSignals["scan"]): SetupSignals => ({
    propertyId: "prop_1", domain: "acme.in", scanned: false, trackers: 0, toReview: 0, bannerEdited: false,
    published: false, blocked: 0, seen: false, decided: false, scan,
  });

  it("a running scan shows as in progress with View progress, not Run a scan", () => {
    const step = setupProgress(signals(scanSignal(report({}), T0 + 10_000))).steps[0];
    expect(step.status).toBe("running");
    expect(step.cta).toBe("View progress");
    expect(step.title).toBe("Scanning acme.in");
  });

  it("a silent scan counts as failed after 15 minutes, with a retry", () => {
    const step = setupProgress(signals(scanSignal(report({}), T0 + 16 * 60_000))).steps[0];
    expect(step.status).toBe("failed");
    expect(step.cta).toBe("Run the scan again");
  });

  it("no scan yet: the plain first step", () => {
    const step = setupProgress(signals(undefined)).steps[0];
    expect([step.status, step.cta]).toEqual([undefined, "Run a scan"]);
  });
});
