import type { CategoryId, ConsentAction, ConsentReceipt, Framework, LeakReport, PageviewCounter, Tracker } from "./types";

export type Outcome = "accepted" | "partial" | "rejected";

export const OUTCOMES: { id: Outcome; label: string; color: string }[] = [
  { id: "accepted", label: "Accepted all", color: "var(--color-jade)" },
  { id: "partial", label: "Chose some", color: "var(--color-amber)" },
  { id: "rejected", label: "Rejected all", color: "var(--color-rose)" },
];

export function outcomeOf(action: ConsentAction): Outcome | null {
  if (action === "accept_all") return "accepted";
  if (action === "reject_all") return "rejected";
  if (action === "custom") return "partial";
  return null;
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** ISO timestamp `days` days before now. */
export const daysAgoIso = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

export function rangeDays(days: number, now = new Date()) {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export type DayPoint = { day: string; views: number; bounces: number } & Record<Outcome, number>;

export interface BreakdownRow {
  key: string;
  total: number;
  accepted: number;
  partial: number;
  rejected: number;
}

export interface Summary {
  decisions: number;
  accepted: number;
  partial: number;
  rejected: number;
  revoked: number;
  views: number;
  bounces: number;
  optInRate: number;
  optOutRate: number;
  partialRate: number;
  bounceRate: number;
  series: DayPoint[];
  byCountry: BreakdownRow[];
  byDevice: BreakdownRow[];
  byBrowser: BreakdownRow[];
  byFramework: BreakdownRow[];
}

function breakdown(rows: ConsentReceipt[], key: (r: ConsentReceipt) => string, limit = 8): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const o = outcomeOf(r.action);
    if (!o) continue;
    const k = key(r) || "Unknown";
    const row = map.get(k) ?? { key: k, total: 0, accepted: 0, partial: 0, rejected: 0 };
    row.total += 1;
    row[o] += 1;
    map.set(k, row);
  }
  const sorted = [...map.values()].sort((a, b) => b.total - a.total);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const other = sorted.slice(limit - 1).reduce(
    (acc, r) => ({
      key: "Other",
      total: acc.total + r.total,
      accepted: acc.accepted + r.accepted,
      partial: acc.partial + r.partial,
      rejected: acc.rejected + r.rejected,
    }),
    { key: "Other", total: 0, accepted: 0, partial: 0, rejected: 0 },
  );
  return [...head, other];
}

const pct = (n: number, d: number) => (d ? n / d : 0);

export function summarize(receipts: ConsentReceipt[], counters: PageviewCounter[], days: string[]): Summary {
  const decisions = receipts.filter((r) => outcomeOf(r.action));
  const count = (o: Outcome) => decisions.filter((r) => outcomeOf(r.action) === o).length;
  const accepted = count("accepted");
  const partial = count("partial");
  const rejected = count("rejected");
  const views = counters.reduce((s, c) => s + c.views, 0);
  const bounces = counters.reduce((s, c) => s + c.bounces, 0);

  const byDay = new Map<string, DayPoint>(days.map((d) => [d, { day: d, accepted: 0, partial: 0, rejected: 0, views: 0, bounces: 0 }]));
  for (const c of counters) {
    const row = byDay.get(c.day);
    if (row) {
      row.views += c.views;
      row.bounces += c.bounces;
    }
  }
  for (const r of decisions) {
    const row = byDay.get(r.timestamp.slice(0, 10));
    if (row) row[outcomeOf(r.action)!] += 1;
  }

  return {
    decisions: decisions.length,
    accepted,
    partial,
    rejected,
    revoked: receipts.filter((r) => r.action === "revoke").length,
    views,
    bounces,
    optInRate: pct(accepted, decisions.length),
    optOutRate: pct(rejected, decisions.length),
    partialRate: pct(partial, decisions.length),
    bounceRate: pct(bounces, views),
    series: [...byDay.values()],
    byCountry: breakdown(decisions, (r) => r.country),
    byDevice: breakdown(decisions, (r) => r.device),
    byBrowser: breakdown(decisions, (r) => r.browser),
    byFramework: breakdown(decisions, (r) => r.framework),
  };
}

export const formatPct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
export const formatInt = (n: number) => n.toLocaleString("en-US");

export type MetricId = "optIn" | "optOut" | "partial" | "bounce";

export const METRICS: Record<
  MetricId,
  { label: string; goodWhen: "up" | "down" | "neutral"; color: string; of: (p: Pick<DayPoint, Outcome | "views" | "bounces">) => number | null; describe: string }
> = {
  optIn: {
    label: "Opt-in rate",
    goodWhen: "up",
    color: "var(--color-jade)",
    of: (p) => ratio(p.accepted, p.accepted + p.partial + p.rejected),
    describe: "Share of decisions that accepted every category",
  },
  optOut: {
    label: "Opt-out rate",
    goodWhen: "down",
    color: "var(--color-rose)",
    of: (p) => ratio(p.rejected, p.accepted + p.partial + p.rejected),
    describe: "Share of decisions that rejected all optional categories",
  },
  partial: {
    label: "Partial consent",
    goodWhen: "neutral",
    color: "var(--color-amber)",
    of: (p) => ratio(p.partial, p.accepted + p.partial + p.rejected),
    describe: "Share of decisions that chose specific categories",
  },
  bounce: {
    label: "Banner bounce rate",
    goodWhen: "down",
    color: "var(--color-ink-3)",
    of: (p) => ratio(p.bounces, p.views),
    describe: "Share of banner views where the visitor left without choosing",
  },
};

function ratio(n: number, d: number) {
  return d ? n / d : null;
}

export const formatPts = (n: number) => `${(n * 100).toFixed(1)} pts`;

/* ---------- leaks ---------- */


export interface LeakGroup {
  key: string;
  url: string;
  host: string;
  category: CategoryId;
  page: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  frameworks: Framework[];
  countries: string[];
  /** a tracker rule already covers this URL: the script ran before plain-consent.js could hold it */
  matchedTracker?: Pick<Tracker, "id" | "name" | "pattern">;
}

export const leakHost = (url: string) => url.replace(/^https?:\/\//, "").split("/")[0];

/** Group leak reports by request, category and page; newest activity first. */
export function groupLeaks(leaks: LeakReport[], trackers: Tracker[]): LeakGroup[] {
  const groups = new Map<string, LeakGroup & { fw: Set<Framework>; cc: Set<string> }>();
  for (const l of leaks) {
    const key = `${l.url}|${l.category}|${l.page}`;
    let g = groups.get(key);
    if (!g) {
      const matched = trackers.find((t) => l.url.includes(t.pattern));
      g = {
        key,
        url: l.url,
        host: leakHost(l.url),
        category: l.category,
        page: l.page,
        count: 0,
        firstSeen: l.createdAt,
        lastSeen: l.createdAt,
        frameworks: [],
        countries: [],
        matchedTracker: matched ? { id: matched.id, name: matched.name, pattern: matched.pattern } : undefined,
        fw: new Set(),
        cc: new Set(),
      };
      groups.set(key, g);
    }
    g.count += 1;
    if (l.createdAt < g.firstSeen) g.firstSeen = l.createdAt;
    if (l.createdAt > g.lastSeen) g.lastSeen = l.createdAt;
    g.fw.add(l.framework);
    if (l.country) g.cc.add(l.country);
  }
  return [...groups.values()]
    .map(({ fw, cc, ...g }) => ({ ...g, frameworks: [...fw], countries: [...cc].sort() }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** ISO timestamp for `days` days before now. */
export const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
