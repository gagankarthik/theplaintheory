import type { Finding } from "@/lib/trackers";
import type { Tracker } from "@/lib/types";

/** Cookie and storage flags a headless scan read from the browser, keyed by tracker pattern. */
export interface TrackerFlags {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  storage?: "cookie" | "localStorage" | "sessionStorage";
  expiry?: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const RISK_LABEL: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/** Flags per pattern from a scan's findings (the last finding for a pattern wins). */
export function flagsFrom(findings: Finding[]): Record<string, TrackerFlags> {
  const out: Record<string, TrackerFlags> = {};
  for (const f of findings) {
    if (f.httpOnly === undefined && f.secure === undefined && f.sameSite === undefined && f.storage === undefined && !f.expiry) continue;
    out[f.pattern] = { httpOnly: f.httpOnly, secure: f.secure, sameSite: f.sameSite, storage: f.storage, expiry: f.expiry };
  }
  return out;
}

/** Rough lifetime in days from strings such as "2 years", "13 months", "30 days" or "Session". */
function lifetimeDays(expiry: string | undefined): number {
  if (!expiry) return 0;
  const m = expiry.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(year|month|week|day|hour|minute)/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === "year" ? n * 365 : unit === "month" ? n * 30 : unit === "week" ? n * 7 : unit === "day" ? n : 0;
}

/**
 * Privacy risk of one tracker, for triage (not a legal judgement):
 *  - unclassified third-party trackers and long-lived third-party marketing are the most urgent;
 *  - marketing is high, analytics medium (more if third party or long-lived);
 *  - essential and preference trackers are low unless cross-site without Secure.
 */
export function riskOf(t: Tracker, flags?: TrackerFlags): RiskLevel {
  const third = t.party === "third";
  const longLived = lifetimeDays(flags?.expiry ?? t.expiry) > 395;
  const insecureCrossSite = (flags?.sameSite ?? "").toLowerCase() === "none" && flags?.secure === false;
  switch (t.category) {
    case null:
      return third ? (longLived ? "critical" : "high") : "medium";
    case "marketing":
      return third && longLived ? "critical" : third ? "high" : "medium";
    case "analytics":
      return third && longLived ? "high" : third || longLived ? "medium" : "low";
    default:
      return insecureCrossSite || (third && longLived) ? "medium" : "low";
  }
}
