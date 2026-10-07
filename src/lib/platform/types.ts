// Platform (staff console) domain types. Client-safe: no Node or server imports.

export type PlatformAuditAction =
  | "org.plan_changed"
  | "org.suspended"
  | "org.unsuspended"
  | "user.unlocked"
  | "user.sessions_revoked"
  | "staff.granted"
  | "staff.role_changed"
  | "staff.revoked";

/**
 * What Plain Theory staff did to customer accounts. Hash-chained in one platform-wide sequence, so an
 * edited or removed event breaks verification, the same construction as the per-org audit trail.
 */
export interface PlatformAuditEvent {
  id: string;
  seq: number;
  actorUserId: string;
  actorEmail: string;
  /** the actor's effective platform role at the time */
  actorRole: string;
  action: PlatformAuditAction;
  target: { type: "org" | "user"; id: string; label?: string };
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
  "user.unlocked": "Unlocked account",
  "user.sessions_revoked": "Signed user out everywhere",
  "staff.granted": "Granted staff role",
  "staff.role_changed": "Changed staff role",
  "staff.revoked": "Removed staff role",
};
