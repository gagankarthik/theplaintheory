// Platform (staff console) domain types. Client-safe: no Node or server imports.

export type PlatformAuditAction =
  | "org.plan_changed"
  | "org.suspended"
  | "org.unsuspended"
  | "org.legal_hold_set"
  | "org.legal_hold_cleared"
  | "user.unlocked"
  | "user.sessions_revoked"
  | "staff.invited"
  | "staff.invite_resent"
  | "staff.role_changed"
  | "staff.password_reset"
  | "staff.disabled"
  | "staff.enabled"
  | "staff.removed"
  /** from the earlier model (roles stored on customer accounts); kept so old events still display */
  | "staff.granted"
  | "staff.revoked"
  | "lead.status_changed";

/**
 * What Plain Theory staff did to customer accounts. Hash-chained in one platform-wide sequence, so an
 * edited or removed event breaks verification, the same construction as the per-org audit trail.
 */
export interface PlatformAuditEvent {
  id: string;
  seq: number;
  /** "staff:<cognito sub>" for a staff-pool identity (older events hold a customer user id) */
  actorUserId: string;
  actorEmail: string;
  /** the actor's effective platform role at the time */
  actorRole: string;
  action: PlatformAuditAction;
  /** "staff" targets are identified by their staff-pool sub */
  target: { type: "org" | "user" | "lead" | "staff"; id: string; label?: string };
  /** short, non-secret context: old and new values, the reason given */
  metadata?: Record<string, string | number | boolean | null>;
  ipHash: string;
  userAgent: string;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export type PlatformAuditDraft = Omit<PlatformAuditEvent, "id" | "seq" | "prevHash" | "hash" | "createdAt"> & { createdAt?: string };

export interface PlatformAuditQuery {
  limit?: number;
  /** events with seq < before (newest-first pagination) */
  before?: number;
  /** exact action or a prefix such as "org" */
  action?: string;
  targetId?: string;
}

export const PLATFORM_AUDIT_LABELS: Record<PlatformAuditAction, string> = {
  "org.plan_changed": "Changed plan",
  "org.suspended": "Suspended organization",
  "org.unsuspended": "Lifted suspension",
  "org.legal_hold_set": "Placed legal hold",
  "org.legal_hold_cleared": "Lifted legal hold",
  "user.unlocked": "Unlocked account",
  "user.sessions_revoked": "Signed user out everywhere",
  "staff.invited": "Invited staff member",
  "staff.invite_resent": "Resent staff invite",
  "staff.role_changed": "Changed staff role",
  "staff.password_reset": "Reset staff password",
  "staff.disabled": "Disabled staff account",
  "staff.enabled": "Enabled staff account",
  "staff.removed": "Removed staff account",
  "staff.granted": "Granted staff role",
  "staff.revoked": "Removed staff role",
  "lead.status_changed": "Changed request status",
};
