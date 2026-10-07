"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordUserAudit } from "@/lib/audit";
import { registerFailure } from "@/lib/auth/lockout";
import { beginEnrolment, confirmEnrolment, disableMfa, regenerateRecoveryCodes, verifySecondFactor } from "@/lib/auth/mfa";
import { isCognito, passwordProblem, providerSignOutEverywhere, setPassword } from "@/lib/auth/provider";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/crypto";
import { getStore } from "@/lib/store";
import type { User } from "@/lib/types";

/* Every action here works for members who still need to enrol in MFA. */
const me = () => requireUser({ allowWithoutMfa: true });

/** A wrong code or password here counts towards the same lockout as a failed sign-in. */
async function countFailure(user: User) {
  const next = registerFailure(user);
  await (await getStore()).updateUser(user.id, { loginFailures: next.loginFailures, lockedUntil: next.lockedUntil });
  if (next.locked) {
    await recordUserAudit(user.id, user.email, "auth.locked", { minutes: 15 });
    await destroySession();
    redirect("/login");
  }
}

const codeSchema = z.object({ code: z.string().trim().min(6, "Enter the 6-digit code from your app.").max(20) });
const MISMATCH = "That code didn't match.";

/* ---------------- two-factor ---------------- */

export type EnrolState = (ActionResult & { secret?: string; uri?: string; recoveryCodes?: string[] }) | null;

export async function startMfaEnrolment(): Promise<EnrolState> {
  try {
    const { user } = await me();
    if (user.mfa) return { error: "Two-factor is already on." };
    return await beginEnrolment(user);
  } catch (e) {
    return failure(e);
  }
}

export async function confirmMfaEnrolment(_: EnrolState, form: FormData): Promise<EnrolState> {
  try {
    const { user, session } = await me();
    const parsed = codeSchema.safeParse({ code: form.get("code") });
    if (!parsed.success) return invalid(parsed.error);
    const r = await confirmEnrolment(user, parsed.data.code.replace(/\s/g, ""));
    if (!r.ok) return { error: r.error, fieldErrors: { code: [r.error] } };
    await recordUserAudit(user.id, user.email, "auth.mfa_enabled");
    // A change in assurance level: rotate the session id.
    await createSession({ userId: user.id, email: user.email, orgId: session.orgId }, { mfaVerified: true });
    revalidatePath("/app", "layout");
    return { ok: "Two-factor is on. Save your recovery codes now; they won't be shown again.", recoveryCodes: r.recoveryCodes };
  } catch (e) {
    return failure(e);
  }
}

export async function turnOffMfa(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user, memberships } = await me();
    if (!user.mfa) return { error: "Two-factor is already off." };
    const store = await getStore();
    const orgs = await Promise.all(memberships.map((m) => store.getOrg(m.orgId)));
    const requiring = orgs.find((o) => o?.security?.requireMfa);
    if (requiring) return { error: `${requiring.name} requires two-factor, so it can't be turned off while you're a member.` };
    const parsed = codeSchema.safeParse({ code: form.get("code") });
    if (!parsed.success) return invalid(parsed.error);
    if (!(await verifySecondFactor(user, parsed.data.code)).ok) {
      await countFailure(user);
      return { error: MISMATCH, fieldErrors: { code: [MISMATCH] } };
    }
    await disableMfa(user);
    await recordUserAudit(user.id, user.email, "auth.mfa_disabled");
    revalidatePath("/app/account");
    return { ok: "Two-factor is off. Your recovery codes no longer work." };
  } catch (e) {
    return failure(e);
  }
}

export type RecoveryState = (ActionResult & { recoveryCodes?: string[] }) | null;

