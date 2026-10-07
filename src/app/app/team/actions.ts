"use server";

import { addedToOrgEmail, inviteEmail } from "@/lib/mail";
import { absoluteUrl } from "@/lib/site";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { INVITE_ROLES, ROLE_LABEL, assertCan, isRole, memberChangeProblem } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { id } from "@/lib/crypto";
import { planById } from "@/lib/plans";
import { getStore } from "@/lib/store";
import { emailSchema } from "@/lib/validation";
import type { AuditAction, Organization, Role, User } from "@/lib/types";

const auditTeam = (org: Organization, actor: User, action: AuditAction, target: { id: string; label: string; type?: string }, metadata?: Record<string, string>) =>
  recordAudit({ orgId: org.id, actor: { userId: actor.id, email: actor.email }, action, target: { type: target.type ?? "user", id: target.id, label: target.label }, metadata });

const inviteSchema = z.object({
  email: emailSchema("Enter their email, like name@company.com."),
  role: z.enum(INVITE_ROLES, "Pick admin, editor, auditor or viewer."),
});

export async function inviteMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "team:manage");
    const parsed = inviteSchema.safeParse({ email: String(form.get("email") ?? ""), role: form.get("role") });
    if (!parsed.success) return invalid(parsed.error);
    const email = parsed.data.email.toLowerCase();
    const store = await getStore();
    const [members, invites] = await Promise.all([store.listMembers(org.id), store.listInvites(org.id)]);
    const plan = planById(org.plan);
    if (plan.seats !== null && members.length + invites.length >= plan.seats) {
      return { error: `The ${plan.name} plan includes ${plan.seats} seat${plan.seats > 1 ? "s" : ""}. Upgrade in Billing to invite more people.` };
    }
    if (members.some((m) => m.user?.email === email)) return { error: `${email} is already a member.`, fieldErrors: { email: [`${email} is already a member.`] } };
    if (invites.some((i) => i.email === email)) return { error: `${email} already has a pending invite.`, fieldErrors: { email: [`${email} already has a pending invite.`] } };

    const existing = await store.getUserByEmail(email);
    if (existing) {
      await store.addMember({ orgId: org.id, userId: existing.id, role: parsed.data.role, invitedBy: user.email, createdAt: new Date().toISOString() });
      await auditTeam(org, user, "member.invited", { id: existing.id, label: email }, { role: parsed.data.role, existingAccount: "yes" });
      const mail = await addedToOrgEmail(email, org.name, user.name || user.email, parsed.data.role);
      revalidatePath("/app/team");
      return { ok: `${email} already had an account and now has ${parsed.data.role} access.${mail.sent ? " We've emailed them." : ""}` };
    }
    const inviteId = id("inv");
    await store.createInvite({ id: inviteId, orgId: org.id, email, role: parsed.data.role, invitedBy: user.email, createdAt: new Date().toISOString() });
    await auditTeam(org, user, "member.invited", { id: inviteId, label: email, type: "invite" }, { role: parsed.data.role });
    const link = absoluteUrl(`/signup?email=${encodeURIComponent(email)}`);
    const mail = await inviteEmail(email, org.name, user.name || user.email, parsed.data.role, link);
    revalidatePath("/app/team");
    return {
      ok: mail.sent
        ? `Invite emailed to ${email}. They join as ${parsed.data.role} when they create their account.`
        : `Invite saved, but we couldn't email it yet. Send ${email} this link: ${link}. They join as ${parsed.data.role} when they sign up with that address.`,
    };
  } catch (e) {
    return failure(e);
  }
}

export async function changeRole(userId: string, newRole: Role): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "team:manage");
    if (!isRole(newRole)) return { error: "Unknown role." };
    if (userId === user.id) return { error: "You can't change your own role. Ask another owner." };
    const store = await getStore();
    const target = await store.getMembership(org.id, userId);
    if (!target) return { error: "That person is no longer a member." };
    const problem = memberChangeProblem({ actorRole: role, actorUserId: user.id, targetUserId: userId, targetRole: target.role, next: newRole });
    if (problem) return { error: problem };
    await store.setRole(org.id, userId, newRole);
    const subject = await store.getUser(userId);
    await auditTeam(org, user, "member.role_changed", { id: userId, label: subject?.email ?? userId }, { from: target.role, to: newRole });
    revalidatePath("/app/team");
    return { ok: `Role changed to ${ROLE_LABEL[newRole].toLowerCase()}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function removeMember(userId: string): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "team:manage");
    if (userId === user.id) return { error: "You can't remove yourself." };
    const store = await getStore();
    const target = await store.getMembership(org.id, userId);
    if (!target) return { error: "That person is no longer a member." };
    const problem = memberChangeProblem({ actorRole: role, actorUserId: user.id, targetUserId: userId, targetRole: target.role, next: null });
    if (problem) return { error: problem };
    const subject = await store.getUser(userId);
    await store.removeMember(org.id, userId);
    await auditTeam(org, user, "member.removed", { id: userId, label: subject?.email ?? userId }, { role: target.role });
    revalidatePath("/app/team");
    return { ok: "Member removed." };
  } catch (e) {
    return failure(e);
  }
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "team:manage");
    const store = await getStore();
    const invite = (await store.listInvites(org.id)).find((i) => i.id === inviteId);
    if (!invite) return { error: "That invite no longer exists." };
    await store.deleteInvite(org.id, inviteId);
    await auditTeam(org, user, "member.invite_revoked", { id: inviteId, label: invite.email, type: "invite" }, { role: invite.role });
    revalidatePath("/app/team");
    return { ok: "Invite revoked." };
  } catch (e) {
    return failure(e);
  }
}
