import { chainCheckRecord, fullCheckFrom, incrementalCheckFrom, ledgerPages, verifyLedger } from "./ledger";
import { planById } from "./plans";
import { activeGrace, effectiveRetentionDays } from "./retention-grace";
import type { Store } from "./store/types";
import type { ConsentReceipt, RetentionCheckpoint } from "./types";

/**
 * Data retention and disposal (SOC 2 C1.2, P4.2; DPDP Rule 8). Run daily.
 *
 * - Consent receipts older than the effective retention are removed oldest-first. The effective
 *   retention is the longer of the plan's logRetentionDays and an unexpired retention grace (after a
 *   cancellation or downgrade the old plan's window holds for 30 days; src/lib/retention-grace.ts).
 *   The first run after a grace ends records retention.grace_expired, then applies the new plan. A checkpoint
 *   (last removed seq and hash) is written to the property first, so the remaining chain still
 *   verifies from it, and the Evidence Pack reports what was removed.
 * - Leak reports older than 90 days and webhook delivery logs older than 30 days are removed.
 * - The administrative audit trail is never removed here; it is kept for at least a year.
 * - An organization under legal hold has nothing removed at all; the run is still recorded.
 *
 * Receipts are only removed when the chain verifies first: a broken chain is evidence of tampering,
 * so it is reported and left untouched.
 *
 * Built to finish at any size: nothing reads a whole ledger. Each night verifies only the receipts
 * added since the last verified head (a full check, streamed from the retention checkpoint, runs on
 * Sundays), and expiry reads only the expired prefix, a page at a time. Organizations run least
 * recently processed first within a time budget; whatever doesn't fit is first in line next run.
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
  /** chain was broken before the run, or the organization is under legal hold; nothing was removed */
  skipped?: "chain-broken" | "legal-hold";
}

export interface RetentionReport {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  orgs: {
    orgId: string;
    name: string;
    plan: string;
    /** effective retention applied: the plan's, or a longer unexpired grace */
    logRetentionDays: number;
    /** the retention grace in force for this run, if any */
    grace: { until: string; fromPlan: string; logRetentionDays: number } | null;
    /** under legal hold: nothing was removed */
    legalHold: boolean;
    properties: PropertyRetention[];
  }[];
  totals: { receiptsRemoved: number; leaksRemoved: number; deliveriesRemoved: number; propertiesSkipped: number };
  /** organizations left for the next run because the time budget ran out */
  remaining: number;
}

/** Leave room under the platform's function limit (300 s) to write the report. */
export const RETENTION_BUDGET_MS = 240_000;

export async function runRetention(store: Store, opts: { dryRun?: boolean; now?: Date; budgetMs?: number } = {}): Promise<RetentionReport> {
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now ?? new Date();
  const startedAt = new Date().toISOString();
  const began = Date.now();
  const budget = opts.budgetMs ?? RETENTION_BUDGET_MS;
  const totals = { receiptsRemoved: 0, leaksRemoved: 0, deliveriesRemoved: 0, propertiesSkipped: 0 };
  const orgs: RetentionReport["orgs"] = [];
  // Weekly, a full streamed verification; other nights only what was added since the last check.
  const fullCheck = now.getUTCDay() === 0;

  // Least recently processed first (never-run first), so a run cut short by the budget resumes fairly.
  const queue = (await store.listOrgs()).sort((a, b) => (a.retentionLastRunAt ?? "").localeCompare(b.retentionLastRunAt ?? ""));
  let remaining = 0;
  for (const [i, org] of queue.entries()) {
    if (Date.now() - began > budget) {
      remaining = queue.length - i;
      console.warn(`[retention] time budget reached; ${remaining} organization(s) left for the next run`);
      break;
    }
    const plan = planById(org.plan);
    const grace = activeGrace(org, now);
    const logRetentionDays = effectiveRetentionDays(org, now);
    const legalHold = Boolean(org.legalHold);
    const cutoff = new Date(now.getTime() - logRetentionDays * DAY).toISOString();
    const leakCutoff = new Date(now.getTime() - LEAK_RETENTION_DAYS * DAY).toISOString();
    const deliveryCutoff = new Date(now.getTime() - DELIVERY_RETENTION_DAYS * DAY).toISOString();
    const results: PropertyRetention[] = [];

    // A grace that has ended: record it once, then this run applies the current plan's retention.
    if (org.retentionGrace && !grace && !dryRun) {
      await store.appendAudit({
        orgId: org.id,
        actorUserId: null,
        actorEmail: "system:retention",
        action: "retention.grace_expired",
        target: { type: "org", id: org.id, label: org.name },
        metadata: {
          fromPlan: org.retentionGrace.fromPlan,
          graceLogRetentionDays: org.retentionGrace.logRetentionDays,
          until: org.retentionGrace.until,
          plan: plan.id,
          logRetentionDays,
          legalHold,
        },
        ipHash: "system",
        userAgent: "system",
      });
      await store.updateOrg(org.id, { retentionGrace: undefined });
    }

    for (const property of await store.listProperties(org.id)) {
      const prior = property.retentionCheckpoint ?? null;

      // The nightly check doubles as the site's "last verified" result (Security page, consent log).
      const check = legalHold ? null : await verifyLedger(store, property.id, fullCheck ? fullCheckFrom(property) : incrementalCheckFrom(property));
      if (check && !dryRun) await store.updateProperty(property.id, { lastChainCheck: chainCheckRecord(property, check, now.toISOString()) });

      // Oldest-first prefix past the cutoff, read a page at a time. Stops at the first receipt still in
      // retention, so the remaining chain stays contiguous even if timestamps are slightly out of order.
      let n = 0;
      let last: ConsentReceipt | null = null;
      if (check?.ok) {
        expiry: for await (const page of ledgerPages(store, property.id, prior?.seq ?? 0)) {
          for (const x of page) {
            if (x.timestamp >= cutoff) break expiry;
            n += 1;
            last = x;
          }
        }
      }
      // An earlier run interrupted between checkpoint and delete leaves receipts at or below it.
      const leftover = Boolean(prior && check?.ok && (await store.pageReceipts(property.id, 0, 1))[0]?.seq <= prior.seq);
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

      if (legalHold) {
        // Legal hold: keep everything, including leak reports and webhook logs below.
        r.skipped = "legal-hold";
      } else if (!check!.ok) {
        r.skipped = "chain-broken";
        totals.propertiesSkipped += 1;
      } else if (n > 0 || leftover) {
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

      if (legalHold) {
        // nothing removed
      } else if (dryRun) {
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
          logRetentionDays,
          planLogRetentionDays: plan.logRetentionDays,
          graceUntil: grace?.until ?? null,
          legalHold,
          receiptsRemoved: removed,
          leaksRemoved: results.reduce((a, p) => a + p.leaksRemoved, 0),
          deliveriesRemoved: results.reduce((a, p) => a + p.deliveriesRemoved, 0),
          propertiesSkipped: results.filter((p) => p.skipped === "chain-broken").length,
        },
        ipHash: "system",
        userAgent: "system",
      });
      await store.updateOrg(org.id, { retentionLastRunAt: now.toISOString() });
    }
    orgs.push({
      orgId: org.id,
      name: org.name,
      plan: plan.id,
      logRetentionDays,
      grace: grace ? { until: grace.until, fromPlan: grace.fromPlan, logRetentionDays: grace.logRetentionDays } : null,
      legalHold,
      properties: results,
    });
  }

  return { dryRun, startedAt, finishedAt: new Date().toISOString(), orgs, totals, remaining };
}
