import type { ScanLogLine, ScanReport } from "./trackers";

/** The last log line a poller already has: matched by time and message, since old lines are trimmed. */
export type LogCursor = { at: string; message: string };

/**
 * Cut a report's log down to the lines after `after`. When the cursor line is gone (trimmed, or no
 * cursor) the whole log is returned and the caller replaces what it has.
 */
export function withLogAfter(report: ScanReport, after?: LogCursor | null): ScanReport & { logMode: "append" | "replace" } {
  const log = report.log ?? [];
  if (!after) return { ...report, log, logMode: "replace" };
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].at === after.at && log[i].message === after.message) return { ...report, log: log.slice(i + 1), logMode: "append" };
  }
  return { ...report, log, logMode: "replace" };
}

/** Apply a polled report to the one on screen, keeping at most `keep` log lines. */
export function mergePolledLog(previous: ScanLogLine[] | undefined, next: ScanReport & { logMode?: "append" | "replace" }, keep: number): ScanLogLine[] {
  const lines = next.logMode === "append" ? [...(previous ?? []), ...(next.log ?? [])] : (next.log ?? []);
  return lines.slice(-keep);
}
