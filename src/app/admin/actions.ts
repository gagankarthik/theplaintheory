"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { PLATFORM_ROLE_INFO, PLATFORM_ROLES, staffChangeProblem } from "@/lib/auth/platform";
import { requireStaffAction } from "@/lib/auth/staff";
import { recordPlatformAudit } from "@/lib/platform/audit";
import { loadStaff } from "@/lib/platform/data";
import { PLANS, planById } from "@/lib/plans";
import { getStore } from "@/lib/store";
import { emailSchema } from "@/lib/validation";
import type { PlanId } from "@/lib/types";

/**
 * Staff console mutations. Every one re-checks the caller's platform permission on the server, writes
 * the platform audit trail before reporting success, and returns an ActionResult for the form.
 */

const actorOf = (ctx: Awaited<ReturnType<typeof requireStaffAction>>) => ({ userId: ctx.user.id, email: ctx.user.email, role: ctx.role });
const idSchema = (what: string) => z.string().trim().min(1, `Missing ${what}.`).max(64);
const reasonSchema = z.string().trim().min(5, "Give a reason of at least 5 characters. It's shown to the customer's members.").max(300, "Keep the reason under 300 characters.");

const done = (msg: string): ActionResult => {
  revalidatePath("/admin", "layout");
  return { ok: msg };
};

/* ---------------- organizations ---------------- */

const planSchema = z.object({
  orgId: idSchema("organization"),
  plan: z.enum(PLANS.map((p) => p.id) as [PlanId, ...PlanId[]], "Pick a plan."),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
});

export async function changeOrgPlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("orgs:plan");
    const parsed = planSchema.safeParse({ orgId: form.get("orgId"), plan: form.get("plan"), note: form.get("note") ?? undefined });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const org = await store.getOrg(parsed.data.orgId);
    if (!org) return { error: "That organization no longer exists." };
    if (org.plan === parsed.data.plan) return { error: `${org.name} is already on ${planById(org.plan).name}.`, fieldErrors: { plan: ["Pick a different plan."] } };
    const from = org.plan;
    await store.updateOrg(org.id, { plan: parsed.data.plan });
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: "org.plan_changed",
      target: { type: "org", id: org.id, label: org.name },
      metadata: { from, to: parsed.data.plan, note: parsed.data.note || null, stripeSubscription: Boolean(org.stripeSubscriptionId) },
    });
    // The customer's own audit trail shows the change too, attributed to Plain Theory staff.
    await recordAudit({ orgId: org.id, actor: { system: "plain-theory-staff" }, action: "billing.plan_changed", target: { type: "org", id: org.id, label: org.name }, metadata: { from, to: parsed.data.plan, by: ctx.user.email } });
    return done(`${org.name} moved from ${planById(from).name} to ${planById(parsed.data.plan).name}.`);
  } catch (e) {
    return failure(e);
  }
}

const suspendSchema = z.object({ orgId: idSchema("organization"), reason: reasonSchema });

export async function suspendOrg(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("orgs:suspend");
    const parsed = suspendSchema.safeParse({ orgId: form.get("orgId"), reason: form.get("reason") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const org = await store.getOrg(parsed.data.orgId);
    if (!org) return { error: "That organization no longer exists." };
    if (org.suspendedAt) return { error: `${org.name} is already suspended.` };
    await store.updateOrg(org.id, { suspendedAt: new Date().toISOString(), suspendedReason: parsed.data.reason });
    await recordPlatformAudit({ actor: actorOf(ctx), action: "org.suspended", target: { type: "org", id: org.id, label: org.name }, metadata: { reason: parsed.data.reason } });
    return done(`${org.name} is suspended. Members now see the suspension notice.`);
  } catch (e) {
    return failure(e);
  }
}

const unsuspendSchema = z.object({ orgId: idSchema("organization") });

export async function unsuspendOrg(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("orgs:suspend");
    const parsed = unsuspendSchema.safeParse({ orgId: form.get("orgId") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const org = await store.getOrg(parsed.data.orgId);
    if (!org) return { error: "That organization no longer exists." };
    if (!org.suspendedAt) return { error: `${org.name} isn't suspended.` };
    await store.updateOrg(org.id, { suspendedAt: undefined, suspendedReason: undefined });
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: "org.unsuspended",
      target: { type: "org", id: org.id, label: org.name },
      metadata: { suspendedAt: org.suspendedAt, reason: org.suspendedReason ?? null },
    });
    return done(`Suspension lifted. ${org.name} can use the dashboard again.`);
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- users ---------------- */

const userSchema = z.object({ userId: idSchema("user") });

export async function unlockUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("users:unlock");
    const parsed = userSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const user = await store.getUser(parsed.data.userId);
    if (!user) return { error: "That user no longer exists." };
    if (!user.lockedUntil && !user.loginFailures) return { error: `${user.email} isn't locked and has no failed sign-ins to clear.` };
    await store.updateUser(user.id, { lockedUntil: undefined, loginFailures: undefined });
    await recordPlatformAudit({ actor: actorOf(ctx), action: "user.unlocked", target: { type: "user", id: user.id, label: user.email }, metadata: { lockedUntil: user.lockedUntil ?? null } });
    return done(`${user.email} can sign in again.`);
  } catch (e) {
    return failure(e);
  }
}

