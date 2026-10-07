"use server";

import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit, recordUserAudit } from "@/lib/audit";
import { allowCodeEmail } from "@/lib/auth/code-limits";
import { CODE_MISMATCH, maskEmail } from "@/lib/auth/cognito-errors";
import { allowIpAttempt, isLocked, registerFailure } from "@/lib/auth/lockout";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { parseAuthenticationJson, passkeyAuthenticationOptions, verifyPasskeyAssertion } from "@/lib/auth/passkeys";
import { passkeysOf } from "@/lib/auth/second-factor";
import {
  RESET_COOKIE,
  SIGNUP_COOKIE,
  pendingCookieOptions,
  readPendingReset,
  readPendingSignup,
  resendAvailableAt,
  signPendingReset,
  signPendingSignup,
  type PendingSignup,
} from "@/lib/auth/pending";
import { INVALID_CREDENTIALS, isCognito, linkCognitoUser, passwordProblem, signIn, signUp } from "@/lib/auth/provider";
import { MFA_COOKIE, SESSION_COOKIE, createSession } from "@/lib/auth/session";
import { MFA_CHALLENGE_SECONDS, signMfaChallenge, verifyMfaChallenge } from "@/lib/auth/token";
import { requestContext } from "@/lib/request-context";
import { checkFormGuard, honeypotFilled } from "@/lib/form-guard";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from "@/lib/spam";
import { getStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { emailSchema, plainTextSchema } from "@/lib/validation";

export type AuthState =
  | (NonNullable<ActionResult> & {
      email?: string;
      name?: string;
      formToken?: string;
      /** epoch ms when "Send a new code" becomes available again */
      resendAt?: number;
    })
  | null;

/** Same wording as a wrong password, so a bot tripping the honeypot learns nothing. */
const LOGIN_FAILED = INVALID_CREDENTIALS;
const PLANS_FOR_ONBOARDING = ["starter", "growth", "business"];

const safeNext = (v: FormDataEntryValue | string | null | undefined) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/app") && !s.startsWith("//") ? s : "/app";
};

const secondsLeft = (at: number) => Math.max(1, Math.ceil((at - Date.now()) / 1000));

/**
 * The last step of every sign-in: hold it for the app's second factor when the user has one, else
 * start the session. Always redirects.
 */
async function finishSignIn(user: User, next: string, opts: { orgId?: string } = {}): Promise<never> {
  if (user.mfa) {
    // Password passed; hold the sign-in until the second factor checks out.
    (await cookies()).set(MFA_COOKIE, await signMfaChallenge(user.id, next), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MFA_CHALLENGE_SECONDS,
    });
    redirect("/login/verify");
  }
  await createSession({ userId: user.id, email: user.email, orgId: opts.orgId });
  await recordUserAudit(user.id, user.email, "auth.login", { mfa: false });
  redirect(next);
}

/** Add the user to every organization that invited this (now proven) address. */
async function acceptInvites(user: User) {
  const store = await getStore();
  const invites = await store.invitesForEmail(user.email);
  for (const inv of invites) {
    await store.addMember({ orgId: inv.orgId, userId: user.id, role: inv.role, invitedBy: inv.invitedBy, createdAt: new Date().toISOString() });
    await store.deleteInvite(inv.orgId, inv.id);
    await recordAudit({
      orgId: inv.orgId,
      actor: { userId: user.id, email: user.email },
      action: "member.joined",
      target: { type: "user", id: user.id, label: user.email },
      metadata: { role: inv.role },
    });
  }
  return invites;
}

const onboardingPath = (plan: string | undefined) => (plan && PLANS_FOR_ONBOARDING.includes(plan) ? `/onboarding?plan=${plan}` : "/onboarding");

async function setPendingSignup(p: PendingSignup) {
  (await cookies()).set(SIGNUP_COOKIE, await signPendingSignup(p), pendingCookieOptions());
}

/* ---------------- sign in ---------------- */

