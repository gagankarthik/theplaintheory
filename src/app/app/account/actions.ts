"use server";

import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordUserAudit } from "@/lib/audit";
import { registerFailure } from "@/lib/auth/lockout";
import { beginEnrolment, confirmEnrolment, regenerateRecoveryCodes, removeFactor, verifySecondFactor } from "@/lib/auth/mfa";
import {
  parseAuthenticationJson,
  parseRegistrationJson,
  passkeyAuthenticationOptions,
  passkeyRegistrationOptions,
  verifyPasskeyAssertion,
  verifyPasskeyRegistration,
} from "@/lib/auth/passkeys";
import { isCognito, passwordProblem, providerSignOutEverywhere, setPassword } from "@/lib/auth/provider";
import { canSkipMfaSetup, factorCount, hasTotp, mfaSetupDeadline, passkeysOf } from "@/lib/auth/second-factor";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/crypto";
import { getStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { plainTextSchema } from "@/lib/validation";

/* Every action here works for members who still need to enrol in MFA. */
const me = () => requireUser({ allowWithoutMfa: true });

/** Enough for every device someone owns, few enough to list on one card. */
const MAX_PASSKEYS = 10;

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

const codeSchema = z.object({ code: z.string().trim().min(6, "Enter the 6-digit code from your app, or a recovery code.").max(20) });
const MISMATCH = "That code didn't match.";
const PASSKEY_FAILED = "That passkey didn't check out. Try again, or use a code instead.";
const PASSKEY_EXPIRED = "The passkey check timed out. Try again.";

type Proof = { ok: true } | { ok: false; result: NonNullable<ActionResult> };

/** Flag a passkey whose signature counter went backwards: it may have been copied. */
async function auditCounter(user: User, passkey: { id: string; name: string } | undefined) {
  await recordUserAudit(user.id, user.email, "auth.passkey_counter_mismatch", { credential: passkey?.id.slice(0, 16) ?? "", name: passkey?.name ?? "" });
}

/**
 * A fresh second-factor check for a sensitive change: a passkey assertion (the `assertion` field, set
 * by the "Use a passkey" button), else a TOTP or recovery code (the `code` field). Failures count
 * towards the sign-in lockout.
 */
async function proveSecondFactor(user: User, form: FormData): Promise<Proof> {
  const raw = form.get("assertion");
  if (typeof raw === "string" && raw) {
    let response = null;
    try {
      response = parseAuthenticationJson(JSON.parse(raw));
    } catch {
      response = null;
    }
    if (!response) return { ok: false, result: { error: PASSKEY_FAILED } };
    const r = await verifyPasskeyAssertion(user.id, response);
    if (r.ok) return { ok: true };
    if (r.reason === "counter") await auditCounter(user, r.passkey);
    if (r.reason === "expired") return { ok: false, result: { error: PASSKEY_EXPIRED } };
    await countFailure(user);
    return { ok: false, result: { error: PASSKEY_FAILED } };
  }
  const parsed = codeSchema.safeParse({ code: form.get("code") });
  if (!parsed.success) return { ok: false, result: invalid(parsed.error)! };
  if (!(await verifySecondFactor(user, parsed.data.code.replace(/\s/g, ""))).ok) {
    await countFailure(user);
    return { ok: false, result: { error: MISMATCH, fieldErrors: { code: [MISMATCH] } } };
  }
  return { ok: true };
}

/** The first organization that requires two-factor, if any. */
async function requiringOrg(memberships: { orgId: string }[]) {
  const store = await getStore();
  const orgs = await Promise.all(memberships.map((m) => store.getOrg(m.orgId)));
  return orgs.find((o) => o?.security?.requireMfa) ?? null;
}

/** Re-read after a check: verifying may have consumed a recovery code or moved a passkey counter. */
const fresh = async (user: User) => (await (await getStore()).getUser(user.id)) ?? user;

/** Removing the last factor turns two-factor off, which a requiring organization doesn't allow. */
async function lastFactorBlocked(user: User, memberships: { orgId: string }[]) {
  if (factorCount(user.mfa) > 1) return null;
  const requiring = await requiringOrg(memberships);
  return requiring ? `${requiring.name} requires two-factor, so you can't remove your only method while you're a member. Add another method first.` : null;
}

/* ---------------- two-factor: authenticator app ---------------- */

export type EnrolState = (ActionResult & { secret?: string; uri?: string; recoveryCodes?: string[] }) | null;

export async function startMfaEnrolment(): Promise<EnrolState> {
  try {
    const { user } = await me();
    if (hasTotp(user.mfa)) return { error: "An authenticator app is already set up." };
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
    await recordUserAudit(user.id, user.email, "auth.mfa_enabled", { method: "totp" });
    // A change in assurance level: rotate the session id.
    await createSession({ userId: user.id, email: user.email, orgId: session.orgId }, { mfaVerified: true });
    revalidatePath("/app", "layout");
    return r.firstFactor
      ? { ok: "Two-factor is on. Save your recovery codes now; they won't be shown again.", recoveryCodes: r.recoveryCodes }
      : { ok: "Authenticator app added. Your recovery codes haven't changed." };
  } catch (e) {
    return failure(e);
  }
}

export async function removeAuthenticatorApp(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user, memberships } = await me();
    if (!hasTotp(user.mfa)) return { error: "No authenticator app is set up." };
    const blocked = await lastFactorBlocked(user, memberships);
    if (blocked) return { error: blocked };
    const proof = await proveSecondFactor(user, form);
    if (!proof.ok) return proof.result;
    const { stillOn } = await removeFactor(await fresh(user), { kind: "totp" });
    await recordUserAudit(user.id, user.email, "auth.totp_removed");
    if (!stillOn) await recordUserAudit(user.id, user.email, "auth.mfa_disabled");
    revalidatePath("/app", "layout");
    return { ok: stillOn ? "Authenticator app removed. Your passkeys still work." : "Authenticator app removed. Two-factor is off and your recovery codes no longer work." };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- two-factor: passkeys ---------------- */

const passkeyNameSchema = plainTextSchema({
  min: 1,
  max: 60,
  tooShort: "Give this passkey a name, like “MacBook Touch ID”.",
  tooLong: "Keep the name under 60 characters.",
  noLinks: "Use a name without links or angle brackets.",
});

type Options<T> = { ok: true; options: T } | { ok: false; error: string };

/** Step 1 of adding a passkey: options for navigator.credentials.create(), with a stored challenge. */
export async function startPasskeyRegistration(rawName: string): Promise<Options<PublicKeyCredentialCreationOptionsJSON> & { field?: boolean }> {
  try {
    const { user } = await me();
    const name = passkeyNameSchema.safeParse(rawName);
    if (!name.success) return { ok: false, error: name.error.issues[0].message, field: true };
    if (passkeysOf(user.mfa).length >= MAX_PASSKEYS) return { ok: false, error: `You can have up to ${MAX_PASSKEYS} passkeys. Remove one first.` };
    return { ok: true, options: await passkeyRegistrationOptions(user) };
  } catch (e) {
    return { ok: false, error: failure(e)?.error ?? "Something went wrong. Try again." };
  }
}

export type PasskeyAddState = (ActionResult & { recoveryCodes?: string[] }) | null;

/** Step 2: verify what the authenticator returned and save the passkey. */
export async function finishPasskeyRegistration(response: unknown, rawName: string): Promise<PasskeyAddState> {
  try {
    const { user, session } = await me();
    const name = passkeyNameSchema.safeParse(rawName);
    if (!name.success) return { error: name.error.issues[0].message, fieldErrors: { name: [name.error.issues[0].message] } };
    const parsed = parseRegistrationJson(response);
    if (!parsed) return { error: "Your browser sent an unexpected response. Try again." };
    const r = await verifyPasskeyRegistration(user.id, parsed, name.data);
    if (!r.ok) {
      return {
        error:
          r.reason === "expired"
            ? "Adding the passkey took too long. Try again."
            : r.reason === "duplicate"
              ? "That passkey is already on your account."
              : "We couldn't verify that passkey. Try again.",
      };
    }
    await recordUserAudit(user.id, user.email, "auth.passkey_added", { name: r.passkey.name });
    if (r.firstFactor) {
      await recordUserAudit(user.id, user.email, "auth.mfa_enabled", { method: "passkey" });
      // A change in assurance level: rotate the session id.
      await createSession({ userId: user.id, email: user.email, orgId: session.orgId }, { mfaVerified: true });
    }
    revalidatePath("/app", "layout");
    return r.firstFactor
      ? { ok: "Passkey added and two-factor is on. Save your recovery codes now; they won't be shown again.", recoveryCodes: r.recoveryCodes }
      : { ok: `Passkey “${r.passkey.name}” added.` };
  } catch (e) {
    return failure(e);
  }
}

/** Options for a fresh passkey check before a sensitive change (remove a method, new codes, password). */
export async function startPasskeyCheck(): Promise<Options<PublicKeyCredentialRequestOptionsJSON>> {
  try {
    const { user } = await me();
    if (!passkeysOf(user.mfa).length) return { ok: false, error: "You don't have a passkey yet." };
    return { ok: true, options: await passkeyAuthenticationOptions(user) };
  } catch (e) {
    return { ok: false, error: failure(e)?.error ?? "Something went wrong. Try again." };
  }
}

export async function removePasskey(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user, memberships } = await me();
    const id = String(form.get("passkeyId") ?? "");
    const passkey = passkeysOf(user.mfa).find((p) => p.id === id);
    if (!passkey) return { error: "That passkey is already gone." };
    const blocked = await lastFactorBlocked(user, memberships);
    if (blocked) return { error: blocked };
    const proof = await proveSecondFactor(user, form);
    if (!proof.ok) return proof.result;
    const { stillOn } = await removeFactor(await fresh(user), { kind: "passkey", id });
    await recordUserAudit(user.id, user.email, "auth.passkey_removed", { name: passkey.name });
    if (!stillOn) await recordUserAudit(user.id, user.email, "auth.mfa_disabled");
    revalidatePath("/app", "layout");
    return { ok: stillOn ? `Passkey “${passkey.name}” removed.` : `Passkey “${passkey.name}” removed. Two-factor is off and your recovery codes no longer work.` };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- two-factor: skip for now ---------------- */

/**
 * "Skip for now" under an organization that requires two-factor: allowed until 7 days after the
 * member was first asked. After that the setup screen is the only way in.
 */
export async function skipMfaSetup(): Promise<ActionResult> {
  const { user } = await me();
  if (user.mfa) redirect("/app");
  if (!canSkipMfaSetup(user)) return { error: "The time to skip has ended. Set up two-factor to keep using Plain Theory." };
  const deadline = mfaSetupDeadline(user);
  await (await getStore()).updateUser(user.id, { mfaSetupDeferredUntil: deadline, mfaSetupSkippedAt: new Date().toISOString() });
  await recordUserAudit(user.id, user.email, "auth.mfa_setup_skipped", { until: deadline });
  revalidatePath("/app", "layout");
  redirect("/app");
}

/** "Skip for now" on the optional prompt: it stays away for 30 days. */
export async function dismissMfaPrompt(): Promise<ActionResult> {
  try {
    const { user } = await me();
    await (await getStore()).updateUser(user.id, { mfaPromptDismissedAt: new Date().toISOString() });
    revalidatePath("/app");
    return { ok: "We won't ask again for 30 days. You can set it up any time in Account." };
  } catch (e) {
    return failure(e);
  }
}

/* ---------------- recovery codes ---------------- */

export type RecoveryState = (ActionResult & { recoveryCodes?: string[] }) | null;

export async function newRecoveryCodes(_: RecoveryState, form: FormData): Promise<RecoveryState> {
  try {
    const { user } = await me();
    if (!user.mfa) return { error: "Two-factor is off." };
    const proof = await proveSecondFactor(user, form);
    if (!proof.ok) return proof.result;
    const codes = await regenerateRecoveryCodes(await fresh(user));
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
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "The new passwords don't match." });

export async function changePassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { user, session } = await me();
    const parsed = passwordSchema.safeParse({
      current: form.get("current"),
      next: form.get("next"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) return invalid(parsed.error);
    if (isCognito()) return await changeCognitoPassword(user, session, parsed.data, form);
    if (!user.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
      await countFailure(user);
      return { error: "Your current password isn't right.", fieldErrors: { current: ["Your current password isn't right."] } };
    }
    if (user.mfa) {
      const proof = await proveSecondFactor(user, form);
      if (!proof.ok) return proof.result;
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
  input: { current: string; next: string },
  form: FormData,
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
    const proof = await proveSecondFactor(user, form);
    if (!proof.ok) return proof.result;
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
