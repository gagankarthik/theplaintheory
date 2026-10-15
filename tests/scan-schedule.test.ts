import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { advanceSchedule, isScanDue, nextScanDue, scheduledRunAt, scheduleFor, selectDue } from "@/lib/scan-schedule";
import type { Store } from "@/lib/store/types";
import type { Property, ScanSchedule } from "@/lib/types";

const at = (iso: string) => new Date(iso);

describe("nextScanDue", () => {
  it("weekly: the start of the day 7 days later", () => {
    expect(nextScanDue("weekly", at("2026-10-16T21:00:12Z"))).toBe("2026-10-23T00:00:00.000Z");
    expect(nextScanDue("weekly", at("2026-12-29T03:00:00Z"))).toBe("2027-01-05T00:00:00.000Z");
  });

  it("monthly: same date next month, clamped to the month's last day", () => {
    expect(nextScanDue("monthly", at("2026-10-16T21:00:00Z"))).toBe("2026-11-16T00:00:00.000Z");
    expect(nextScanDue("monthly", at("2026-01-31T10:00:00Z"))).toBe("2026-02-28T00:00:00.000Z");
    expect(nextScanDue("monthly", at("2028-01-31T10:00:00Z"))).toBe("2028-02-29T00:00:00.000Z");
    expect(nextScanDue("monthly", at("2026-12-15T10:00:00Z"))).toBe("2027-01-15T00:00:00.000Z");
    expect(nextScanDue("monthly", at("2026-03-31T10:00:00Z"))).toBe("2026-04-30T00:00:00.000Z");
  });

  it("doesn't drift when the cron fires a little later each time", () => {
    let s: ScanSchedule = { frequency: "weekly", nextDueAt: "2026-10-16T00:00:00.000Z" };
    for (let i = 0; i < 10; i++) {
      const due = new Date(s.nextDueAt);
      const fired = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 21, 0, 59 + i));
      expect(isScanDue({ scanSchedule: s }, fired)).toBe(true);
      s = advanceSchedule(s, fired);
    }
    expect(s.nextDueAt).toBe("2026-12-25T00:00:00.000Z");
  });
});

describe("scheduleFor / advanceSchedule", () => {
  const now = at("2026-10-16T09:30:00Z");

  it("off clears the schedule", () => {
    expect(scheduleFor("off", { frequency: "weekly", nextDueAt: "2026-10-20T00:00:00.000Z" }, now)).toBeNull();
  });

  it("a new frequency starts counting from now", () => {
    expect(scheduleFor("monthly", undefined, now)).toEqual({ frequency: "monthly", nextDueAt: "2026-11-16T00:00:00.000Z", updatedAt: now.toISOString() });
    expect(scheduleFor("weekly", { frequency: "monthly", nextDueAt: "2026-11-16T00:00:00.000Z" }, now)?.nextDueAt).toBe("2026-10-23T00:00:00.000Z");
  });

  it("the same frequency keeps its due date", () => {
    const s: ScanSchedule = { frequency: "weekly", nextDueAt: "2026-10-18T00:00:00.000Z" };
    expect(scheduleFor("weekly", s, now)).toBe(s);
  });

  it("advancing counts from the run, not the missed due date, and records the run", () => {
    const s: ScanSchedule = { frequency: "weekly", nextDueAt: "2026-09-01T00:00:00.000Z" };
    expect(advanceSchedule(s, now)).toEqual({ frequency: "weekly", nextDueAt: "2026-10-23T00:00:00.000Z", lastRunAt: now.toISOString() });
  });
});

describe("selectDue", () => {
  const p = (id: string, nextDueAt?: string, frequency: ScanSchedule["frequency"] = "weekly") => ({
    id,
    ...(nextDueAt ? { scanSchedule: { frequency, nextDueAt } } : {}),
  });
  const now = at("2026-10-16T21:00:00Z");

  it("picks only sites with a schedule whose due time has passed, oldest first", () => {
    const list = [p("a", "2026-10-17T00:00:00.000Z"), p("b", "2026-10-16T00:00:00.000Z"), p("c"), p("d", "2026-10-01T00:00:00.000Z", "monthly"), p("e", "2026-10-16T21:00:00.000Z")];
    expect(selectDue(list, now).map((x) => x.id)).toEqual(["d", "b", "e"]);
  });

  it("respects the batch limit and ignores bad dates", () => {
    const list = [p("a", "2026-10-01T00:00:00.000Z"), p("b", "2026-10-02T00:00:00.000Z"), p("x", "not a date")];
    expect(selectDue(list, now, 1).map((x) => x.id)).toEqual(["a"]);
    expect(selectDue(list, now, 0)).toEqual([]);
  });
});

describe("scheduledRunAt", () => {
  it("is the first 21:00 UTC run at or after the due time", () => {
    expect(scheduledRunAt("2026-10-23T00:00:00.000Z")).toBe("2026-10-23T21:00:00.000Z");
    expect(scheduledRunAt("2026-10-23T21:00:00.000Z")).toBe("2026-10-23T21:00:00.000Z");
    expect(scheduledRunAt("2026-10-23T21:30:00.000Z")).toBe("2026-10-24T21:00:00.000Z");
  });
});

describe("local store: listDueScanProperties", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-sched-"));
  let store: Store;
  const site = (id: string, scanSchedule?: ScanSchedule): Property =>
    ({ id, orgId: "org_1", name: id, domain: `${id}.example`, siteKey: `pk_${id}`, trackers: [], publishedVersion: 0, createdAt: "", updatedAt: "", ...(scanSchedule ? { scanSchedule } : {}) }) as unknown as Property;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    store = (await import("@/lib/store/local")).localStore;
    await store.createProperty(site("s1", { frequency: "weekly", nextDueAt: "2026-10-10T00:00:00.000Z" }));
    await store.createProperty(site("s2", { frequency: "monthly", nextDueAt: "2026-11-01T00:00:00.000Z" }));
    await store.createProperty(site("s3"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns due sites and drops ones whose schedule was turned off or moved on", async () => {
    const now = "2026-10-16T21:00:00.000Z";
    expect((await store.listDueScanProperties(now, 10)).map((x) => x.id)).toEqual(["s1"]);
    await store.updateProperty("s1", { scanSchedule: advanceSchedule((await store.getProperty("s1"))!.scanSchedule!, new Date(now)) });
    expect(await store.listDueScanProperties(now, 10)).toEqual([]);
    await store.updateProperty("s2", { scanSchedule: { frequency: "monthly", nextDueAt: "2026-10-01T00:00:00.000Z" } });
    expect((await store.listDueScanProperties(now, 10)).map((x) => x.id)).toEqual(["s2"]);
    await store.updateProperty("s2", { scanSchedule: undefined });
    expect(await store.listDueScanProperties(now, 10)).toEqual([]);
  });
});
