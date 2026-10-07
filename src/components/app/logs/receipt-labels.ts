import type { BadgeTone } from "@/components/app/ui/badge";
import { formatDateTimeFull, formatRelative } from "@/lib/format";
import type { CategoryId, ConsentAction } from "@/lib/types";

/** Shared by the consent log table and the receipt proof page. */
export const ACTION: Record<ConsentAction, { label: string; tone: BadgeTone }> = {
  accept_all: { label: "Accepted all", tone: "released" },
  reject_all: { label: "Rejected all", tone: "declined" },
  custom: { label: "Chose some", tone: "neutral" },
  revoke: { label: "Withdrew", tone: "declined" },
  dismiss: { label: "Dismissed", tone: "neutral" },
};

export const CAT_SHORT: Record<CategoryId, string> = { essential: "Essential", functional: "Preferences", analytics: "Analytics", marketing: "Marketing" };

/** "12 Mar, 14:05:09 UTC" */
export const utcShort = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }) + " UTC";

/** "12 March 2026, 14:05:09 UTC" */
export const utcLong = (iso: string) => formatDateTimeFull(iso);

/** "3 days ago", "just now". Phase 2: callers move to <DateText mode="relative"> from the kit. */
export const relativeTime = (iso: string, now = Date.now()) => formatRelative(iso, now);
