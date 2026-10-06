import { contrastRatio } from "./color";
import { DEFAULT_REASK_DAYS, FRAMEWORK_META } from "./defaults";
import { EIGHTH_SCHEDULE } from "./i18n/languages";
import type { BannerConfig, Framework } from "./types";

/**
 * Fairness check: does this banner treat visitors fairly and meet the rules of every region it's
 * shown in? Pure and side-effect free so the builder, the publish action and the Evidence Pack all
 * evaluate the same thing. "fail" blocks publishing; "warn" is advice.
 */

export type Severity = "fail" | "warn" | "pass";
export type FixTarget = "banner:design" | "banner:text" | "banner:categories" | "banner:behaviour" | "regions" | "regions:notice" | "languages" | "settings";

export interface FairnessCheck {
  id: string;
  framework: Framework | "all";
  severity: Severity;
  title: string;
  detail: string;
  /** law or guidance the check is based on */
  ref?: string;
  fix?: { label: string; target: FixTarget };
}

export interface FairnessResult {
  checks: FairnessCheck[];
  /** share of checks passing, 0–100 */
  score: number;
  failures: FairnessCheck[];
  warnings: FairnessCheck[];
}

export interface FairnessContext {
  /** the organization has a DPO or grievance contact on file */
  dpoEmail?: string;
}

const MIN_CONTRAST = 4.5;
const STRICT: Framework[] = ["gdpr", "dpdpa"];

