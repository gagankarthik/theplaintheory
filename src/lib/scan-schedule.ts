import type { Property, ScanFrequency, ScanSchedule } from "./types";

/**
 * Scheduled tracker scans (pure: no I/O, so it is unit tested directly).
 *
 * A site with a schedule carries `scanSchedule: { frequency, nextDueAt }`; "off" is the absence of
 * one. The daily cron (/api/internal/scheduled-scans) asks the store for sites whose nextDueAt has
 * passed, starts a scan for each through the same path as "Scan now", then moves nextDueAt on.
 */

export const SCAN_FREQUENCIES = ["off", "weekly", "monthly"] as const;
export type ScanFrequencyChoice = (typeof SCAN_FREQUENCIES)[number];

export const SCAN_FREQUENCY_LABEL: Record<ScanFrequencyChoice, string> = { off: "Off", weekly: "Weekly", monthly: "Monthly" };

/** Most sites one cron run starts. The rest stay due and go first next run (oldest due first). */
export const SCHEDULED_SCAN_BATCH = 50;

/** UTC hour the daily cron runs (vercel.json: "0 21 * * *"). Keep the two in step. */
export const SCHEDULED_SCAN_HOUR_UTC = 21;

/** When the cron will actually pick a site up: the first daily run at or after `nextDueAt`. */
export function scheduledRunAt(nextDueAt: string): string {
  const due = new Date(nextDueAt);
  const run = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), SCHEDULED_SCAN_HOUR_UTC));
  if (run.getTime() < due.getTime()) run.setUTCDate(run.getUTCDate() + 1);
  return run.toISOString();
}

/**
 * When the next scan is due after `from`: the start (00:00 UTC) of the day 7 days later for weekly,
 * or of the same date next month for monthly, clamped to the month's last day (31 Jan → 28/29 Feb).
 * Due from midnight, the daily cron picks it up that same day whatever time it fires, so the
 * schedule never drifts a day later from one run to the next.
 */
export function nextScanDue(frequency: ScanFrequency, from: Date): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  if (frequency === "weekly") return new Date(Date.UTC(y, m, d + 7)).toISOString();
  const lastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 1, Math.min(d, lastDay))).toISOString();
}

/** The schedule to store when the owner picks `frequency` (null clears it). Keeps the due date when unchanged. */
export function scheduleFor(frequency: ScanFrequencyChoice, current: ScanSchedule | undefined, now: Date): ScanSchedule | null {
  if (frequency === "off") return null;
  if (current?.frequency === frequency) return current;
  return { frequency, nextDueAt: nextScanDue(frequency, now), updatedAt: now.toISOString() };
}

/**
 * After a cron run picks the site: the next due time counts from now, not from the missed due
 * time, so a site that was skipped for days gets one scan, not a backlog.
 */
export function advanceSchedule(s: ScanSchedule, now: Date): ScanSchedule {
  return { ...s, nextDueAt: nextScanDue(s.frequency, now), lastRunAt: now.toISOString() };
}

export const isScanDue = (p: Pick<Property, "scanSchedule">, now: Date) => {
  const at = p.scanSchedule ? Date.parse(p.scanSchedule.nextDueAt) : NaN;
  return Number.isFinite(at) && at <= now.getTime();
};

/** Sites due at `now`, the longest-overdue first, at most `limit`. */
export function selectDue<P extends Pick<Property, "id" | "scanSchedule">>(properties: P[], now: Date, limit = SCHEDULED_SCAN_BATCH): P[] {
  return properties
    .filter((p) => isScanDue(p, now))
    .sort((a, b) => a.scanSchedule!.nextDueAt.localeCompare(b.scanSchedule!.nextDueAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}