const loginSchema = z.object({
  email: emailSchema("Enter the email you signed up with, like name@company.com."),
  // Upper bound stops very long inputs reaching the password hash.
  password: z.string().min(1, "Enter your password.").max(256, "Passwords are at most 128 characters. Check what you entered."),
});

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  // No time trap here: password managers sign in within a second. The lockout and network throttle
  // in auth/lockout.ts are the controls for this form.
  if (honeypotFilled(form)) return { error: LOGIN_FAILED, email };
  const parsed = loginSchema.safeParse({ email, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { ...invalid(parsed.error), email };

  const { ipHash } = await requestContext();
  const r = await signIn(parsed.data.email, parsed.data.password, ipHash);
  const next = safeNext(form.get("next"));
  if (!r.ok) {
    if (r.reason === "unconfirmed") {
      // Right password, e-mail never confirmed: send a fresh code and pick up where sign-up left off.
      const { cognitoResendCode } = await import("@/lib/auth/cognito");
      const limit = await allowCodeEmail(ipHash, parsed.data.email);
      if (limit.address) await cognitoResendCode(parsed.data.email);
      await setPendingSignup({ email: parsed.data.email, password: parsed.data.password, next, sentAt: Date.now() });
      redirect("/signup/verify");
    }
    if (r.user) {
      await recordUserAudit(r.user.id, r.user.email, "auth.login_failed", { reason: r.reason });
      if (r.lockedNow) await recordUserAudit(r.user.id, r.user.email, "auth.locked", { minutes: 15 });
    }
    return { error: r.error, email };
  }

  return finishSignIn(r.user, next);
}

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the 6-digit code from your app, or a recovery code.")
    .max(20, "Codes are at most 20 characters. Check what you entered."),
});

const CODE_FAILED = "That code didn't match. Use the newest code from your app, or a recovery code.";
const PASSKEY_FAILED = "That passkey didn't check out. Try again, or use a code instead.";
const SIGN_IN_EXPIRED = "This sign-in expired. Start again with your email and password.";

/** The user waiting at the second step, from the signed challenge cookie, or null when it's gone. */
async function pendingSecondStep() {
  const jar = await cookies();
  const challenge = await verifyMfaChallenge(jar.get(MFA_COOKIE)?.value);
  if (!challenge) return null;
  const user = await (await getStore()).getUser(challenge.userId);
  return user?.mfa ? { jar, challenge, user } : null;
}

/** A wrong second factor counts towards the same lockout as a wrong password. */
async function secondStepFailed(user: User, jar: Awaited<ReturnType<typeof cookies>>, method: "code" | "passkey"): Promise<AuthState> {
  const next = registerFailure(user);
  await (await getStore()).updateUser(user.id, { loginFailures: next.loginFailures, lockedUntil: next.lockedUntil });
  await recordUserAudit(user.id, user.email, "auth.login_failed", { reason: method === "passkey" ? "passkey" : "mfa" });
  if (next.locked) {
    jar.delete(MFA_COOKIE);
    await recordUserAudit(user.id, user.email, "auth.locked", { minutes: 15 });
    return { error: "Too many failed attempts. Sign-in for this account is paused for 15 minutes." };
  }
  return { error: method === "passkey" ? PASSKEY_FAILED : CODE_FAILED };
}

/** Second factor passed: start the session (mfaVerified) and go where the sign-in was headed. */
async function secondStepPassed(user: User, next: string, method: "totp" | "recovery" | "passkey", remaining?: number): Promise<never> {
  await createSession({ userId: user.id, email: user.email }, { mfaVerified: true });
  if (method === "recovery") await recordUserAudit(user.id, user.email, "auth.mfa_recovery_used", { remaining: remaining ?? 0 });
  await recordUserAudit(user.id, user.email, "auth.login", { mfa: true, method });
  redirect(next);
}

export async function verifyLoginCode(_: AuthState, form: FormData): Promise<AuthState> {
  const pending = await pendingSecondStep();
  if (!pending) return { error: SIGN_IN_EXPIRED };
  if (honeypotFilled(form)) return { error: CODE_FAILED };
  const parsed = codeSchema.safeParse({ code: String(form.get("code") ?? "") });
  if (!parsed.success) return invalid(parsed.error);

  const { ipHash } = await requestContext();
  if (!(await allowIpAttempt(ipHash))) return { error: "Too many attempts from your network. Wait 15 minutes and try again." };

  const result = await verifySecondFactor(pending.user, parsed.data.code.replace(/\s/g, ""));
  if (!result.ok) return secondStepFailed(pending.user, pending.jar, "code");
  return secondStepPassed(pending.user, pending.challenge.next, result.method, result.remaining);
}

