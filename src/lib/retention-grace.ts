import { planById, type Plan } from "./plans";
import type { Organization, PlanId } from "./types";

/**
 * Retention grace after a cancellation or downgrade.
 *
 * Our pledge (pricing page and FAQ): after you cancel or move to a plan that keeps consent receipts
 * for less time, you keep read and export access to your records for 30 days. So a plan drop never
 * shortens retention straight away. The organization gets `retentionGrace`, the retention job keeps
 * the old plan's window until it ends, and the old plan's export features (the Evidence Pack) stay
 * open. Only after the grace ends does the new plan's retention apply.
 *
 * A legal hold (staff-only) overrides all of this: while it's set, the retention job deletes nothing.
 *
 * Pure functions, no I/O, so the rules are unit-tested without a store.
 */
export const RETENTION_GRACE_DAYS = 30;

const DAY = 86_400_000;

type GraceOrg = Pick<Organization, "plan" | "retentionGrace">;

/** The grace in force at `now`, or null when there's none or it has ended. */
export function activeGrace(org: GraceOrg, now: Date = new Date()) {
  const g = org.retentionGrace;
  return g && g.until > now.toISOString() ? g : null;
}

/** Days of consent receipts the retention job keeps: the longer of the current plan and an unexpired grace. */
export function effectiveRetentionDays(org: GraceOrg, now: Date = new Date()) {
  const current = planById(org.plan).logRetentionDays;
  return Math.max(current, activeGrace(org, now)?.logRetentionDays ?? 0);
}

/**
 * The plan whose record features apply: retention and exports such as the Evidence Pack. During a
 * grace that's the plan the organization came from (when it was the higher one); otherwise the current plan.
 * Use it for gates on reading and exporting existing records, never for creating new things (seats,
 * sites, webhooks), which follow the current plan.
 */
export function effectivePlanForRecords(org: GraceOrg, now: Date = new Date()): Plan {
  const current = planById(org.plan);
  const g = activeGrace(org, now);
  if (!g) return current;
  const from = planById(g.fromPlan);
  return from.logRetentionDays > current.logRetentionDays ? from : current;
}

export interface PlanChange {
  /** fields to write with the plan, e.g. `store.updateOrg(id, { plan, ...change.patch })` */
  patch: Pick<Partial<Organization>, "retentionGrace">;
  /** a new grace started (or an existing one was extended): record retention.grace_started */
  graceStarted: NonNullable<Organization["retentionGrace"]> | null;
  /** the grace was cleared because the new plan keeps records at least as long */
  graceCleared: boolean;
}

/**
 * What a plan change does to the retention grace. Call it whenever `plan` changes (Stripe webhook,
 * staff plan change), with the organization as it is before the change.
 *
 * - Dropping to a plan with shorter retention than the current plan starts a grace of
 *   RETENTION_GRACE_DAYS that keeps the longer of the current plan's window and an unexpired grace.
 *   A second drop during a grace keeps the longest window and restarts the 30 days; a partial
 *   upgrade during a grace (Free to Starter after leaving Business) leaves the grace as it is.
 * - Moving to a plan that keeps records at least as long as the grace clears it.
 * - Anything else leaves the grace as it is.
 */
export function planChange(org: GraceOrg, next: PlanId, now: Date = new Date()): PlanChange {
  const none: PlanChange = { patch: {}, graceStarted: null, graceCleared: false };
  if (org.plan === next) return none;
  const nextDays = planById(next).logRetentionDays;
  const keptPlan = effectivePlanForRecords(org, now);
  const keptDays = effectiveRetentionDays(org, now);
  const grace = activeGrace(org, now);

  // A drop: the new plan keeps less than both the current plan and what's kept now.
  if (nextDays < planById(org.plan).logRetentionDays && nextDays < keptDays) {
    const g = { until: new Date(now.getTime() + RETENTION_GRACE_DAYS * DAY).toISOString(), logRetentionDays: keptDays, fromPlan: keptPlan.id };
    return { patch: { retentionGrace: g }, graceStarted: g, graceCleared: false };
  }
  // The new plan keeps records at least as long as the grace does: nothing left to protect. (An
  // expired grace is left for the retention job, which records that it ended and clears it.)
  if (grace && nextDays >= grace.logRetentionDays) {
    return { patch: { retentionGrace: undefined }, graceStarted: null, graceCleared: true };
  }
  return none;
}
