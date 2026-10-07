import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SiteAuditReport } from "@/lib/site-audit/types";
import type { Store } from "@/lib/store/types";

const report = (propertyId: string, n: number): SiteAuditReport => ({
  id: `sad_${propertyId}_${n}`,
  propertyId,
  domain: "acme.in",
  homeUrl: "https://acme.in/",
  startedAt: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(),
  finishedAt: new Date(Date.UTC(2026, 9, 1, 0, n, 5)).toISOString(),
  durationMs: 5000,
  pages: [],
  notices: [],
  checks: [],
  summary: { pass: 0, warn: 0, fail: 0, unknown: 0 },
});

describe("local store: live site check reports", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-site-audit-"));
  let store: Store;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps the newest 10 per site, newest first", async () => {
    for (let n = 1; n <= 12; n++) await store.saveSiteAudit("p1", report("p1", n));
    await store.saveSiteAudit("p2", report("p2", 1));
    const list = await store.listSiteAudits("p1", 50);
    expect(list).toHaveLength(10);
    expect(list[0].id).toBe("sad_p1_12");
    expect(list[9].id).toBe("sad_p1_3");
    expect((await store.listSiteAudits("p1", 1)).map((r) => r.id)).toEqual(["sad_p1_12"]);
    expect(await store.listSiteAudits("p2", 5)).toHaveLength(1);
    expect(await store.listSiteAudits("p1", 0)).toEqual([]);
  });

  it("removes a site's reports with the site", async () => {
    await store.deleteProperty("p1");
    expect(await store.listSiteAudits("p1", 10)).toEqual([]);
    expect(await store.listSiteAudits("p2", 10)).toHaveLength(1);
  });
});
