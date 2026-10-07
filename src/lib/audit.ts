import "server-only";
import { requestContext } from "./request-context";
import { getStore } from "./store";
import type { AuditAction, AuditEvent } from "./types";

export { verifyAuditChain } from "./audit-chain";

export type Actor = { userId: string; email: string } | { system: string };

export interface AuditInput {
  orgId: string;
  actor: Actor;
  action: AuditAction;
  target: AuditEvent["target"];
  metadata?: AuditEvent["metadata"];
}

/** Keys that must never reach the audit trail, whatever a caller passes. */
const FORBIDDEN_META = /secret|password|token|code|key|hash/i;

function cleanMetadata(meta: AuditInput["metadata"]) {
  if (!meta) return undefined;
  const out: NonNullable<AuditEvent["metadata"]> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_META.test(k)) continue;
    out[k] = typeof v === "string" ? v.slice(0, 200) : v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Append one event to the organization's hash-chained audit trail (SOC 2 CC4.1, CC7.2).
 * Fails closed: if the event can't be written, the calling action fails too, so no change happens
 * without a record of it.
 */
export async function recordAudit(input: AuditInput) {
  const store = await getStore();
  const ctx = await requestContext();
  const actor = "system" in input.actor ? { actorUserId: null, actorEmail: `system:${input.actor.system}` } : { actorUserId: input.actor.userId, actorEmail: input.actor.email };
  return store.appendAudit({
    orgId: input.orgId,
    ...actor,
    action: input.action,
    target: { type: input.target.type, id: input.target.id, label: input.target.label?.slice(0, 120) },
    metadata: cleanMetadata(input.metadata),
    ipHash: "system" in input.actor ? "system" : ctx.ipHash,
    userAgent: "system" in input.actor ? "system" : ctx.userAgent,
  });
}

/** Record an event in every organization the user belongs to (sign-ins, MFA, password changes). */
export async function recordUserAudit(userId: string, email: string, action: AuditAction, metadata?: AuditEvent["metadata"]) {
  const store = await getStore();
  const memberships = await store.listMemberships(userId);
  await Promise.all(
    memberships.map((m) => recordAudit({ orgId: m.orgId, actor: { userId, email }, action, target: { type: "user", id: userId, label: email }, metadata })),
  );
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.signup": "Signed up",
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.locked": "Account locked",
  "auth.logout": "Signed out",
  "auth.mfa_enabled": "Turned on two-factor",
  "auth.mfa_disabled": "Turned off two-factor",
  "auth.mfa_recovery_used": "Used a recovery code",
  "auth.password_changed": "Changed password",
  "auth.password_reset": "Reset password by email",
  "auth.session_revoked": "Revoked a session",
  "auth.recovery_codes_regenerated": "Regenerated recovery codes",
  "org.created": "Created organization",
  "org.settings_updated": "Updated organization settings",
  "org.security_updated": "Updated security settings",
  "member.invited": "Invited a member",
  "member.invite_revoked": "Revoked an invite",
  "member.joined": "Joined from invite",
  "member.role_changed": "Changed a role",
  "member.removed": "Removed a member",
  "property.created": "Added a site",
  "property.deleted": "Deleted a site",
  "property.published": "Published a banner",
  "banner.updated": "Saved banner draft",
  "regions.updated": "Updated regions",
  "notice.updated": "Updated notice settings",
  "tracker.added": "Added tracker",
  "tracker.updated": "Changed tracker category",
  "tracker.removed": "Removed tracker",
  "tracker.scan_run": "Ran tracker scan",
  "tracker.approved": "Approved tracker",
  "tracker.ignored": "Ignored tracker",
  "tracker.restored": "Restored tracker to review",
  "site.audit_run": "Ran live site check",
  "language.added": "Added a language",
  "language.updated": "Edited a translation",
  "language.reviewed": "Marked translation reviewed",
  "language.removed": "Removed a language",
  "webhook.created": "Created webhook",
  "webhook.updated": "Paused or resumed webhook",
  "webhook.deleted": "Deleted webhook",
  "webhook.tested": "Sent test webhook",
  "billing.plan_changed": "Plan changed",
  "logs.exported": "Exported consent log",
  "logs.chain_verified": "Verified consent chain",
  "evidence.exported": "Exported Evidence Pack",
  "access_review.exported": "Exported access review",
  "audit.exported": "Exported audit log",
  "audit.chain_verified": "Verified audit log chain",
  "retention.run": "Retention job ran",
  "retention.grace_started": "Records kept 30 days after plan change",
  "retention.grace_expired": "Records grace period ended",
  "retention.legal_hold_set": "Legal hold placed",
  "retention.legal_hold_cleared": "Legal hold lifted",
};
