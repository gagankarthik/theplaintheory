import "server-only";
import { staffUserKey } from "../auth/staff-token";
import { requestContext } from "../request-context";
import { getStore } from "../store";
import type { PlatformAuditAction, PlatformAuditEvent } from "./types";

/** Keys that must never reach the audit trail, whatever a caller passes. */
const FORBIDDEN_META = /secret|password|token|code|key|hash/i;

/**
 * Record a staff action in the platform audit trail. Fails closed: callers write the event before
 * reporting success, and a failed write fails the action.
 */
export async function recordPlatformAudit(input: {
  /** the signed-in staff identity (staff pool sub, email and role at the time) */
  actor: { sub: string; email: string; role: string };
  action: PlatformAuditAction;
  target: PlatformAuditEvent["target"];
  metadata?: PlatformAuditEvent["metadata"];
}) {
  const store = await getStore();
  const ctx = await requestContext();
  const metadata: NonNullable<PlatformAuditEvent["metadata"]> = {};
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    if (FORBIDDEN_META.test(k)) continue;
    metadata[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  return store.appendPlatformAudit({
    actorUserId: staffUserKey(input.actor.sub),
    actorEmail: input.actor.email,
    actorRole: input.actor.role,
    action: input.action,
    target: { type: input.target.type, id: input.target.id, label: input.target.label?.slice(0, 120) },
    metadata: Object.keys(metadata).length ? metadata : undefined,
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });
}
