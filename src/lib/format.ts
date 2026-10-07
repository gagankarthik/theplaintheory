/**
 * The app's one set of formatters. One locale (en-GB), every date in UTC, so the server and the
 * browser render the same text and nobody sees a time that depends on where the page was built.
 *
 *   formatDate("2026-10-07T14:05:09Z")      → "7 Oct 2026"
 *   formatDateTime("2026-10-07T14:05:09Z")  → "7 Oct 2026, 14:05 UTC"
 *   formatDateTimeFull(...)                 → "7 October 2026, 14:05:09 UTC" (tooltips, proofs)
 *   formatRelative(iso)                     → "3 hours ago", "in 2 days", "just now"
 *   formatNumber(12345)                     → "12,345"
 *   formatPct(0.4567)                       → "46%"
 *   formatMoney(1999, "usd")                → "$19.99"
 *
 * Use <DateText> (components/app/ui/date-text) to put a date on screen: it renders <time> with the
 * machine-readable value and the full UTC time as its title.
 */

export const LOCALE = "en-GB";

// Month names are spelled out here rather than taken from Intl: newer ICU data abbreviates
// September as "Sept" in en-GB, which would make one month in twelve look different.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type DateInput = string | number | Date;

/** A Date from an ISO string, a yyyy-mm-dd day (read as UTC midnight), epoch ms or a Date. */
export function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "7 Oct 2026" */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "7 Oct 2026, 14:05 UTC" */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(d)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "7 October 2026, 14:05:09 UTC": the unambiguous form, for titles and proof pages */
export function formatDateTimeFull(value: DateInput): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

/** "3 hours ago", "yesterday", "in 2 days"; anything within a minute is "just now" */
export function formatRelative(value: DateInput, now: DateInput = Date.now()): string {
  const t = toDate(value).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((t - toDate(now).getTime()) / 1000);
  if (Math.abs(s) < 60) return "just now";
  for (const [unit, size] of UNITS) if (Math.abs(s) >= size) return relative.format(Math.trunc(s / size), unit);
  return "just now";
}

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** "12,345". Pass `digits` for decimals: formatNumber(1.5, 1) → "1.5" */
export function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  if (!digits) return integer.format(n);
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/**
 * A ratio as a percentage: formatPct(0.4567) → "46%". Small non-zero ratios keep one decimal so they
 * never read as 0% ("4.2%"); pass `digits` to fix the precision.
 */
export function formatPct(ratio: number, digits?: number): string {
  if (!Number.isFinite(ratio)) return "—";
  const d = digits ?? (ratio > 0 && ratio < 0.1 ? 1 : 0);
  return `${(ratio * 100).toFixed(d)}%`;
}

// Currencies Stripe charges in whole units (no minor unit)
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

/**
 * Money from Stripe-style minor units: formatMoney(1999, "usd") → "$19.99", formatMoney(49900, "inr")
 * → "₹499.00". Symbols are the narrow form ("$", not "US$").
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const code = currency.toLowerCase();
  const amount = ZERO_DECIMAL.has(code) ? amountMinor : amountMinor / 100;
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: code.toUpperCase(), currencyDisplay: "narrowSymbol" }).format(amount);
  } catch {
    return `${formatNumber(amount, ZERO_DECIMAL.has(code) ? 0 : 2)} ${code.toUpperCase()}`;
  }
}
