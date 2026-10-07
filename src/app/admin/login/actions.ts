"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { cognitoPasswordProblem } from "@/lib/auth/cognito-errors";
import { checkPassword } from "@/lib/auth/password-policy";
import { clearStaffChallenge, createStaffSession, destroyStaffSession, getStaffChallenge, setStaffChallenge } from "@/lib/auth/staff";
import { STAFF_INVALID, normaliseTotp, type StaffStep } from "@/lib/auth/staff-auth";
import type { StaffAuthOutcome } from "@/lib/auth/staff-cognito";
import { safeStaffNext } from "@/lib/auth/staff-token";
import { honeypotFilled } from "@/lib/form-guard";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request-context";
import { emailSchema } from "@/lib/validation";

/**
 * Staff console sign-in (/admin/login), against the staff Cognito pool:
 *   password -> [new password -> authenticator setup] (first sign-in) | authenticator code -> console
 * Cognito's challenge Session only ever lives in the sealed, httpOnly pt_staff_auth cookie.
 */

export type StaffAuthState = (NonNullable<ActionResult> & { email?: string }) | null;

const STEP_PATH: Record<StaffStep, string> = {
  new_password: "/admin/login/new-password",
  mfa_setup: "/admin/login/setup-mfa",
  mfa: "/admin/login/verify",
};

/** Every step counts against one per-network window. */
async function throttled(): Promise<string | null> {
  const { ipHash } = await requestContext();
  const r = await rateLimiter("staffSignIn").consume(ipHash);
  return r.ok ? null : `Too many sign-in attempts from your network. Try again in ${retryAfterText(r.retryAfterMs)}.`;
}

/** Act on Cognito's answer: the next page, the console, or an error for the current form. */
async function proceed(outcome: StaffAuthOutcome, field: "password" | "code" | null): Promise<StaffAuthState> {
  if (outcome.kind === "challenge") {
    await setStaffChallenge(outcome.challenge);
    redirect(STEP_PATH[outcome.challenge.step]);
  }
  if (outcome.kind === "signed_in") {
    const next = (await getStaffChallenge())?.next;
    await createStaffSession(outcome.identity);
    redirect(safeStaffNext(next));
  }
  const f = outcome.failure;
  if (f.kind === "session_expired") {
    await clearStaffChallenge();
    redirect("/admin/login?expired=1");
  }
  if (f.kind === "no_role") await clearStaffChallenge();
  const onField = field && (f.kind === "code_mismatch" || f.kind === "password_policy");
  return { error: f.message, ...(onField ? { fieldErrors: { [field]: [f.message] } } : {}) };
}

/* ---------------- step 1: email and password ---------------- */

const loginSchema = z.object({
  email: emailSchema("Enter your Plain Theory staff email."),
  password: z.string().min(1, "Enter your password.").max(256, "Passwords are at most 256 characters. Check what you entered."),
});

export async function staffLogin(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const email = String(form.get("email") ?? "");
  if (honeypotFilled(form)) return { error: STAFF_INVALID, email };
  const parsed = loginSchema.safeParse({ email, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { ...invalid(parsed.error), email };
  const limited = await throttled();
  if (limited) return { error: limited, email };
  await clearStaffChallenge();
  const { staffSignIn } = await import("@/lib/auth/staff-cognito");
  const outcome = await staffSignIn(parsed.data.email, parsed.data.password, safeStaffNext(form.get("next")));
  const r = await proceed(outcome, null);
  return r ? { ...r, email } : r;
}

/* ---------------- first sign-in: a new password ---------------- */

export async function staffNewPassword(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const challenge = await getStaffChallenge("new_password");
  if (!challenge) redirect("/admin/login?expired=1");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const weak = password.length > 128 ? "Use at most 128 characters." : (checkPassword(password, challenge.email) ?? cognitoPasswordProblem(password));
  if (weak) return { error: weak, fieldErrors: { password: [weak] } };
  if (confirm !== password) return { error: "The passwords don't match.", fieldErrors: { confirm: ["Type the same password again."] } };
  const limited = await throttled();
  if (limited) return { error: limited };
  const { staffSetNewPassword } = await import("@/lib/auth/staff-cognito");
  return proceed(await staffSetNewPassword(challenge, password), "password");
}

/* ---------------- authenticator codes ---------------- */

const CODE_FORMAT = "Enter the 6-digit code from your authenticator app.";

export async function staffConfirmMfaSetup(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const challenge = await getStaffChallenge("mfa_setup");
  if (!challenge) redirect("/admin/login?expired=1");
  const code = normaliseTotp(form.get("code"));
  if (!code) return { error: CODE_FORMAT, fieldErrors: { code: [CODE_FORMAT] } };
  const limited = await throttled();
  if (limited) return { error: limited };
  const { staffConfirmMfaSetup: confirm } = await import("@/lib/auth/staff-cognito");
  return proceed(await confirm(challenge, code), "code");
}

export async function staffVerifyMfa(_: StaffAuthState, form: FormData): Promise<StaffAuthState> {
  const challenge = await getStaffChallenge("mfa");
  if (!challenge) redirect("/admin/login?expired=1");
  const code = normaliseTotp(form.get("code"));
  if (!code) return { error: CODE_FORMAT, fieldErrors: { code: [CODE_FORMAT] } };
  const limited = await throttled();
  if (limited) return { error: limited };
  const { staffVerifyMfa: verify } = await import("@/lib/auth/staff-cognito");
  return proceed(await verify(challenge, code), "code");
}

/* ---------------- leaving ---------------- */

/** Abandon a sign-in in progress and start again. */
export async function cancelStaffLogin() {
  await clearStaffChallenge();
  redirect("/admin/login");
}

export async function staffSignOut() {
  await destroyStaffSession();
  redirect("/admin/login?signed_out=1");
}
