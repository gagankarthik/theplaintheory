import type { Lead, LeadTopic } from "@/lib/types";
import { LEAD_TOPICS } from "@/lib/lead-options";

const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface LeadDay {
  day: string;
  total: number;
  byTopic: Record<LeadTopic, number>;
}

export interface Breakdown {
  key: string;
  count: number;
}

export interface LeadMetrics {
  total: number;
  /** status "new" (or missing): nobody has picked it up */
  unanswered: number;
  open: number;
  closed: number;
  last30: number;
  prev30: number;
  /** support tickets marked high or urgent that aren't closed */
  urgentOpen: number;
  /** age in ms of the oldest request still waiting for a first reply, null when none */
  oldestWaitingMs: number | null;
  /** median ms from received to closed, over closed requests with a close time */
  medianCloseMs: number | null;
  topics: { topic: LeadTopic; total: number; waiting: number; last30: number }[];
  days: LeadDay[];
  /** sales enquiries: how big the prospect is */
  salesSites: Breakdown[];
  salesPageviews: Breakdown[];
  /** support tickets that aren't closed, by severity */
  supportSeverity: Breakdown[];
  /** sales and enterprise: where visitors are */
  regions: Breakdown[];
}

const topicOf = (l: Lead): LeadTopic => l.topic ?? "sales";
const statusOf = (l: Lead) => l.status ?? "new";

function tally(values: (string | undefined)[], order: readonly string[]): Breakdown[] {
  const m = new Map<string, number>(order.map((k) => [k, 0]));
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count }));
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Inbox health and demand figures for the staff console, from the stored contact-form requests. */
export function leadMetrics(leads: Lead[], now = Date.now(), days = 30): LeadMetrics {
  const since30 = now - 30 * DAY;
  const since60 = now - 60 * DAY;
  const t = (iso: string) => Date.parse(iso);

  const waiting = leads.filter((l) => statusOf(l) === "new");
  const oldest = waiting.reduce<number | null>((min, l) => (min === null || t(l.createdAt) < min ? t(l.createdAt) : min), null);
  const closeTimes = leads.filter((l) => statusOf(l) === "closed" && l.updatedAt).map((l) => Math.max(0, t(l.updatedAt!) - t(l.createdAt)));

  const series = new Map<string, LeadDay>();
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(now - i * DAY);
    series.set(day, { day, total: 0, byTopic: { sales: 0, support: 0, partner: 0, enterprise: 0 } });
  }
  for (const l of leads) {
    const d = series.get(l.createdAt.slice(0, 10));
    if (!d) continue;
    d.total++;
    d.byTopic[topicOf(l)]++;
  }

  const sales = leads.filter((l) => topicOf(l) === "sales");
  const support = leads.filter((l) => topicOf(l) === "support");
  const openSupport = support.filter((l) => statusOf(l) !== "closed");

  return {
    total: leads.length,
    unanswered: waiting.length,
    open: leads.filter((l) => statusOf(l) === "open").length,
    closed: leads.filter((l) => statusOf(l) === "closed").length,
    last30: leads.filter((l) => t(l.createdAt) >= since30).length,
    prev30: leads.filter((l) => t(l.createdAt) >= since60 && t(l.createdAt) < since30).length,
    urgentOpen: openSupport.filter((l) => l.severity === "urgent" || l.severity === "high").length,
    oldestWaitingMs: oldest === null ? null : Math.max(0, now - oldest),
    medianCloseMs: median(closeTimes),
    topics: LEAD_TOPICS.map((topic) => {
      const of = leads.filter((l) => topicOf(l) === topic);
      return { topic, total: of.length, waiting: of.filter((l) => statusOf(l) === "new").length, last30: of.filter((l) => t(l.createdAt) >= since30).length };
    }),
    days: [...series.values()],
    salesSites: tally(sales.map((l) => l.sites), ["1", "2-10", "11-50", "50+"]),
    salesPageviews: tally(sales.map((l) => l.pageviews), ["<100k", "100k-1m", "1m-10m", "10m+"]),
    supportSeverity: tally(openSupport.map((l) => l.severity ?? "normal"), ["urgent", "high", "normal", "low"]),
    regions: tally(
      leads.filter((l) => topicOf(l) === "sales" || topicOf(l) === "enterprise").flatMap((l) => l.regions ?? []),
      ["eu", "us", "in", "other"],
    ),
  };
}

/** "3 h", "2 d": a short age for a duration in ms. */
export function shortDuration(ms: number) {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}
