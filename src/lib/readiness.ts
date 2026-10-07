import { evaluateFairness, type FixTarget, type Severity } from "./fairness";
import { EIGHTH_SCHEDULE } from "./i18n/languages";
import type { Plan } from "./plans";
import type { SiteAuditReport } from "./site-audit/types";
import type { Organization, Property } from "./types";

/**
 * DPDP readiness: a checklist of what the Act and the DPDP Rules 2025 expect from a consent notice
 * and its records, evaluated against one site. Pure, so it can run in pages, the Evidence Pack and
 * tests. Not legal advice: it checks what Plain Theory can see.
 */

export interface ReadinessItem {
  id: string;
  title: string;
  ref: string;
  severity: Severity;
  detail: string;
  fix?: { label: string; target: FixTarget | "billing" | "install" | "settings:dpo" };
}

export interface Readiness {
  items: ReadinessItem[];
  /** passes count fully, warnings half */
  percent: number;
  passed: number;
  total: number;
}

/** Most obligations commence 18 months after notification (13 Nov 2025). */
export const DPDP_DEADLINE = "2027-05-13";
export const DPDP_CONSENT_MANAGER_DATE = "2026-11-13";

/** Where the live site check looked for something, for messages like "on acme.in/privacy". */
function liveWhere(report: SiteAuditReport, evidenceUrl?: string) {
  const page = evidenceUrl ?? report.pages.find((p) => p.kind === "privacy" && p.status === 200)?.url ?? report.homeUrl;
  if (!page) return report.domain;
  try {
    const u = new URL(page);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
  } catch {
    return report.domain;
  }
}

/**
 * What the latest live site check found about the grievance contact, as supporting evidence.
 * It never changes the item's pass or fail, which still follows your settings.
 */
function liveGrievanceNote(report: SiteAuditReport | null | undefined, configured: boolean): string {
  if (!report) return "";
  const contact = report.checks.find((c) => c.id === "grievance-contact");
  const timeline = report.checks.find((c) => c.id === "grievance-timeline");
  if (!contact || contact.status === "unknown") return "";
  const where = liveWhere(report, contact.evidence?.url);
  const notes: string[] = [];
  if (contact.status === "pass") notes.push(`Your live site publishes it (${where}).`);
  else notes.push(configured ? `Your Settings have a contact, but we couldn't find it on ${where}.` : `We couldn't find one on ${where} either.`);
  if (timeline?.status === "warn") notes.push("Your notice doesn't say grievances are answered within 90 days.");
  return ` ${notes.join(" ")}`;
}

