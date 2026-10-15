import type { ConsentReceipt } from "./types";

/**
 * Daily decision rollups: per site and UTC day, counts kept as atomic counters when a receipt is
 * stored, so the overview reads one small item per day instead of every receipt.
 *
 * Counters are flat numeric fields so both stores can add to them blindly (DynamoDB `ADD`):
 *   n:accepted  n:partial  n:rejected  n:revoked  n:gpc         decisions by outcome, withdrawals, GPC
 *   g:functional  g:analytics  g:marketing                       decisions that granted the category
 *   d:<dimension>:<value>:<outcome>                              decisions per country/device/browser/framework
 */

export type RollupOutcome = "accepted" | "partial" | "rejected";
export const ROLLUP_DIMENSIONS = ["country", "device", "browser", "framework"] as const;
export type RollupDimension = (typeof ROLLUP_DIMENSIONS)[number];
export const OPTIONAL_CATEGORIES = ["functional", "analytics", "marketing"] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];

export interface DecisionRollup {
  /** YYYY-MM-DD (UTC) */
  day: string;
  accepted: number;
  partial: number;
  rejected: number;
  revoked: number;
  /** decisions made with a Global Privacy Control signal */
  gpc: number;
  /** decisions that granted each optional category */
  granted: Record<OptionalCategory, number>;
  /** decisions per dimension value and outcome */
  dims: Record<RollupDimension, Record<string, Record<RollupOutcome, number>>>;
}

/** Rollups for a day range, plus where they start in the receipt chain. */
export interface RollupRange {
  rollups: DecisionRollup[];
  /**
   * The first receipt seq counted in rollups. Receipts with a lower seq were stored before rollups
   * existed and must be counted from the receipts themselves. null: no receipt has been rolled up
   * yet, so every receipt in the range is counted from receipts.
   */
  fromSeq: number | null;
}

function outcome(action: ConsentReceipt["action"]): RollupOutcome | null {
  if (action === "accept_all") return "accepted";
  if (action === "reject_all") return "rejected";
  if (action === "custom") return "partial";
  return null;
}

/** Dimension values become part of a field name: no separators, bounded length. */
const clean = (v: string | undefined) => (v || "Unknown").replace(/[:#]/g, "_").slice(0, 40);

/** The counters one receipt adds to its day. Empty for actions that are neither a decision nor a withdrawal. */
export function rollupIncrement(r: Pick<ConsentReceipt, "action" | "categories" | "gpc" | "timestamp" | RollupDimension>) {
  const day = r.timestamp.slice(0, 10);
  const fields: Record<string, number> = {};
  if (r.action === "revoke") fields["n:revoked"] = 1;
  const o = outcome(r.action);
  if (o) {
    fields[`n:${o}`] = 1;
    if (r.gpc) fields["n:gpc"] = 1;
    for (const c of OPTIONAL_CATEGORIES) if (r.categories?.[c]) fields[`g:${c}`] = 1;
    for (const d of ROLLUP_DIMENSIONS) fields[`d:${d}:${clean(r[d])}:${o}`] = 1;
  }
  return { day, fields };
}

export const emptyRollup = (day: string): DecisionRollup => ({
  day,
  accepted: 0,
  partial: 0,
  rejected: 0,
  revoked: 0,
  gpc: 0,
  granted: { functional: 0, analytics: 0, marketing: 0 },
  dims: { country: {}, device: {}, browser: {}, framework: {} },
});

/** Add flat counters (as stored) into a rollup. Unknown fields are ignored. */
export function addFlat(into: DecisionRollup, fields: Record<string, unknown>) {
  for (const [k, raw] of Object.entries(fields)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || !n) continue;
    const parts = k.split(":");
    if (parts[0] === "n" && parts.length === 2) {
      const f = parts[1] as "accepted" | "partial" | "rejected" | "revoked" | "gpc";
      if (f in into && typeof into[f] === "number") into[f] += n;
    } else if (parts[0] === "g" && parts.length === 2 && (OPTIONAL_CATEGORIES as readonly string[]).includes(parts[1])) {
      into.granted[parts[1] as OptionalCategory] += n;
    } else if (parts[0] === "d" && parts.length === 4 && (ROLLUP_DIMENSIONS as readonly string[]).includes(parts[1])) {
      const o = parts[3] as RollupOutcome;
      if (o !== "accepted" && o !== "partial" && o !== "rejected") continue;
      const byValue = into.dims[parts[1] as RollupDimension];
      const row = (byValue[parts[2]] ??= { accepted: 0, partial: 0, rejected: 0 });
      row[o] += n;
    }
  }
  return into;
}

/** Rollups computed from receipts (legacy days, tests and the backfill script), one per day, sorted. */
export function rollupsFromReceipts(receipts: Pick<ConsentReceipt, "action" | "categories" | "gpc" | "timestamp" | RollupDimension>[]): DecisionRollup[] {
  const byDay = new Map<string, DecisionRollup>();
  for (const r of receipts) {
    const { day, fields } = rollupIncrement(r);
    if (!Object.keys(fields).length) continue;
    addFlat(byDay.get(day) ?? byDay.set(day, emptyRollup(day)).get(day)!, fields);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Sum rollups for the same day (e.g. rolled-up counts plus legacy receipts on the cut-over day). */
export function mergeRollups(...lists: DecisionRollup[][]): DecisionRollup[] {
  const byDay = new Map<string, DecisionRollup>();
  for (const r of lists.flat()) {
    const into = byDay.get(r.day) ?? byDay.set(r.day, emptyRollup(r.day)).get(r.day)!;
    into.accepted += r.accepted;
    into.partial += r.partial;
    into.rejected += r.rejected;
    into.revoked += r.revoked;
    into.gpc += r.gpc;
    for (const c of OPTIONAL_CATEGORIES) into.granted[c] += r.granted[c];
    for (const d of ROLLUP_DIMENSIONS) {
      for (const [value, counts] of Object.entries(r.dims[d])) {
        const row = (into.dims[d][value] ??= { accepted: 0, partial: 0, rejected: 0 });
        row.accepted += counts.accepted;
        row.partial += counts.partial;
        row.rejected += counts.rejected;
      }
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