/** Options for navigator.credentials.get() at the second step; the challenge is kept server-side. */
export async function loginPasskeyOptions(): Promise<{ ok: true; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string }> {
  const pending = await pendingSecondStep();
  if (!pending) return { ok: false, error: SIGN_IN_EXPIRED };
  if (!passkeysOf(pending.user.mfa).length) return { ok: false, error: "Your account has no passkey. Use a code instead." };
  return { ok: true, options: await passkeyAuthenticationOptions(pending.user) };
}

/** Finish sign-in with a passkey. Same throttle, lockout and session as the code path. */
export async function verifyLoginPasskey(response: unknown): Promise<AuthState> {
  const pending = await pendingSecondStep();
  if (!pending) return { error: SIGN_IN_EXPIRED };
  const { ipHash } = await requestContext();
  if (!(await allowIpAttempt(ipHash))) return { error: "Too many attempts from your network. Wait 15 minutes and try again." };
  const parsed = parseAuthenticationJson(response);
  if (!parsed) return secondStepFailed(pending.user, pending.jar, "passkey");

  const r = await verifyPasskeyAssertion(pending.user.id, parsed);
  if (!r.ok) {
    if (r.reason === "counter") {
      await recordUserAudit(pending.user.id, pending.user.email, "auth.passkey_counter_mismatch", { credential: r.passkey?.id.slice(0, 16) ?? "", name: r.passkey?.name ?? "" });
    }
    if (r.reason === "expired") return { error: "The passkey check timed out. Try again." };
    return secondStepFailed(pending.user, pending.jar, "passkey");
  }
  return secondStepPassed(pending.user, pending.challenge.next, "passkey");
}

/** Abandon a pending second-factor step. */
export async function cancelLoginCode() {
  (await cookies()).delete(MFA_COOKIE);
  redirect("/login");
}

/* ---------------- sign up ---------------- */