export function dpdpReadiness(property: Property, org: Organization, plan: Plan, opts: { liveSite?: SiteAuditReport | null } = {}): Readiness {
  const cfg = property.config;
  const dpdpa = cfg.regions.dpdpa;
  const fairness = evaluateFairness(cfg, { dpoEmail: org.dpo?.email });
  const fromFairness = (id: string) => fairness.checks.find((c) => c.id === id);
  const items: ReadinessItem[] = [];

  items.push({
    id: "notice-on",
    title: "DPDPA notice shown to visitors in India",
    ref: "DPDP Act s.5",
    severity: dpdpa.enabled ? "pass" : "fail",
    detail: dpdpa.enabled ? "Visitors in India get the DPDPA notice." : "Visitors in India currently get the default notice. Turn on the DPDPA notice.",
    fix: dpdpa.enabled ? undefined : { label: "Turn on", target: "regions" },
  });
  items.push({
    id: "live",
    title: "Notice is live on the site",
    ref: "DPDP Act s.5(1)",
    severity: property.publishedVersion > 0 ? (property.config.version === property.publishedVersion ? "pass" : "warn") : "fail",
    detail:
      property.publishedVersion === 0
        ? "Nothing is published yet, so visitors don't see a notice."
        : property.config.version === property.publishedVersion
          ? `Version ${property.publishedVersion} is live.`
          : "You have saved changes that aren't live yet.",
    fix: property.publishedVersion > 0 && property.config.version === property.publishedVersion ? undefined : { label: "Publish", target: "banner:design" },
  });

  const optIn = fromFairness("dpdpa-opt-in");
  items.push({
    id: "consent",
    title: "Free, specific consent by a clear affirmative action",
    ref: "DPDP Act s.6(1)",
    severity: !dpdpa.enabled ? "warn" : optIn?.severity ?? "pass",
    detail: dpdpa.enabled ? optIn?.detail ?? "" : "Can't check while the DPDPA notice is off.",
    fix: optIn?.fix,
  });

  const itemised = fromFairness("dpdpa-itemised");
  items.push({
    id: "itemised",
    title: "Itemised list of personal data for each purpose",
    ref: "DPDP Rules 2025, Rule 3(b)",
    severity: itemised?.severity ?? (cfg.categories.every((c) => c.required || c.dataItems?.length) ? "pass" : "fail"),
    detail: itemised?.detail ?? "Every optional purpose lists the personal data it uses.",
    fix: itemised?.fix ?? { label: "Add data items", target: "banner:categories" },
  });

  const equal = fromFairness("dpdpa-equal-buttons");
  items.push({
    id: "withdrawal",
    title: "Withdrawing is as easy as giving consent",
    ref: "DPDP Act s.6(4)",
    severity: cfg.headless ? "warn" : equal?.severity ?? (cfg.theme.equalButtons ? "pass" : "fail"),
    detail: cfg.headless
      ? "Headless mode: make sure your own interface offers a one-step way to withdraw."
      : "A \"Privacy choices\" button stays on every page after a decision, and refusing is as easy as accepting.",
    fix: equal?.fix,
  });

  const langs = Object.entries(dpdpa.translations ?? {}).filter(([code]) => EIGHTH_SCHEDULE.some((l) => l.code === code));
  const reviewed = langs.filter(([, t]) => t?.status === "reviewed").length;
  items.push({
    id: "languages",
    title: "Notice available in Eighth Schedule languages",
    ref: "DPDP Act s.5(3)",
    severity: reviewed ? "pass" : "warn",
    detail: reviewed
      ? `${reviewed} reviewed language${reviewed > 1 ? "s" : ""}${langs.length > reviewed ? `, ${langs.length - reviewed} still in draft` : ""}.`
      : langs.length
        ? `${langs.length} draft${langs.length > 1 ? "s" : ""}, none reviewed yet.`
        : "English only. Add the languages your visitors read.",
    fix: reviewed ? undefined : { label: "Manage languages", target: "languages" },
  });

  const rights = fromFairness("dpdpa-rights");
  items.push({
    id: "rights",
    title: "How to exercise rights",
    ref: "DPDP Rules 2025, Rule 3(c)(ii); Act ss.11–14",
    severity: rights?.severity ?? (cfg.rights?.rightsUrl ? "pass" : "warn"),
    detail: rights?.detail ?? "Link to where people access, correct and erase their data.",
    fix: rights?.fix,
  });
  const board = fromFairness("dpdpa-board");
  items.push({
    id: "board",
    title: "How to complain to the Data Protection Board",
    ref: "DPDP Rules 2025, Rule 3(c)(iii)",
    severity: board?.severity ?? (cfg.rights?.boardComplaintUrl ? "pass" : "warn"),
    detail: board?.detail ?? "Explain how to complain to the Board.",
    fix: board?.fix,
  });

  const contact = cfg.rights?.grievanceEmail || org.dpo?.email;
  items.push({
    id: "grievance",
    title: "Grievance contact, answered within 90 days",
    ref: "DPDP Act s.8(9), s.13; Rule 14",
    severity: contact ? "pass" : "fail",
    detail: (contact ? `Grievances go to ${contact}.` : "Add a Data Protection Officer or grievance contact.") + liveGrievanceNote(opts.liveSite, !!contact),
    fix: contact ? undefined : { label: "Add contact", target: "settings:dpo" },
  });

  const india = org.dataRegion === "ap-south-1" || org.dataRegion === "ap-south-2";
  items.push({
    id: "residency",
    title: "Consent records stored in India",
    ref: "DPDP Act s.16; sector rules",
    severity: india ? "pass" : "warn",
    detail: india
      ? `Records are stored in ${org.dataRegion === "ap-south-1" ? "Mumbai" : "Hyderabad"}.`
      : "Not required for everyone, but Significant Data Fiduciaries and regulated sectors may need data kept in India.",
    fix: india ? undefined : { label: "Change data region", target: "settings" },
  });

  const yearOfLogs = plan.logRetentionDays >= 365;
  items.push({
    id: "retention",
    title: "Consent logs kept for at least a year",
    ref: "DPDP Rules 2025, Rule 6(1)(e)",
    severity: yearOfLogs ? "pass" : "fail",
    detail: yearOfLogs
      ? `Your plan keeps consent receipts for ${Math.round(plan.logRetentionDays / 365)} year${plan.logRetentionDays >= 730 ? "s" : ""}.`
      : `The ${plan.name} plan keeps receipts for ${plan.logRetentionDays} days. Keep them for at least one year.`,
    fix: yearOfLogs ? undefined : { label: "Upgrade", target: "billing" },
  });

  items.push({
    id: "evidence",
    title: "Tamper-evident record of each decision",
    ref: "DPDP Act s.6(10)",
    severity: "pass",
    detail: "Each receipt carries the hash of the one before it, so you can prove consent was given and when.",
  });

  items.push({
    id: "leaks",
    title: "Processing stops when consent is refused",
    ref: "DPDP Act s.6(6)",
    severity: cfg.leakDetection === false ? "warn" : "pass",
    detail:
      cfg.leakDetection === false
        ? "Leak detection is off, so you won't hear about trackers that still fire after a refusal."
        : "Leak detection reports trackers that fire after a refusal.",
    fix: cfg.leakDetection === false ? { label: "Turn on", target: "regions:notice" } : undefined,
  });

  const passed = items.filter((i) => i.severity === "pass").length;
  const warned = items.filter((i) => i.severity === "warn").length;
  return { items, passed, total: items.length, percent: Math.round(((passed + warned * 0.5) / items.length) * 100) };
}

export function readinessFixHref(propertyId: string, target: NonNullable<ReadinessItem["fix"]>["target"]) {
  if (target === "billing") return "/app/billing";
  if (target === "install") return `/app/sites/${propertyId}/install`;
  if (target === "settings") return "/app/settings";
  if (target === "settings:dpo") return "/app/settings#dpo";
  const [section, tab] = target.split(":");
  if (section === "regions") return `/app/sites/${propertyId}/regions${tab ? "#notice" : ""}`;
  return `/app/sites/${propertyId}/${section}${tab ? `?tab=${tab}` : ""}`;
}
