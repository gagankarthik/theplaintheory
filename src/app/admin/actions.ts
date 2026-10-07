"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { PLATFORM_ROLE_INFO, PLATFORM_ROLES, staffChangeProblem, type PlatformRole, type StaffChange } from "@/lib/auth/platform";
import { isCognito, providerSignOutEverywhere } from "@/lib/auth/provider";
import { requireStaffAction, revokeStaffSessions } from "@/lib/auth/staff";
import { LEAD_STATUSES, STATUS_LABEL, TOPIC_LABEL, leadReference } from "@/lib/lead-options";
import { recordPlatformAudit } from "@/lib/platform/audit";
import type { PlatformAuditAction } from "@/lib/platform/types";
import { PLANS, planById } from "@/lib/plans";
import { planChange } from "@/lib/retention-grace";
import { getStore } from "@/lib/store";
import { emailSchema } from "@/lib/validation";
import type { PlanId } from "@/lib/types";

/**
 * Staff console mutations. Every one re-checks the caller's platform permission on the server, writes
 * the platform audit trail before reporting success, and returns an ActionResult for the form.
 */

/** The platform audit actor: the signed-in staff-pool identity. */
const actorOf = (ctx: Awaited<ReturnType<typeof requireStaffAction>>) => ({ sub: ctx.staff.sub, email: ctx.staff.email, role: ctx.role });
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
    // A drop to shorter retention keeps the old window for 30 days, as it does for a Stripe downgrade.
    const change = planChange(org, parsed.data.plan);
    await store.updateOrg(org.id, { plan: parsed.data.plan, ...change.patch });
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: "org.plan_changed",
      target: { type: "org", id: org.id, label: org.name },
      metadata: { from, to: parsed.data.plan, note: parsed.data.note || null, stripeSubscription: Boolean(org.stripeSubscriptionId) },
    });
    // The customer's own audit trail shows the change too, attributed to Plain Theory staff.
    await recordAudit({ orgId: org.id, actor: { system: "plain-theory-staff" }, action: "billing.plan_changed", target: { type: "org", id: org.id, label: org.name }, metadata: { from, to: parsed.data.plan, by: ctx.staff.email } });
    const g = change.graceStarted;
    if (g) {
      await recordAudit({
        orgId: org.id,
        actor: { system: "plain-theory-staff" },
        action: "retention.grace_started",
        target: { type: "org", id: org.id, label: org.name },
        metadata: { from, to: parsed.data.plan, fromPlan: g.fromPlan, logRetentionDays: g.logRetentionDays, until: g.until, by: ctx.staff.email },
      });
    }
    return done(
      `${org.name} moved from ${planById(from).name} to ${planById(parsed.data.plan).name}.` +
        (g ? ` Their ${planById(g.fromPlan).name} records stay until ${g.until.slice(0, 10)}.` : ""),
    );
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

const legalHoldSchema = z.object({
  orgId: idSchema("organization"),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters.").optional(),
});

/**
 * Legal hold: while it's set, the retention job deletes nothing for this organization (consent
 * receipts, leak reports, webhook logs). Superadmins only. Recorded in both audit trails.
 */
export async function setLegalHold(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("orgs:legal_hold");
    const parsed = legalHoldSchema.safeParse({ orgId: form.get("orgId"), reason: form.get("reason") || undefined });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const org = await store.getOrg(parsed.data.orgId);
    if (!org) return { error: "That organization no longer exists." };
    if (org.legalHold) return { error: `${org.name} is already under legal hold.` };
    const reason = parsed.data.reason || undefined;
    const hold = { since: new Date().toISOString(), by: ctx.staff.email, ...(reason ? { reason } : {}) };
    await store.updateOrg(org.id, { legalHold: hold });
    const target = { type: "org" as const, id: org.id, label: org.name };
    await recordPlatformAudit({ actor: actorOf(ctx), action: "org.legal_hold_set", target, metadata: { reason: reason ?? null } });
    await recordAudit({ orgId: org.id, actor: { system: "plain-theory-staff" }, action: "retention.legal_hold_set", target, metadata: { by: ctx.staff.email, reason: reason ?? null } });
    return done(`${org.name} is under legal hold. Retention deletes nothing until it's lifted.`);
  } catch (e) {
    return failure(e);
  }
}