const signupSchema = z.object({
  name: plainTextSchema({
    min: 2,
    max: 100,
    tooShort: "Enter your name.",
    tooLong: "Keep your name under 100 characters.",
    noLinks: "Enter your name without links.",
  }),
  email: emailSchema("Enter a work email like name@company.com.").refine((e) => !isDisposableEmail(e), DISPOSABLE_EMAIL_MESSAGE),
  password: z.string().min(12, "Use at least 12 characters for your password.").max(128, "Use at most 128 characters for your password."),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const name = String(form.get("name") ?? "");
  const keep = { email, name };

  // Honeypot filled: a bot. Send it somewhere harmless without creating anything.
  const guard = checkFormGuard(form, "signup");
  if (guard.status === "bot") redirect("/login");
  if (guard.status === "retry") return { error: guard.error, formToken: guard.formToken, ...keep };

  const parsed = signupSchema.safeParse({ name, email, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { ...invalid(parsed.error), ...keep };

  const { ipHash } = await requestContext();
  const limit = await rateLimiter("signup").consume(ipHash);
  if (!limit.ok) {
    return { error: `Too many accounts were created from your network recently. Try again in ${retryAfterText(limit.retryAfterMs)}.`, ...keep };
  }

  const r = await signUp(parsed.data);
  if (!r.ok) return r.reason === "policy" ? { error: r.error, fieldErrors: { password: [r.error] }, ...keep } : { error: r.error, ...keep };
  const plan = String(form.get("plan") ?? "");

  if (r.pending) {
    // Cognito e-mailed a code. Nobody is signed in, and no invite is accepted, until it's confirmed.
    await setPendingSignup({
      email: r.user.email,
      name: parsed.data.name,
      password: parsed.data.password,
      plan: PLANS_FOR_ONBOARDING.includes(plan) ? plan : undefined,
      sentAt: Date.now(),
    });
    redirect("/signup/verify");
  }

  const invites = await acceptInvites(r.user);
  await createSession({ userId: r.user.id, email: r.user.email, orgId: invites[0]?.orgId });
  // Carry a plan picked on the pricing page into onboarding's plan step.
  redirect(invites.length ? "/app" : onboardingPath(plan));
}

/* ---------------- confirm the e-mail (Cognito) ---------------- */

const signupCodeSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.")),
});

/** Send a new confirmation code, respecting the cooldown and the per-network and per-address limits. */
async function resendSignupCode(email: string, pending: PendingSignup | null, ipHash: string): Promise<AuthState> {
  const availableAt = resendAvailableAt(pending?.email === email ? pending.sentAt : undefined);
  if (availableAt > Date.now()) return { error: `Wait ${secondsLeft(availableAt)} seconds before sending another code.`, resendAt: availableAt, email };
  const limit = await allowCodeEmail(ipHash, email);
  if (!limit.network) return { error: `Too many codes were requested from your network. Try again in ${retryAfterText(limit.retryAfterMs)}.`, email };
  const { cognitoResendCode } = await import("@/lib/auth/cognito");
  if (limit.address) await cognitoResendCode(email);
  const sentAt = Date.now();
  const keep = pending?.email === email ? pending : { email };
  await setPendingSignup({ ...keep, sentAt });
  return {
    ok: pending?.email === email ? `We sent a new code to ${maskEmail(email)}. It can take a minute to arrive.` : `If ${maskEmail(email)} is waiting for confirmation, we sent it a new code.`,
    resendAt: resendAvailableAt(sentAt),
    email,
  };
}

export async function verifySignup(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isCognito()) redirect("/signup");
  const jar = await cookies();
  const pending = await readPendingSignup(jar.get(SIGNUP_COOKIE)?.value);
  const typed = String(form.get("email") ?? "");
  if (honeypotFilled(form)) return { error: CODE_MISMATCH, email: typed };

  let email = pending?.email;
  if (!email) {
    const parsed = emailSchema("Enter the email you signed up with, like name@company.com.").safeParse(typed);
    if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: { email: [parsed.error.issues[0].message] }, email: typed };
    email = parsed.data;
  }
  const { ipHash } = await requestContext();

  if (form.get("intent") === "resend") return resendSignupCode(email, pending, ipHash);

  const parsed = signupCodeSchema.safeParse({ code: String(form.get("code") ?? "") });
  if (!parsed.success) return { ...invalid(parsed.error), email: typed };
  if (!(await allowIpAttempt(ipHash))) return { error: "Too many attempts from your network. Wait 15 minutes and try again.", email: typed };

  const { cognitoConfirmSignUp, cognitoSignIn } = await import("@/lib/auth/cognito");
  const confirmed = await cognitoConfirmSignUp(email, parsed.data.code);
  if (!confirmed.ok) {
    const f = confirmed.failure;
    const onCode = f.kind === "code_mismatch" || f.kind === "code_expired";
    return { error: f.message, fieldErrors: onCode ? { code: [f.message] } : undefined, email: typed };
  }

  // Confirmed. With the password from this browser's sign-up, sign straight in; otherwise ask for it.
  const signedIn = pending?.email === email && pending.password ? await cognitoSignIn(email, pending.password) : null;
  jar.delete(SIGNUP_COOKIE);
  if (!signedIn?.ok) redirect("/login?confirmed=1");

  const user = await linkCognitoUser({ ...signedIn.identity, name: signedIn.identity.name ?? pending?.name });
  // A sign-in lockout still applies; they can sign in by hand once it lifts.
  if (isLocked(user)) redirect("/login?confirmed=1");
  const invites = await acceptInvites(user);
  const store = await getStore();
  const memberships = invites.length ? invites : await store.listMemberships(user.id);
  const next = memberships.length ? (pending?.next ?? "/app") : onboardingPath(pending?.plan);
  if (!confirmed.alreadyConfirmed) await recordUserAudit(user.id, user.email, "auth.signup", { provider: "cognito" });
  return finishSignIn(user, next, { orgId: invites[0]?.orgId });
}

/** Start over with a different address. */
export async function restartSignup() {
  (await cookies()).delete(SIGNUP_COOKIE);
  redirect("/signup");
}

/* ---------------- forgot and reset password (Cognito) ---------------- */

const forgotSchema = z.object({ email: emailSchema("Enter the email you signed up with, like name@company.com.") });

/**
 * Ask Cognito to e-mail a reset code. The response is the same whether or not the address has an
 * account; only a network over its limit is told to wait.
 */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const typed = String(form.get("email") ?? "");
  if (!isCognito()) return { error: "Password reset by email isn't available in this environment. Ask a workspace owner or support@theplaintheory.in.", email: typed };
  const parsed = forgotSchema.safeParse({ email: typed });
  if (!parsed.success) return { ...invalid(parsed.error), email: typed };
  const email = parsed.data.email;
  const jar = await cookies();

  if (!honeypotFilled(form)) {
    const { ipHash } = await requestContext();
    const prior = await readPendingReset(jar.get(RESET_COOKIE)?.value);
    const coolingDown = prior?.email === email && resendAvailableAt(prior.sentAt) > Date.now();
    if (!coolingDown) {
      const limit = await allowCodeEmail(ipHash, email);
      if (!limit.network) return { error: `Too many reset requests came from your network. Try again in ${retryAfterText(limit.retryAfterMs)}.`, email: typed };
      const { cognitoForgotPassword } = await import("@/lib/auth/cognito");
      if (limit.address) await cognitoForgotPassword(email);
    }
    jar.set(RESET_COOKIE, await signPendingReset({ email, sentAt: coolingDown ? prior!.sentAt : Date.now() }), pendingCookieOptions());
  }
  redirect("/reset-password");
}

