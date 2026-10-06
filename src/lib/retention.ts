import { verifyChain } from "./crypto";
import { planById } from "./plans";
import type { Store } from "./store/types";
import type { RetentionCheckpoint } from "./types";

/**
 * Data retention and disposal (SOC 2 C1.2, P4.2; DPDP Rule 8). Run daily.
 *
 * - Consent receipts older than the plan's logRetentionDays are removed oldest-first. A checkpoint
 *   (last removed seq and hash) is written to the property first, so the remaining chain still
 *   verifies from it, and the Evidence Pack reports what was removed.
 * - Leak reports older than 90 days and webhook delivery logs older than 30 days are removed.
 * - The administrative audit trail is never removed here; it is kept for at least a year.
 *
 * Receipts are only removed when the chain verifies first: a broken chain is evidence of tampering,
 * so it is reported and left untouched.
 */
export const LEAK_RETENTION_DAYS = 90;
export const DELIVERY_RETENTION_DAYS = 30;
/** Floor for the administrative audit trail; nothing in this job deletes audit events. */
export const AUDIT_MIN_RETENTION_DAYS = 365;

const DAY = 86_400_000;

export interface PropertyRetention {
  propertyId: string;
  domain: string;
  cutoff: string;
  receiptsExpired: number;
  receiptsRemoved: number;
  checkpoint: RetentionCheckpoint | null;
  leaksRemoved: number;
  deliveriesRemoved: number;
  /** chain was broken before the run; nothing was removed */
  skipped?: "chain-broken";
}

export interface RetentionReport {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  orgs: { orgId: string; name: string; plan: string; logRetentionDays: number; properties: PropertyRetention[] }[];
  totals: { receiptsRemoved: number; leaksRemoved: number; deliveriesRemoved: number; propertiesSkipped: number };
}

export async function runRetention(store: Store, opts: { dryRun?: boolean; now?: Date } = {}): Promise<RetentionReport> {
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now ?? new Date();
  const startedAt = new Date().toISOString();
  const totals = { receiptsRemoved: 0, leaksRemoved: 0, deliveriesRemoved: 0, propertiesSkipped: 0 };
  const orgs: RetentionReport["orgs"] = [];

  for (const org of await store.listOrgs()) {
    const plan = planById(org.plan);
    const cutoff = new Date(now.getTime() - plan.logRetentionDays * DAY).toISOString();
    const leakCutoff = new Date(now.getTime() - LEAK_RETENTION_DAYS * DAY).toISOString();
    const deliveryCutoff = new Date(now.getTime() - DELIVERY_RETENTION_DAYS * DAY).toISOString();
    const results: PropertyRetention[] = [];

    for (const property of await store.listProperties(org.id)) {
      const receipts = (await store.listReceipts(property.id)).sort((a, b) => a.seq - b.seq);
      const prior = property.retentionCheckpoint ?? null;
      // Oldest-first prefix past the cutoff. Stops at the first receipt still in retention, so the
      // remaining chain stays contiguous even if timestamps are slightly out of order.
      const live = receipts.filter((r) => !prior || r.seq > prior.seq);
      let n = 0;
      while (n < live.length && live[n].timestamp < cutoff) n += 1;
      const r: PropertyRetention = {
        propertyId: property.id,
        domain: property.domain,
        cutoff,
        receiptsExpired: n,
        receiptsRemoved: 0,
        checkpoint: prior,
        leaksRemoved: 0,
        deliveriesRemoved: 0,
      };

      if (!verifyChain(receipts, prior).ok) {
        r.skipped = "chain-broken";
        totals.propertiesSkipped += 1;
      } else if (n > 0 || (prior && receipts.some((x) => x.seq <= prior.seq))) {
        const last = n > 0 ? live[n - 1] : null;
        const checkpoint: RetentionCheckpoint | null = last
          ? { seq: last.seq, hash: last.hash, removedThrough: last.timestamp, removedCount: (prior?.removedCount ?? 0) + n, at: now.toISOString() }
          : prior;
        r.checkpoint = checkpoint;
        if (!dryRun && checkpoint) {
          // Checkpoint first, then delete: an interruption between the two still verifies.
          if (last) await store.updateProperty(property.id, { retentionCheckpoint: checkpoint });
          r.receiptsRemoved = await store.deleteReceiptsThrough(property.id, checkpoint.seq);
        } else {
          r.receiptsRemoved = n;
        }
      }

      if (dryRun) {
        r.leaksRemoved = (await store.listLeaks(property.id, "0000")).filter((l) => l.createdAt < leakCutoff).length;
        r.deliveriesRemoved = (await store.listWebhookDeliveries(property.id, 100_000)).filter((d) => d.createdAt < deliveryCutoff).length;
      } else {
        r.leaksRemoved = await store.pruneLeaks(property.id, leakCutoff);
        r.deliveriesRemoved = await store.pruneWebhookDeliveries(property.id, deliveryCutoff);
      }
      totals.receiptsRemoved += r.receiptsRemoved;
      totals.leaksRemoved += r.leaksRemoved;
      totals.deliveriesRemoved += r.deliveriesRemoved;
      results.push(r);
    }

    if (!dryRun) {
      const removed = results.reduce((a, p) => a + p.receiptsRemoved, 0);
      await store.appendAudit({
        orgId: org.id,
        actorUserId: null,
        actorEmail: "system:retention",
        action: "retention.run",
        target: { type: "org", id: org.id, label: org.name },
        metadata: {
          logRetentionDays: plan.logRetentionDays,
          receiptsRemoved: removed,
          leaksRemoved: results.reduce((a, p) => a + p.leaksRemoved, 0),
          deliveriesRemoved: results.reduce((a, p) => a + p.deliveriesRemoved, 0),
          propertiesSkipped: results.filter((p) => p.skipped).length,
        },
        ipHash: "system",
        userAgent: "system",
      });
      await store.updateOrg(org.id, { retentionLastRunAt: now.toISOString() });
    }
    orgs.push({ orgId: org.id, name: org.name, plan: plan.id, logRetentionDays: plan.logRetentionDays, properties: results });
  }

  return { dryRun, startedAt, finishedAt: new Date().toISOString(), orgs, totals };
}