export function evaluateFairness(config: Omit<BannerConfig, "version">, ctx: FairnessContext = {}): FairnessResult {
  const checks: FairnessCheck[] = [];
  const add = (c: FairnessCheck) => checks.push(c);
  const enabled = (Object.keys(config.regions) as Framework[]).filter((f) => config.regions[f].enabled);
  const { theme } = config;

  /* ---- applies to every region ---- */
  const textContrast = contrastRatio(theme.text, theme.background);
  add({
    id: "contrast-text",
    framework: "all",
    severity: textContrast >= MIN_CONTRAST ? "pass" : "warn",
    title: "Readable text",
    detail:
      textContrast >= MIN_CONTRAST
        ? `Text contrast is ${textContrast.toFixed(1)}:1.`
        : `Text contrast is ${textContrast.toFixed(1)}:1, below 4.5:1. The script will switch to a readable colour, so your design won't show as set.`,
    ref: "WCAG 2.1 SC 1.4.3",
    fix: textContrast >= MIN_CONTRAST ? undefined : { label: "Adjust colours", target: "banner:design" },
  });
  const buttonContrast = contrastRatio(theme.accentText, theme.accent);
  add({
    id: "contrast-button",
    framework: "all",
    severity: buttonContrast >= MIN_CONTRAST ? "pass" : "warn",
    title: "Readable buttons",
    detail:
      buttonContrast >= MIN_CONTRAST
        ? `Button text contrast is ${buttonContrast.toFixed(1)}:1.`
        : `Button text contrast is ${buttonContrast.toFixed(1)}:1, below 4.5:1. The script will override the button text colour.`,
    ref: "WCAG 2.1 SC 1.4.3",
    fix: buttonContrast >= MIN_CONTRAST ? undefined : { label: "Adjust colours", target: "banner:design" },
  });
  add({
    id: "gpc",
    framework: "all",
    severity: "pass",
    title: "Global Privacy Control honoured",
    detail: "Browsers that send GPC are treated as opting out of sale and sharing, and the receipt records it.",
    ref: "CCPA regs §7025",
  });
  add({
    id: "leaks",
    framework: "all",
    severity: config.leakDetection === false ? "warn" : "pass",
    title: "Leak detection",
    detail:
      config.leakDetection === false
        ? "Off. You won't hear about trackers that still fire after a visitor declines."
        : "On. Trackers that fire after a decline are reported to the Leaks page.",
    fix: config.leakDetection === false ? { label: "Turn on", target: "regions:notice" } : undefined,
  });

  /* ---- strict opt-in regions: GDPR and DPDPA ---- */
  for (const fw of STRICT.filter((f) => enabled.includes(f))) {
    const name = FRAMEWORK_META[fw].name;
    add({
      id: `${fw}-opt-in`,
      framework: fw,
      severity: config.regions[fw].model === "opt-in" ? "pass" : "fail",
      title: "Opt-in before anything optional runs",
      detail: config.regions[fw].model === "opt-in" ? `${name} visitors must agree first.` : `${name} requires opt-in. Optional trackers can't run until the visitor agrees.`,
      ref: fw === "gdpr" ? "GDPR Art. 6, 7; ePrivacy Art. 5(3)" : "DPDP Act s.6(1)",
      fix: config.regions[fw].model === "opt-in" ? undefined : { label: "Switch to opt-in", target: "regions" },
    });
    add({
      id: `${fw}-equal-buttons`,
      framework: fw,
      severity: theme.equalButtons ? "pass" : "fail",
      title: "Refusing is as easy as accepting",
      detail: theme.equalButtons
        ? "Reject has the same size, weight and position as Accept."
        : `${name} treats a weaker reject button as a dark pattern. Turn equal-weight buttons on.`,
      ref: fw === "gdpr" ? "EDPB Guidelines 03/2022" : "DPDP Act s.6(4)",
      fix: theme.equalButtons ? undefined : { label: "Turn on equal buttons", target: "banner:design" },
    });
  }

  if (enabled.includes("gdpr")) {
    const reask = config.reaskAfterRejectDays ?? DEFAULT_REASK_DAYS;
    add({
      id: "gdpr-reask",
      framework: "gdpr",
      severity: reask >= DEFAULT_REASK_DAYS ? "pass" : "warn",
      title: "No nagging after a refusal",
      detail:
        reask >= DEFAULT_REASK_DAYS
          ? `Visitors who reject everything aren't asked again for ${reask} days.`
          : `Visitors who reject are asked again after ${reask} days. Regulators and the EU's proposed cookie rules expect at least 6 months.`,
      ref: "EU Digital Omnibus (proposed), CNIL guidance",
      fix: reask >= DEFAULT_REASK_DAYS ? undefined : { label: "Set to 180 days", target: "regions:notice" },
    });
  }

  /* ---- DPDPA specifics ---- */
  if (enabled.includes("dpdpa")) {
    const missingItems = config.categories.filter((c) => !c.required && !(c.dataItems && c.dataItems.length));
    add({
      id: "dpdpa-itemised",
      framework: "dpdpa",
      severity: missingItems.length ? "fail" : "pass",
      title: "Itemised notice",
      detail: missingItems.length
        ? `List the personal data collected for ${missingItems.map((c) => c.label).join(", ")}. The notice must itemise data for each purpose.`
        : "Every optional purpose lists the personal data it uses.",
      ref: "DPDP Rules 2025, Rule 3(b)",
      fix: missingItems.length ? { label: "Add data items", target: "banner:categories" } : undefined,
    });
    const contact = config.rights?.grievanceEmail || ctx.dpoEmail;
    add({
      id: "dpdpa-contact",
      framework: "dpdpa",
      severity: contact ? "pass" : "fail",
      title: "Someone to contact",
      detail: contact
        ? `Questions and grievances go to ${contact}.`
        : "Publish a Data Protection Officer or a person who can answer questions about processing.",
      ref: "DPDP Act s.8(9); Rule 9, Rule 14",
      fix: contact ? undefined : { label: "Add a DPO or grievance contact", target: "settings" },
    });
    const rights = config.rights?.rightsUrl || config.policyUrl;
    add({
      id: "dpdpa-rights",
      framework: "dpdpa",
      severity: config.rights?.rightsUrl ? "pass" : rights ? "warn" : "fail",
      title: "How to exercise rights",
      detail: config.rights?.rightsUrl
        ? "The notice links to where people can access, correct and erase their data."
        : "The notice falls back to your policy link. Point it at the section that explains access, correction and erasure.",
      ref: "DPDP Rules 2025, Rule 3(c)(ii)",
      fix: config.rights?.rightsUrl ? undefined : { label: "Add rights link", target: "regions:notice" },
    });
    add({
      id: "dpdpa-board",
      framework: "dpdpa",
      severity: config.rights?.boardComplaintUrl ? "pass" : "warn",
      title: "How to complain to the Data Protection Board",
      detail: config.rights?.boardComplaintUrl
        ? "The notice explains how to complain to the Board."
        : "Add the Board's complaint link once it's published. Until then, describe the route in your privacy notice.",
      ref: "DPDP Rules 2025, Rule 3(c)(iii)",
      fix: config.rights?.boardComplaintUrl ? undefined : { label: "Add Board link", target: "regions:notice" },
    });
    const indian = Object.entries(config.regions.dpdpa.translations ?? {}).filter(([code]) => EIGHTH_SCHEDULE.some((l) => l.code === code));
    const reviewed = indian.filter(([, t]) => t?.status === "reviewed");
    add({
      id: "dpdpa-languages",
      framework: "dpdpa",
      severity: reviewed.length ? "pass" : "warn",
      title: "Notice in an Indian language",
      detail: reviewed.length
        ? `Reviewed in ${reviewed.length} Eighth Schedule language${reviewed.length > 1 ? "s" : ""}.`
        : indian.length
          ? `${indian.length} draft translation${indian.length > 1 ? "s" : ""} waiting for review.`
          : "People must be able to read the notice in English or any of the 22 scheduled languages. Add the ones your visitors read.",
      ref: "DPDP Act s.5(3)",
      fix: reviewed.length ? undefined : { label: indian.length ? "Review translations" : "Add languages", target: "languages" },
    });
  }

  /* ---- CCPA ---- */
  if (enabled.includes("ccpa")) {
    const label = config.regions.ccpa.copy.rejectAll.toLowerCase();
    const statutory = label.includes("sell") && label.includes("share");
    add({
      id: "ccpa-dns",
      framework: "ccpa",
      severity: statutory ? "pass" : "warn",
      title: "\"Do Not Sell or Share\" wording",
      detail: statutory
        ? "The opt-out uses the wording the regulations expect."
        : "The opt-out should say \"Do Not Sell or Share My Personal Information\" so people recognise it.",
      ref: "Cal. Civ. Code §1798.135",
      fix: statutory ? undefined : { label: "Edit wording", target: "banner:text" },
    });
  }

  const failures = checks.filter((c) => c.severity === "fail");
  const warnings = checks.filter((c) => c.severity === "warn");
  const score = Math.round((checks.filter((c) => c.severity === "pass").length / checks.length) * 100);
  return { checks, score, failures, warnings };
}

/** Path for a fix target, relative to a site. */
export function fixHref(propertyId: string, target: FixTarget) {
  if (target === "settings") return "/app/settings";
  const [section, tab] = target.split(":");
  if (section === "regions") return `/app/sites/${propertyId}/regions${tab ? "#notice" : ""}`;
  return `/app/sites/${propertyId}/${section}${tab ? `?tab=${tab}` : ""}`;
}
