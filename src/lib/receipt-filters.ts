import type { ConsentAction, ConsentReceipt, Framework } from "./types";

/**
 * Filters for the consent log and its CSV export. Every value comes from the query string, so each
 * one is validated and anything unrecognised is dropped rather than trusted.
 */
export interface ReceiptFilters {
  action?: ConsentAction;
  framework?: Framework;
  /** yyyy-mm-dd, inclusive, UTC */
  from?: string;
  /** yyyy-mm-dd, inclusive, UTC */
  to?: string;
  /** a full visitor id, or the start of one (as shown in the table) */
  visitor?: string;
  /** only receipts where the browser sent Global Privacy Control */
  gpc?: boolean;
}

const ACTIONS: ConsentAction[] = ["accept_all", "reject_all", "custom", "revoke", "dismiss"];
const FRAMEWORKS: Framework[] = ["gdpr", "ccpa", "dpdpa", "generic"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const validDay = (v: string | undefined) => (v && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : undefined);

export function parseReceiptFilters(sp: Record<string, string | string[] | undefined>): ReceiptFilters {
  const str = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const action = str("action");
  const framework = str("framework");
  const visitor = str("visitor")?.toLowerCase();
  let from = validDay(str("from"));
  let to = validDay(str("to"));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    action: ACTIONS.includes(action as ConsentAction) ? (action as ConsentAction) : undefined,
    framework: FRAMEWORKS.includes(framework as Framework) ? (framework as Framework) : undefined,
    from,
    to,
    visitor: visitor && /^[a-f0-9]{4,64}$/.test(visitor) ? visitor : undefined,
    gpc: str("gpc") === "1" ? true : undefined,
  };
}

/** True when any filter other than the date range is set (those need a scan, not a key range). */
export const hasFieldFilters = (f: ReceiptFilters) => Boolean(f.action || f.framework || f.visitor || f.gpc);
export const hasFilters = (f: ReceiptFilters) => hasFieldFilters(f) || Boolean(f.from || f.to);

/** The ISO bounds for the store's from/to query. */
export const filterRange = (f: ReceiptFilters) => ({
  from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
  to: f.to ? `${f.to}T23:59:59.999Z` : undefined,
});

export function matchesReceipt(r: Pick<ConsentReceipt, "action" | "framework" | "visitorId" | "timestamp" | "gpc">, f: ReceiptFilters) {
  const { from, to } = filterRange(f);
  if (from && r.timestamp < from) return false;
  if (to && r.timestamp > to) return false;
  if (f.action && r.action !== f.action) return false;
  if (f.framework && r.framework !== f.framework) return false;
  if (f.visitor && !r.visitorId.startsWith(f.visitor)) return false;
  if (f.gpc && !r.gpc) return false;
  return true;
}

/** The filters as query-string pairs, for links that keep them (pagination, export). */
export function filterQuery(f: ReceiptFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.action) out.action = f.action;
  if (f.framework) out.framework = f.framework;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.visitor) out.visitor = f.visitor;
  if (f.gpc) out.gpc = "1";
  return out;
}