const resetSchema = z
  .object({
    code: z
      .string()
      .transform((s) => s.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.")),
    password: z.string().min(12, "Use at least 12 characters.").max(128, "Use at most 128 characters."),
    confirm: z.string().max(128, "The new passwords don't match."),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "The new passwords don't match." });

export async function resetPassword(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isCognito()) redirect("/forgot-password");
  const jar = await cookies();
  const pending = await readPendingReset(jar.get(RESET_COOKIE)?.value);
  const typed = String(form.get("email") ?? "");
  if (honeypotFilled(form)) return { error: CODE_MISMATCH, email: typed };

  let email = pending?.email;
  if (!email) {
    const parsed = emailSchema("Enter the email you signed up with, like name@company.com.").safeParse(typed);
    if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: { email: [parsed.error.issues[0].message] }, email: typed };
    email = parsed.data;
  }
  const { ipHash } = await requestContext();
  const { cognitoConfirmForgotPassword, cognitoForgotPassword, cognitoGlobalSignOut } = await import("@/lib/auth/cognito");

  if (form.get("intent") === "resend") {
    const availableAt = resendAvailableAt(pending?.email === email ? pending.sentAt : undefined);
    if (availableAt > Date.now()) return { error: `Wait ${secondsLeft(availableAt)} seconds before sending another code.`, resendAt: availableAt, email: typed };
    const limit = await allowCodeEmail(ipHash, email);
    if (!limit.network) return { error: `Too many reset requests came from your network. Try again in ${retryAfterText(limit.retryAfterMs)}.`, email: typed };
    if (limit.address) await cognitoForgotPassword(email);
    const sentAt = Date.now();
    jar.set(RESET_COOKIE, await signPendingReset({ email, sentAt }), pendingCookieOptions());
    return { ok: `If an account uses ${maskEmail(email)}, we sent it a new code. It can take a minute to arrive.`, resendAt: resendAvailableAt(sentAt), email: typed };
  }

  const parsed = resetSchema.safeParse({ code: String(form.get("code") ?? ""), password: String(form.get("password") ?? ""), confirm: String(form.get("confirm") ?? "") });
  if (!parsed.success) return { ...invalid(parsed.error), email: typed };
  const weak = passwordProblem(parsed.data.password, email);
  if (weak) return { error: weak, fieldErrors: { password: [weak] }, email: typed };
  if (!(await allowIpAttempt(ipHash))) return { error: "Too many attempts from your network. Wait 15 minutes and try again.", email: typed };

  const r = await cognitoConfirmForgotPassword(email, parsed.data.code, parsed.data.password);
  if (!r.ok) {
    const f = r.failure;
    const field = f.kind === "code_mismatch" || f.kind === "code_expired" ? "code" : f.kind === "password_policy" ? "password" : null;
    return { error: f.message, fieldErrors: field ? { [field]: [f.message] } : undefined, email: typed };
  }

  // New password: every app session and every Cognito token for this person stops working.
  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (user) {
    const now = new Date().toISOString();
    const revoked = await store.revokeUserSessions(user.id, now);
    // Proving the inbox also clears a sign-in lockout.
    await store.updateUser(user.id, { passwordChangedAt: now, loginFailures: undefined, lockedUntil: undefined });
    await recordUserAudit(user.id, user.email, "auth.password_reset", { sessionsRevoked: revoked });
  }
  await cognitoGlobalSignOut(email);
  jar.delete(RESET_COOKIE);
  jar.delete(SESSION_COOKIE);
  redirect("/login?reset=1");
}

/** Start the reset again with a different address. */
export async function restartReset() {
  (await cookies()).delete(RESET_COOKIE);
  redirect("/forgot-password");
}
