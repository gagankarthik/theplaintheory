import type { BadgeTone } from "@/components/app/ui/badge";
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
export const utcLong = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }) + " UTC";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "just now" */
export function relativeTime(iso: string, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(s) < 60) return "just now";
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) if (Math.abs(s) >= size) return fmt.format(Math.trunc(s / size), unit);
  return "just now";
}
