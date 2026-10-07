/**
 * Live site check: what visitors to a customer's real website see, read from its public HTML.
 * Pure types and helpers, safe to import from client components.
 */

export type SiteCheckStatus = "pass" | "warn" | "fail" | "unknown";

export type SiteCheckId =
  | "privacy-notice"
  | "grievance-contact"
  | "grievance-timeline"
  | "rights"
  | "board-complaint"
  | "consent-withdrawal"
  | "cmp-present"
  | "pre-consent-trackers"
  | "cookies-on-load"
  | "languages"
  | "https"
  | "children";

/** Where in the app the customer fixes something (resolved to a link by `siteAuditFixHref`). */
export type SiteFixTarget = "settings:dpo" | "regions:notice" | "trackers" | "install" | "languages" | "banner";

export interface SiteCheckEvidence {
  url: string;
  /** what the page says, at most 200 characters */
  quote?: string;
}

export interface SiteCheck {
  id: SiteCheckId;
  title: string;
  status: SiteCheckStatus;
  /** one line: what we found */
  finding: string;
  evidence?: SiteCheckEvidence;
  /** short list, e.g. the trackers or cookies found */
  items?: string[];
  /** what to change on the site */
  fix?: string;
  /** an in-app place that helps with the fix */
  action?: { label: string; target: SiteFixTarget };
  /** law reference */
  ref: string;
}

export type PageKind = "home" | "privacy" | "cookies" | "terms" | "contact" | "grievance" | "legal" | "robots";

export interface SitePageVisit {
  url: string;
  kind: PageKind;
  /** HTTP status; null when the request failed */
  status: number | null;
  /** why the page wasn't read, if it wasn't */
  note?: string;
}

export interface SiteNotice {
  id: "spa" | "robots" | "unreachable" | "budget" | "no-policy" | "truncated" | "pdf";
  text: string;
}

export interface SiteAuditReport {
  id: string;
  propertyId: string;
  domain: string;
  /** the homepage after redirects, when it was reached */
  homeUrl: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pages: SitePageVisit[];
  notices: SiteNotice[];
  checks: SiteCheck[];
  summary: Record<SiteCheckStatus, number>;
  /** the user who ran it */
  runBy?: string;
}

export function siteAuditFixHref(propertyId: string, target: SiteFixTarget) {
  switch (target) {
    case "settings:dpo":
      return "/app/settings#dpo";
    case "regions:notice":
      return `/app/sites/${propertyId}/regions#notice`;
    case "trackers":
      return `/app/sites/${propertyId}/trackers`;
    case "install":
      return `/app/sites/${propertyId}/install`;
    case "languages":
      return `/app/sites/${propertyId}/languages`;
    case "banner":
      return `/app/sites/${propertyId}/banner`;
  }
}

export function summarize(checks: SiteCheck[]): Record<SiteCheckStatus, number> {
  const out: Record<SiteCheckStatus, number> = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const c of checks) out[c.status]++;
  return out;
}

export type SiteAuditResult = { ok: true; report: SiteAuditReport } | { ok: false; error: string };
