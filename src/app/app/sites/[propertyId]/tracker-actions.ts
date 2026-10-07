"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import { id } from "@/lib/crypto";
import { rateLimiter, retryAfterText, RATE_LIMITS } from "@/lib/rate-limit";
import { runTrackerScan } from "@/lib/scan";
import { auditSite } from "@/lib/site-config";
import { writeTrackers } from "@/lib/tracker-writes";
import { candidatesFrom, mergeScan, statusOf, type ScanReport } from "@/lib/trackers";
import type { CategoryId, Tracker } from "@/lib/types";

export type ScanActionResult = { ok: true; report: ScanReport; added: number } | { ok: false; error: string; report?: ScanReport };

/**
 * Scan the site's own saved domain (never an address from the client), keep the report, and put
 * new trackers in "To review". Approved and ignored ones are left as they are.
 */
export async function scanTrackers(propertyId: string): Promise<ScanActionResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:write");
    const limit = await rateLimiter("trackerScan").consume(ctx.property.id);
    if (!limit.ok) {
      return { ok: false, error: `This site has been scanned ${RATE_LIMITS.trackerScan.limit} times in the last hour. Try again in ${retryAfterText(limit.retryAfterMs)}.` };
    }
    const report = await runTrackerScan({ propertyId: ctx.property.id, domain: ctx.property.domain, runBy: ctx.user.id });
    await ctx.store.saveScan(report);
    let added = 0;
    if (report.status === "ok") {
      await writeTrackers(
        propertyId,
        (list) => {
          const merged = mergeScan(list, candidatesFrom(report.findings), { now: report.finishedAt, newId: () => id("trk", 6) });
          added = merged.added.length;
          return merged.trackers;
        },
        null,
      );
    }
    await auditSite(ctx, "tracker.scan_run", {
      ok: report.status === "ok",
      pages: report.pages.filter((p) => p.status !== null && p.status < 400).length,
      findings: report.findings.length,
      added,
    });
    // the scan history shows failed runs too
    revalidatePath(`/app/sites/${propertyId}/trackers`);
    return report.status === "ok" ? { ok: true, report, added } : { ok: false, error: report.error ?? "The scan failed.", report };
  } catch (e) {
    return { ok: false, error: failure(e)?.error ?? "The scan failed. Try again." };
  }
}

const IDS = z.array(z.string().min(1).max(40)).min(1).max(500);
const CATEGORY = z.enum(["essential", "functional", "analytics", "marketing"]);

const LABEL: Record<CategoryId, string> = { essential: "Essential", functional: "Preferences", analytics: "Analytics", marketing: "Marketing" };

/**
 * Approve trackers: they join the published inventory and, unless essential, the SDK holds them
 * until visitors consent to their category. `category` overrides each one's suggestion.
 */
export async function approveTrackers(propertyId: string, trackerIds: string[], category?: CategoryId): Promise<ActionResult> {
  try {
    const ids = new Set(IDS.parse(trackerIds));
    const cat = category === undefined ? undefined : CATEGORY.parse(category);
    let approved = 0;
    let unclassified = 0;
    await writeTrackers(
      propertyId,
      (list) =>
        list.map((t) => {
          if (!ids.has(t.id)) return t;
          const c = cat ?? t.category;
          if (!c) {
            unclassified++;
            return t;
          }
          approved++;
          return { ...t, category: c, status: "approved" } satisfies Tracker;
        }),
      { action: "tracker.approved", metadata: () => ({ count: approved, category: cat ?? null, skippedUnclassified: unclassified }) },
    );
    if (!approved) return { error: unclassified ? "Choose a category before approving." : "Those trackers are no longer listed." };
    const what = approved === 1 ? "1 tracker" : `${approved} trackers`;
    const note = cat === "essential" ? " Essential trackers are listed, never held." : cat ? ` Held until visitors consent to ${LABEL[cat].toLowerCase()}.` : "";
    return { ok: `Approved ${what}.${note} Publish to apply.` };
  } catch (e) {
    return failure(e);
  }
}

/** Ignore trackers: not held, not suggested again by later scans. An approved one stops being held. */
export async function ignoreTrackers(propertyId: string, trackerIds: string[]): Promise<ActionResult> {
  try {
    const ids = new Set(IDS.parse(trackerIds));
    let n = 0;
    let wasApproved = 0;
    await writeTrackers(
      propertyId,
      (list) =>
        list.map((t) => {
          if (!ids.has(t.id)) return t;
          n++;
          if (statusOf(t) === "approved") wasApproved++;
          return { ...t, status: "ignored" } satisfies Tracker;
        }),
      { action: "tracker.ignored", metadata: () => ({ count: n, wasApproved }) },
    );
    if (!n) return { error: "Those trackers are no longer listed." };
    return { ok: wasApproved ? "Ignored. It's no longer held; publish to apply." : n === 1 ? "Ignored. Future scans won't suggest it again." : `Ignored ${n} trackers.` };
  } catch (e) {
    return failure(e);
  }
}

/** Move an ignored tracker back to "To review". */
export async function restoreTracker(propertyId: string, trackerId: string): Promise<ActionResult> {
  try {
    const [tid] = IDS.parse([trackerId]);
    let found = false;
    await writeTrackers(
      propertyId,
      (list) =>
        list.map((t) => {
          if (t.id !== tid) return t;
          found = true;
          return { ...t, status: "review" } satisfies Tracker;
        }),
      { action: "tracker.restored", metadata: () => ({ trackerId: tid }) },
    );
    return found ? { ok: "Moved back to review." } : { error: "That tracker is no longer listed." };
  } catch (e) {
    return failure(e);
  }
}