export async function clearLegalHold(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("orgs:legal_hold");
    const parsed = unsuspendSchema.safeParse({ orgId: form.get("orgId") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const org = await store.getOrg(parsed.data.orgId);
    if (!org) return { error: "That organization no longer exists." };
    if (!org.legalHold) return { error: `${org.name} isn't under legal hold.` };
    await store.updateOrg(org.id, { legalHold: undefined });
    const target = { type: "org" as const, id: org.id, label: org.name };
    const meta = { since: org.legalHold.since, placedBy: org.legalHold.by, reason: org.legalHold.reason ?? null };
    await recordPlatformAudit({ actor: actorOf(ctx), action: "org.legal_hold_cleared", target, metadata: meta });
    await recordAudit({ orgId: org.id, actor: { system: "plain-theory-staff" }, action: "retention.legal_hold_cleared", target, metadata: { ...meta, by: ctx.staff.email } });
    return done(`Legal hold lifted. The next retention run applies ${org.name}'s normal retention.`);
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
    // Customer sessions only: staff console sessions live under "staff:<sub>" and aren't touched.
    const n = await store.revokeUserSessions(user.id, new Date().toISOString());
    // With Cognito, revoke its refresh tokens for the user as well.
    const providerNote = await providerSignOutEverywhere(user.email);
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: "user.sessions_revoked",
      target: { type: "user", id: user.id, label: user.email },
      metadata: { revoked: n, cognitoSignOut: isCognito() ? (providerNote ? "failed" : "ok") : "skipped" },
    });
    return done(
      (n === 0 ? `${user.email} had no active sessions.` : `Signed ${user.email} out of ${n} session${n === 1 ? "" : "s"}.`) + providerNote,
    );
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- contact requests ---------------- */

const leadStatusSchema = z.object({
  leadId: z.string().trim().regex(/^lead_[A-Za-z0-9_-]{4,40}$/, "Missing request."),
  status: z.enum(LEAD_STATUSES, "Pick a status."),
});

export async function setLeadStatus(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("leads:manage");
    const parsed = leadStatusSchema.safeParse({ leadId: form.get("leadId"), status: form.get("status") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const lead = await store.getLead(parsed.data.leadId);
    if (!lead) return { error: "That request no longer exists." };
    const from = lead.status ?? "new";
    const to = parsed.data.status;
    if (from === to) return { error: `This request is already ${STATUS_LABEL[to].toLowerCase()}.` };
    const updated = await store.updateLeadStatus(lead.id, to);
    if (!updated) return { error: "That request no longer exists." };
    const topic = lead.topic ?? "sales";
    // The label names the request, not the person: the audit trail doesn't need the sender's details.
    await recordPlatformAudit({
      actor: actorOf(ctx),
      action: "lead.status_changed",
      target: { type: "lead", id: lead.id, label: `${TOPIC_LABEL[topic]} request ${leadReference(lead.id)}` },
      metadata: { from, to, topic },
    });
    return done(`${leadReference(lead.id)} is now ${STATUS_LABEL[to].toLowerCase()}.`);
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- staff (the staff Cognito pool) ---------------- */

type StaffCtx = Awaited<ReturnType<typeof requireStaffAction>>;

const roleSchema = z.enum(PLATFORM_ROLES as [PlatformRole, ...PlatformRole[]], "Pick a staff role.");
const subSchema = z.object({ sub: z.string().trim().regex(/^[0-9a-f-]{36}$/i, "Missing staff member.") });

/**
 * Load the staff list from the pool and check the change against the guards (not yourself, never the
 * last superadmin). The list is read fresh for every change so the guards see the current state.
 */
async function staffTarget(ctx: StaffCtx, sub: string, change: StaffChange) {
  const { listStaffAccounts } = await import("@/lib/auth/staff-cognito");
  const staff = await listStaffAccounts();
  const target = staff.find((s) => s.sub === sub) ?? null;
  const problem = staffChangeProblem({ actorSub: ctx.staff.sub, target, change, staff });
  return problem || !target ? { ok: false as const, error: problem ?? "That person isn't on the staff list." } : { ok: true as const, target };
}

function staffAudit(ctx: StaffCtx, action: PlatformAuditAction, t: { sub: string; email: string }, metadata?: Record<string, string | number | boolean | null>) {
  return recordPlatformAudit({ actor: actorOf(ctx), action, target: { type: "staff", id: t.sub, label: t.email }, metadata });
}

const inviteSchema = z.object({
  email: emailSchema("Enter their work email, like name@theplaintheory.in."),
  name: z.string().trim().min(2, "Enter their full name.").max(100, "Keep the name under 100 characters."),
  role: roleSchema,
});

/** Invite someone: Cognito e-mails them a temporary password; they choose a password and set up an authenticator at /admin/login. */
export async function inviteStaffMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = inviteSchema.safeParse({ email: String(form.get("email") ?? ""), name: String(form.get("name") ?? ""), role: form.get("role") });
    if (!parsed.success) return invalid(parsed.error);
    const { inviteStaff } = await import("@/lib/auth/staff-cognito");
    const email = parsed.data.email.toLowerCase();
    const r = await inviteStaff({ email, name: parsed.data.name, role: parsed.data.role });
    if (!r.ok) return { error: r.error, ...(/already has/.test(r.error) ? { fieldErrors: { email: [r.error] } } : {}) };
    await staffAudit(ctx, "staff.invited", { sub: r.sub, email }, { role: parsed.data.role });
    return done(`Invited ${email} as ${PLATFORM_ROLE_INFO[parsed.data.role].label}. Cognito has emailed them a temporary password, valid for 1 day.`);
  } catch (e) {
    return failure(e);
  }
}

export async function changeStaffRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = subSchema.extend({ role: roleSchema }).safeParse({ sub: form.get("sub"), role: form.get("role") });
    if (!parsed.success) return invalid(parsed.error);
    const t = await staffTarget(ctx, parsed.data.sub, { kind: "role", next: parsed.data.role });
    if (!t.ok) return { error: t.error };
    const { setStaffRole } = await import("@/lib/auth/staff-cognito");
    const r = await setStaffRole(t.target.username, t.target.role, parsed.data.role);
    if (!r.ok) return { error: r.error };
    // The role is read at sign-in, so end their console sessions: the new role applies when they sign back in.
    const ended = await revokeStaffSessions(t.target.sub);
    await staffAudit(ctx, "staff.role_changed", t.target, { from: t.target.role, to: parsed.data.role, sessionsEnded: ended });
    return done(`${t.target.email} is now ${PLATFORM_ROLE_INFO[parsed.data.role].label}.${ended ? " They were signed out and get the new role when they sign back in." : ""}`);
  } catch (e) {
    return failure(e);
  }
}

