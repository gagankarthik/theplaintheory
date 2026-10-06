"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit, recordUserAudit } from "@/lib/audit";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { INVALID_CREDENTIALS, signIn, signUp } from "@/lib/auth/provider";
import { MFA_COOKIE, createSession } from "@/lib/auth/session";
import { MFA_CHALLENGE_SECONDS, signMfaChallenge, verifyMfaChallenge } from "@/lib/auth/token";
import { requestContext } from "@/lib/request-context";
import { checkFormGuard, honeypotFilled } from "@/lib/form-guard";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from "@/lib/spam";
import { getStore } from "@/lib/store";
import { emailSchema, plainTextSchema } from "@/lib/validation";

export type AuthState = (NonNullable<ActionResult> & { email?: string; name?: string; formToken?: string }) | null;

/** Same wording as a wrong password, so a bot tripping the honeypot learns nothing. */
const LOGIN_FAILED = INVALID_CREDENTIALS;

const safeNext = (v: FormDataEntryValue | string | null | undefined) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/app") && !s.startsWith("//") ? s : "/app";
};

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
  if (!r.ok) {
    if (r.user) {
      await recordUserAudit(r.user.id, r.user.email, "auth.login_failed", { reason: r.reason });
      if (r.lockedNow) await recordUserAudit(r.user.id, r.user.email, "auth.locked", { minutes: 15 });
    }
    return { error: r.error, email };
  }

  const next = safeNext(form.get("next"));
  if (r.user.mfa) {
    // Password passed; hold the sign-in until the second factor checks out.
    (await cookies()).set(MFA_COOKIE, await signMfaChallenge(r.user.id, next), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MFA_CHALLENGE_SECONDS,
    });
    redirect("/login/verify");
  }

  await createSession({ userId: r.user.id, email: r.user.email });
  await recordUserAudit(r.user.id, r.user.email, "auth.login", { mfa: false });
  redirect(next);
}

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the 6-digit code from your app, or a recovery code.")
    .max(20, "Codes are at most 20 characters. Check what you entered."),
});

export async function verifyLoginCode(_: AuthState, form: FormData): Promise<AuthState> {
  const jar = await cookies();
  const challenge = await verifyMfaChallenge(jar.get(MFA_COOKIE)?.value);
  if (!challenge) return { error: "This sign-in expired. Start again with your email and password." };
  if (honeypotFilled(form)) return { error: "That code didn't match. Use the newest code from your app, or a recovery code." };
  const parsed = codeSchema.safeParse({ code: String(form.get("code") ?? "") });
  if (!parsed.success) return invalid(parsed.error);

  const store = await getStore();
  const user = await store.getUser(challenge.userId);
  if (!user?.mfa) return { error: "This sign-in expired. Start again with your email and password." };

  const { ipHash } = await requestContext();
  const { allowIpAttempt } = await import("@/lib/auth/lockout");
  if (!allowIpAttempt(ipHash)) return { error: "Too many attempts from your network. Wait 15 minutes and try again." };

  const result = await verifySecondFactor(user, parsed.data.code);
  if (!result.ok) {
    const { registerFailure } = await import("@/lib/auth/lockout");
    const next = registerFailure(user);
    await store.updateUser(user.id, { loginFailures: next.loginFailures, lockedUntil: next.lockedUntil });
    await recordUserAudit(user.id, user.email, "auth.login_failed", { reason: "mfa" });
    if (next.locked) {
      jar.delete(MFA_COOKIE);
      await recordUserAudit(user.id, user.email, "auth.locked", { minutes: 15 });
      return { error: "Too many failed attempts. Sign-in for this account is paused for 15 minutes." };
    }
    return { error: "That code didn't match. Use the newest code from your app, or a recovery code." };
  }

  await createSession({ userId: user.id, email: user.email }, { mfaVerified: true });
  if (result.method === "recovery") await recordUserAudit(user.id, user.email, "auth.mfa_recovery_used", { remaining: result.remaining ?? 0 });
  await recordUserAudit(user.id, user.email, "auth.login", { mfa: true, method: result.method });
  redirect(challenge.next);
}

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

  // Accept any pending team invites sent to this address.
  const store = await getStore();
  const invites = await store.invitesForEmail(r.user.email);
  for (const inv of invites) {
    await store.addMember({ orgId: inv.orgId, userId: r.user.id, role: inv.role, invitedBy: inv.invitedBy, createdAt: new Date().toISOString() });
    await store.deleteInvite(inv.orgId, inv.id);
    await recordAudit({
      orgId: inv.orgId,
      actor: { userId: r.user.id, email: r.user.email },
      action: "member.joined",
      target: { type: "user", id: r.user.id, label: r.user.email },
      metadata: { role: inv.role },
    });
  }
  await createSession({ userId: r.user.id, email: r.user.email, orgId: invites[0]?.orgId });
  redirect(invites.length ? "/app" : "/onboarding");
}

/** Abandon a pending second-factor step. */
export async function cancelLoginCode() {
  (await cookies()).delete(MFA_COOKIE);
  redirect("/login");
}