export async function revokeAllSessions(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("users:revoke_sessions");
    const parsed = userSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const user = await store.getUser(parsed.data.userId);
    if (!user) return { error: "That user no longer exists." };
    // Revoking your own sessions keeps this browser signed in.
    const self = user.id === ctx.user.id;
    const n = await store.revokeUserSessions(user.id, new Date().toISOString(), self ? ctx.session.sid : undefined);
    await recordPlatformAudit({ actor: actorOf(ctx), action: "user.sessions_revoked", target: { type: "user", id: user.id, label: user.email }, metadata: { revoked: n, keptCurrent: self } });
    return done(n === 0 ? `${user.email} had no active sessions.` : `Signed ${user.email} out of ${n} session${n === 1 ? "" : "s"}${self ? " (this browser stays signed in)" : ""}.`);
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- staff ---------------- */

const grantSchema = z.object({
  email: emailSchema("Enter their email, like name@theplaintheory.com."),
  role: z.enum(["superadmin", "support", "analyst"] satisfies typeof PLATFORM_ROLES, "Pick a staff role."),
});

export async function grantStaffRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = grantSchema.safeParse({ email: String(form.get("email") ?? ""), role: form.get("role") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const email = parsed.data.email.toLowerCase();
    const user = await store.getUserByEmail(email);
    if (!user) return { error: `No account uses ${email}. They need to sign up first.`, fieldErrors: { email: ["No account uses this email yet."] } };
    const staff = await loadStaff();
    const current = staff.find((s) => s.userId === user.id) ?? null;
    const problem = staffChangeProblem({ actorUserId: ctx.user.id, target: current, next: parsed.data.role, staff });
    if (problem) return { error: problem };
    await store.updateUser(user.id, { platformRole: parsed.data.role });
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: current ? "staff.role_changed" : "staff.granted",
      target: { type: "user", id: user.id, label: user.email },
      metadata: { from: current?.role ?? null, to: parsed.data.role },
    });
    const label = PLATFORM_ROLE_INFO[parsed.data.role].label;
    return done(current ? `${user.email} is now ${label}.` : `${user.email} joined the staff as ${label}.`);
  } catch (e) {
    return failure(e);
  }
}

export async function revokeStaffRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = userSchema.safeParse({ userId: form.get("userId") });
    if (!parsed.success) return invalid(parsed.error);
    const staff = await loadStaff();
    const target = staff.find((s) => s.userId === parsed.data.userId) ?? null;
    const problem = staffChangeProblem({ actorUserId: ctx.user.id, target, next: null, staff });
    if (problem) return { error: problem };
    const store = await getStore();
    await store.updateUser(target!.userId, { platformRole: undefined });
    // Their open console sessions lose access on the next request: the role is read from the store each time.
    await recordPlatformAudit({ actor: actorOf(ctx), action: "staff.revoked", target: { type: "user", id: target!.userId, label: target!.email }, metadata: { from: target!.role } });
    return done(`${target!.email} no longer has staff access.`);
  } catch (e) {
    return failure(e);
  }
}
