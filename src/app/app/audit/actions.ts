"use server";

import { failure } from "@/lib/action-result";
import { recordAudit, verifyAuditChain } from "@/lib/audit";
import { assertCan } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export type AuditChainCheck =
  | { ok: true; checked: number; head: string; verifiedAt: string }
  | { ok: false; checked: number; brokenAt?: number; error?: string; verifiedAt: string };

/** Recompute every hash in the organization's audit trail and report the first break. */
export async function verifyAuditTrail(): Promise<AuditChainCheck> {
  const verifiedAt = new Date().toISOString();
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "audit:read");
    const result = verifyAuditChain(await (await getStore()).listAudit(org.id));
    // Recorded after the check, so the event itself is covered by the next verification.
    await recordAudit({
      orgId: org.id,
      actor: { userId: user.id, email: user.email },
      action: "audit.chain_verified",
      target: { type: "org", id: org.id, label: org.name },
      metadata: { ok: result.ok, checked: result.checked },
    });
    return { ...result, verifiedAt };
  } catch (e) {
    return { ok: false, checked: 0, error: failure(e)?.error, verifiedAt };
  }
}