export async function newRecoveryCodes(_: RecoveryState, form: FormData): Promise<RecoveryState> {
  try {
    const { user } = await me();
    const parsed = codeSchema.safeParse({ code: form.get("code") });
    if (!parsed.success) return invalid(parsed.error);
    if (!(await verifySecondFactor(user, parsed.data.code)).ok) {
      await countFailure(user);
      return { error: MISMATCH, fieldErrors: { code: [MISMATCH] } };
    }
    // re-read: verifying may have consumed a recovery code or advanced the replay guard
    const fresh = await (await getStore()).getUser(user.id);
    const codes = fresh ? await regenerateRecoveryCodes(fresh) : null;
    if (!codes) return { error: "Two-factor is off." };
    await recordUserAudit(user.id, user.email, "auth.recovery_codes_regenerated");
    return { ok: "New recovery codes created. The old ones no longer work.", recoveryCodes: codes };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- sessions ---------------- */

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  try {
    const { user, session } = await me();
    if (sessionId === session.sid) return { error: "That's this browser. Use Sign out instead." };
    const store = await getStore();
    const rec = await store.getSessionRecord(sessionId);
    if (!rec || rec.userId !== user.id) return { error: "That session no longer exists." };
    await store.revokeSession(sessionId, new Date().toISOString());
    await recordUserAudit(user.id, user.email, "auth.session_revoked", { sessions: 1 });
    revalidatePath("/app/account");
    return { ok: "That session is signed out." };
  } catch (e) {
    return failure(e);
  }
}

export async function signOutOtherSessions(): Promise<ActionResult> {
  try {
    const { user, session } = await me();
    const n = await (await getStore()).revokeUserSessions(user.id, new Date().toISOString(), session.sid);
    // With Cognito, its refresh tokens go too (the app's own session here stays signed in).
    const providerNote = await providerSignOutEverywhere(user.email);
    if (n) await recordUserAudit(user.id, user.email, "auth.session_revoked", { sessions: n, scope: "all-others" });
    revalidatePath("/app/account");
    return { ok: (n ? `Signed out of ${n} other session${n > 1 ? "s" : ""}.` : "No other sessions were signed in.") + providerNote };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- password ---------------- */

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(256, "Check your current password. It is longer than any we accept."),
    next: z.string().min(12, "Use at least 12 characters.").max(128, "Use at most 128 characters."),
    confirm: z.string().max(128, "The new passwords don't match."),
    code: z.string().trim().max(20).optional(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "The new passwords don't match." });

export async function changePassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user, session } = await me();
    const parsed = passwordSchema.safeParse({
      current: form.get("current"),
      next: form.get("next"),
      confirm: form.get("confirm"),
      code: form.get("code") ?? undefined,
    });
    if (!parsed.success) return invalid(parsed.error);
    if (isCognito()) return await changeCognitoPassword(user, session, parsed.data);
    if (!user.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
      await countFailure(user);
      return { error: "Your current password isn't right.", fieldErrors: { current: ["Your current password isn't right."] } };
    }
    if (user.mfa) {
      if (!parsed.data.code) return { error: "Enter a code from your authenticator app.", fieldErrors: { code: ["Enter the 6-digit code."] } };
      if (!(await verifySecondFactor(user, parsed.data.code)).ok) {
        await countFailure(user);
        return { error: MISMATCH, fieldErrors: { code: [MISMATCH] } };
      }
    }
    const weak = await setPassword(user, parsed.data.next);
    if (weak) return { error: weak, fieldErrors: { next: [weak] } };
    const revoked = await (await getStore()).revokeUserSessions(user.id, new Date().toISOString(), session.sid);
    await recordUserAudit(user.id, user.email, "auth.password_changed", { otherSessionsRevoked: revoked });
    // New credentials, new session id.
    await createSession({ userId: user.id, email: user.email, orgId: session.orgId }, { mfaVerified: Boolean(user.mfa) });
    revalidatePath("/app/account");
    return { ok: revoked ? `Password changed. ${revoked} other session${revoked > 1 ? "s were" : " was"} signed out.` : "Password changed." };
  } catch (e) {
    return failure(e);
  }
}

const CURRENT_WRONG = "Your current password isn't right.";

/**
 * Cognito: prove the current password with InitiateAuth, then ChangePassword with that sign-in's
 * access token. The app's policy (password-policy.ts plus the pool's composition rule) is checked
 * first so problems show inline; afterwards every Cognito token is revoked and other app sessions end.
 */
async function changeCognitoPassword(
  user: User,
  session: { sid: string; orgId?: string },
  input: { current: string; next: string; code?: string },
): Promise<ActionResult> {
  const weak = passwordProblem(input.next, user.email);
  if (weak) return { error: weak, fieldErrors: { next: [weak] } };
  if (input.next === input.current) return { error: "Choose a password you haven't used here before.", fieldErrors: { next: ["Choose a password you haven't used here before."] } };

  const { cognitoAuthenticate, cognitoChangePassword, cognitoGlobalSignOut } = await import("@/lib/auth/cognito");
  const auth = await cognitoAuthenticate(user.email, input.current);
  if (!auth.ok) {
    if (auth.failure.kind === "invalid_credentials") {
      await countFailure(user);
      return { error: CURRENT_WRONG, fieldErrors: { current: [CURRENT_WRONG] } };
    }
    return { error: auth.failure.message };
  }
  if (user.mfa) {
    if (!input.code) return { error: "Enter a code from your authenticator app.", fieldErrors: { code: ["Enter the 6-digit code."] } };
    if (!(await verifySecondFactor(user, input.code)).ok) {
      await countFailure(user);
      return { error: MISMATCH, fieldErrors: { code: [MISMATCH] } };
    }
  }
  const changed = await cognitoChangePassword(auth.accessToken, input.current, input.next);
  if (!changed.ok) {
    const f = changed.failure;
    return f.kind === "password_policy" ? { error: f.message, fieldErrors: { next: [f.message] } } : { error: f.message };
  }
  // Every Cognito refresh token (including the one from the check above) stops working.
  await cognitoGlobalSignOut(user.email);

  const store = await getStore();
  await store.updateUser(user.id, { passwordChangedAt: new Date().toISOString() });
  const revoked = await store.revokeUserSessions(user.id, new Date().toISOString(), session.sid);
  await recordUserAudit(user.id, user.email, "auth.password_changed", { otherSessionsRevoked: revoked });
  // New credentials, new session id.
  await createSession({ userId: user.id, email: user.email, orgId: session.orgId }, { mfaVerified: Boolean(user.mfa) });
  revalidatePath("/app/account");
  return { ok: revoked ? `Password changed. ${revoked} other session${revoked > 1 ? "s were" : " was"} signed out.` : "Password changed." };
}
