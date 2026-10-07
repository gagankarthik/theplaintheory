import "server-only";
import { verifyAuditChain } from "./audit-chain";
import { verifyChain } from "./crypto";
import { planById } from "./plans";
import type { Store } from "./store/types";
import type { Organization } from "./types";

/**
 * Live status of the product's SOC 2 controls for one organization. Each check reads real state
 * (store, environment), never a hard-coded "pass", except where the control is fixed in code and
 * the note says so. Organisational controls (policies, training, vendor reviews) live in docs/soc2.
 */
export type ControlStatus = "pass" | "attention";

export interface ControlCheck {
  id: string;
  criteria: string[];
  title: string;
  status: ControlStatus;
  detail: string;
  evidence: { label: string; href: string }[];
}

const DAY = 86_400_000;
const ACCESS_REVIEW_DAYS = 90;
const RETENTION_STALE_HOURS = 48;

export async function evaluateControls(store: Store, org: Organization, now = new Date()): Promise<ControlCheck[]> {
  const [members, invites, audit, properties] = await Promise.all([
    store.listMembers(org.id),
    store.listInvites(org.id),
    store.listAudit(org.id),
    store.listProperties(org.id),
  ]);
  const people = members.filter((m) => m.user);
  const withoutMfa = people.filter((m) => !m.user!.mfa);
  const owners = members.filter((m) => m.role === "owner");
  const staleInvites = invites.filter((i) => now.getTime() - Date.parse(i.createdAt) > 30 * DAY);
  const lastReview = audit.find((e) => e.action === "access_review.exported");
  const reviewAgeDays = lastReview ? Math.floor((now.getTime() - Date.parse(lastReview.createdAt)) / DAY) : null;
  const auditChain = verifyAuditChain(audit);
  const chains = await Promise.all(properties.map(async (p) => ({ p, r: verifyChain(await store.listReceipts(p.id), p.retentionCheckpoint) })));
  const brokenChains = chains.filter((c) => !c.r.ok);
  const retentionAgeH = org.retentionLastRunAt ? (now.getTime() - Date.parse(org.retentionLastRunAt)) / 3_600_000 : null;
  const plan = planById(org.plan);
  const prod = process.env.NODE_ENV === "production";
  const cognito = process.env.AUTH_DRIVER === "cognito";
  const locked = people.filter((m) => m.user!.lockedUntil && Date.parse(m.user!.lockedUntil) > now.getTime());

  const pct = people.length ? Math.round(((people.length - withoutMfa.length) / people.length) * 100) : 100;

  return [
    {
      id: "mfa-policy",
      criteria: ["CC6.1"],
      title: "Two-factor sign-in is required",
      status: org.security?.requireMfa ? "pass" : "attention",
      detail: org.security?.requireMfa
        ? "Members without two-factor are sent to set it up before they can use the app or download exports."
        : "Two-factor is optional. An owner can require it in Settings.",
      evidence: [{ label: "Settings", href: "/app/settings" }],
    },
    {
      id: "mfa-coverage",
      criteria: ["CC6.1"],
      title: "Every member uses two-factor",
      status: withoutMfa.length ? "attention" : "pass",
      detail: withoutMfa.length
        ? `${pct}% enrolled. Without two-factor: ${withoutMfa.map((m) => m.user!.email).join(", ")}.`
        : `All ${people.length} member${people.length === 1 ? "" : "s"} have two-factor on.`,
      evidence: [
        { label: "Team", href: "/app/team" },
        { label: "Access review CSV", href: "/api/app/team/access-review" },
      ],
    },
    {
      id: "sessions",
      criteria: ["CC6.1"],
      title: "Sessions expire and can be revoked",
      status: "pass",
      detail:
        "Fixed in code: 30-minute idle timeout, 12-hour absolute lifetime, server-side session records checked on every request, new session id at sign-in and after two-factor.",
      evidence: [
        { label: "Your sessions", href: "/app/account" },
        { label: "Sign-in events", href: "/app/audit?action=auth" },
      ],
    },
    {
      id: "credentials",
      criteria: ["CC6.1"],
      title: "Password policy and lockout",
      status: locked.length ? "attention" : "pass",
      detail: cognito
        ? `Passwords are verified by the Cognito user pool: at least 12 characters with a lowercase letter, a number and a symbol; the app also refuses common and email-based passwords. 5 failures in 15 minutes locks the account for 15 minutes.${
            locked.length ? ` Locked now: ${locked.map((m) => m.user!.email).join(", ")}.` : ""
          }`
        : `At least 12 characters, common and email-based passwords refused, scrypt hashing. 5 failures in 15 minutes locks the account for 15 minutes.${
            locked.length ? ` Locked now: ${locked.map((m) => m.user!.email).join(", ")}.` : ""
          }`,
      evidence: [{ label: "Failed sign-ins", href: "/app/audit?action=auth" }],
    },
    {
      id: "access-review",
      criteria: ["CC6.2", "CC6.3"],
      title: `Access reviewed in the last ${ACCESS_REVIEW_DAYS} days`,
      status: reviewAgeDays !== null && reviewAgeDays <= ACCESS_REVIEW_DAYS ? "pass" : "attention",
      detail:
        reviewAgeDays === null
          ? "No access review has been exported yet. Export one from Team, review it and keep the signed file."
          : `Last exported ${reviewAgeDays === 0 ? "today" : `${reviewAgeDays} day${reviewAgeDays === 1 ? "" : "s"} ago`} by ${lastReview!.actorEmail}.`,
      evidence: [
        { label: "Export access review", href: "/api/app/team/access-review" },
        { label: "Past reviews", href: "/app/audit?action=access_review" },
      ],
    },
    {
      id: "least-privilege",
      criteria: ["CC6.3"],
      title: "Least privilege",
      status: owners.length > 3 || staleInvites.length ? "attention" : "pass",
      detail: [
        `${owners.length} owner${owners.length === 1 ? "" : "s"}, ${(["admin", "editor", "auditor", "viewer"] as const).map((r) => `${members.filter((m) => m.role === r).length} ${r}`).join(", ")}.`,
        owners.length > 3 ? "More than 3 owners; consider demoting some to admin." : "",
        staleInvites.length ? `${staleInvites.length} invite${staleInvites.length === 1 ? " is" : "s are"} over 30 days old; revoke ${staleInvites.length === 1 ? "it" : "them"} if no longer needed.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      evidence: [{ label: "Team", href: "/app/team" }],
    },
    {
      id: "audit-trail",
      criteria: ["CC4.1", "CC7.2"],
      title: "Audit trail is complete and untampered",
      status: auditChain.ok ? "pass" : "attention",
      detail: auditChain.ok
        ? `${auditChain.checked.toLocaleString("en-GB")} events, hash chain intact. Every change, export and sign-in is recorded.`
        : `Hash chain broken at event #${auditChain.brokenAt}. Treat as a security incident.`,
      evidence: [
        { label: "Audit log", href: "/app/audit" },
        { label: "Export CSV", href: "/api/app/audit/export" },
      ],
    },
    {
      id: "consent-integrity",
      criteria: ["PI1.4", "CC7.2"],
      title: "Consent records are untampered",
      status: brokenChains.length ? "attention" : "pass",
      detail: properties.length
        ? brokenChains.length
          ? `Chain broken on ${brokenChains.map((c) => `${c.p.domain} at #${c.r.ok ? "" : c.r.brokenAt}`).join(", ")}.`
          : `All ${properties.length} site${properties.length === 1 ? "" : "s"} verify (${chains.reduce((a, c) => a + c.r.checked, 0).toLocaleString("en-GB")} receipts).`
        : "No sites yet.",
      evidence: properties.slice(0, 3).map((p) => ({ label: `${p.domain} log`, href: `/app/sites/${p.id}/logs` })),
    },
    {
      id: "retention",
      criteria: ["C1.2", "P4.2"],
      title: "Retention job runs daily",
      status: retentionAgeH !== null && retentionAgeH <= RETENTION_STALE_HOURS ? "pass" : "attention",
      detail: `Consent receipts are kept ${plan.logRetentionDays.toLocaleString("en-GB")} days on ${plan.name}; leak reports 90 days; webhook logs 30 days; audit events at least a year. ${
        org.retentionLastRunAt ? `Last run ${new Date(org.retentionLastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.` : "The job hasn't run for this organization yet."
      }`,
      evidence: [{ label: "Retention runs", href: "/app/audit?action=retention" }],
    },
    {
      id: "transport",
      criteria: ["CC6.7"],
      title: "Encryption in transit and security headers",
      status: prod ? "pass" : "attention",
      detail: prod
        ? "HTTPS only with HSTS (2 years, preload), CSP, frame-ancestors none, no-store on app pages."
        : "Running a development server: HSTS is off until production. CSP and other headers are on.",
      evidence: [],
    },
    {
      id: "secrets",
      criteria: ["CC6.1", "CC6.7"],
      title: "Secrets configured",
      status: process.env.SESSION_SECRET && process.env.MFA_ENCRYPTION_KEY && process.env.INTERNAL_CRON_SECRET ? "pass" : "attention",
      detail: [
        process.env.SESSION_SECRET ? null : "SESSION_SECRET isn't set (development fallback in use).",
        process.env.MFA_ENCRYPTION_KEY ? null : "MFA_ENCRYPTION_KEY isn't set; MFA secrets are encrypted with a key derived from SESSION_SECRET.",
        process.env.INTERNAL_CRON_SECRET ? null : "INTERNAL_CRON_SECRET isn't set; the retention endpoint refuses requests in production.",
      ]
        .filter(Boolean)
        .join(" ") || "Session signing, MFA encryption and job secrets are set from the environment.",
      evidence: [],
    },
  ];
}