export async function resendStaffInvite(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = subSchema.safeParse({ sub: form.get("sub") });
    if (!parsed.success) return invalid(parsed.error);
    const t = await staffTarget(ctx, parsed.data.sub, { kind: "resend_invite" });
    if (!t.ok) return { error: t.error };
    if (t.target.status !== "FORCE_CHANGE_PASSWORD") return { error: `${t.target.email} has already signed in. Use Reset password instead.` };
    const cognito = await import("@/lib/auth/staff-cognito");
    const r = await cognito.resendStaffInvite(t.target.username);
    if (!r.ok) return { error: r.error };
    await staffAudit(ctx, "staff.invite_resent", t.target);
    return done(`Sent ${t.target.email} a new temporary password, valid for 1 day.`);
  } catch (e) {
    return failure(e);
  }
}

export async function resetStaffPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = subSchema.safeParse({ sub: form.get("sub") });
    if (!parsed.success) return invalid(parsed.error);
    const t = await staffTarget(ctx, parsed.data.sub, { kind: "reset_password" });
    if (!t.ok) return { error: t.error };
    if (!t.target.enabled) return { error: `Enable ${t.target.email} first, then reset their password.` };
    const cognito = await import("@/lib/auth/staff-cognito");
    const r = await cognito.resetStaffPassword(t.target.username);
    if (!r.ok) return { error: r.error };
    const ended = await revokeStaffSessions(t.target.sub);
    await staffAudit(ctx, "staff.password_reset", t.target, { sessionsEnded: ended });
    return done(`${t.target.email} was signed out and emailed a temporary password. Their authenticator app stays set up.`);
  } catch (e) {
    return failure(e);
  }
}

export async function setStaffEnabled(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = subSchema.extend({ enabled: z.enum(["true", "false"]) }).safeParse({ sub: form.get("sub"), enabled: form.get("enabled") });
    if (!parsed.success) return invalid(parsed.error);
    const enable = parsed.data.enabled === "true";
    const t = await staffTarget(ctx, parsed.data.sub, { kind: enable ? "enable" : "disable" });
    if (!t.ok) return { error: t.error };
    const cognito = await import("@/lib/auth/staff-cognito");
    const r = await cognito.setStaffEnabled(t.target.username, enable);
    if (!r.ok) return { error: r.error };
    const ended = enable ? 0 : await revokeStaffSessions(t.target.sub);
    await staffAudit(ctx, enable ? "staff.enabled" : "staff.disabled", t.target, enable ? undefined : { sessionsEnded: ended });
    return done(enable ? `${t.target.email} can sign in to the console again.` : `${t.target.email} is disabled and was signed out of the console.`);
  } catch (e) {
    return failure(e);
  }
}

export async function removeStaffMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireStaffAction("staff:manage");
    const parsed = subSchema.safeParse({ sub: form.get("sub") });
    if (!parsed.success) return invalid(parsed.error);
    const t = await staffTarget(ctx, parsed.data.sub, { kind: "remove" });
    if (!t.ok) return { error: t.error };
    const cognito = await import("@/lib/auth/staff-cognito");
    await cognito.staffGlobalSignOut(t.target.username);
    const r = await cognito.deleteStaff(t.target.username);
    if (!r.ok) return { error: r.error };
    const ended = await revokeStaffSessions(t.target.sub);
    await staffAudit(ctx, "staff.removed", t.target, { role: t.target.role, sessionsEnded: ended });
    return done(`${t.target.email} no longer has a staff account.`);
  } catch (e) {
    return failure(e);
  }
}
