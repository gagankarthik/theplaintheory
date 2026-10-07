"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { cognitoPasswordProblem } from "@/lib/auth/cognito-errors";
import { checkPassword } from "@/lib/auth/password-policy";
import {
  clearStaffChallenge,
  clearTrustedDevice,
  createStaffSession,
  destroyStaffSession,
  getStaffChallenge,
  getStaffSession,
  getTrustedDevice,
  revokeStaffSessions,
  setStaffChallenge,
  setTrustedDevice,
} from "@/lib/auth/staff";
import { STAFF_INVALID, normaliseTotp, type StaffStep } from "@/lib/auth/staff-auth";
import type { DroppedDevice, StaffAuthOutcome } from "@/lib/auth/staff-cognito";
import { STAFF_DEVICE_SECONDS, staffRememberDeviceEnabled, type TrustedDevice } from "@/lib/auth/staff-device";
import { safeStaffNext } from "@/lib/auth/staff-token";
import { describeAgent } from "@/components/admin/format";
import { recordPlatformAudit } from "@/lib/platform/audit";
import { honeypotFilled } from "@/lib/form-guard";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request-context";
import { emailSchema } from "@/lib/validation";

/**
 * Staff console sign-in (/admin/login), against the staff Cognito pool:
 *   password -> [new password -> authenticator setup] (first sign-in) | authenticator code -> console
 * Cognito's challenge Session only ever lives in the sealed, httpOnly pt_staff_auth cookie.
 *
 * With STAFF_REMEMBER_DEVICE=1, the code step offers "Trust this browser for 30 days". A trusted
 * browser keeps a sealed pt_staff_device cookie holding a Cognito remembered device; at the password
 * step its DEVICE_KEY goes to Cognito, which then asks for the device's SRP proof instead of a code
 * (staff-cognito.ts). Two-factor stays required by the pool; Cognito decides, the app never skips it.
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

type Actor = Parameters<typeof recordPlatformAudit>[0]["actor"];
type AuditInput = Parameters<typeof recordPlatformAudit>[0];

/**
 * Sign-in events are written best effort: an audit-store outage mustn't lock every staff member out
 * of the console. Staff actions inside the console still fail closed.
 */
async function auditSignIn(input: AuditInput) {
  try {
    await recordPlatformAudit(input);
  } catch (e) {
    console.error(`[staff-login] audit ${input.action} not written: ${e instanceof Error ? e.name : "error"}`);
  }
}

const selfTarget = (a: Actor) => ({ type: "staff" as const, id: a.sub, label: a.email });

/** The browser's name for Cognito's device list and the audit trail ("Chrome on Windows"). */
async function browserName() {
  const { userAgent } = await requestContext();
  return describeAgent(userAgent);
}

/** A trusted-browser cookie was dropped before the person finished signing in: record it against the device's owner. */
async function auditDropped(d: TrustedDevice, dropped: DroppedDevice) {
  const actor = { sub: d.sub, email: d.email, role: "signing-in" };
  await auditSignIn({ actor, action: "staff.device_forgotten", target: selfTarget(actor), metadata: { reason: dropped.reason, forgottenInCognito: dropped.forgotten, devices: 1 } });
}

/** Act on Cognito's answer: the next page, the console, or an error for the current form. */
async function proceed(outcome: StaffAuthOutcome, field: "password" | "code" | null, nextPath?: string): Promise<StaffAuthState> {
  if (outcome.droppedDevice) await clearTrustedDevice();
  if (outcome.kind === "challenge") {
    await setStaffChallenge(outcome.challenge);
    redirect(STEP_PATH[outcome.challenge.step]);
  }
  if (outcome.kind === "signed_in") {
    const next = (await getStaffChallenge())?.next ?? nextPath;
    const { identity } = outcome;
    const actor = { sub: identity.sub, email: identity.email, role: identity.role };
    if (outcome.trusted) {
      await setTrustedDevice({ ...outcome.trusted, sub: identity.sub, email: identity.email });
      const until = new Date(Date.now() + STAFF_DEVICE_SECONDS * 1000).toISOString();
      await auditSignIn({ actor, action: "staff.device_trusted", target: selfTarget(actor), metadata: { browser: await browserName(), until } });
    }
    await auditSignIn({ actor, action: "staff.signed_in", target: selfTarget(actor), metadata: { method: outcome.method, trustedBrowser: Boolean(outcome.trusted) } });
    if (staffRememberDeviceEnabled()) {
      // Devices remembered more than 30 days ago: their cookies are gone, so forget them in Cognito too.
      const { forgetLapsedStaffDevices } = await import("@/lib/auth/staff-cognito");
      const n = await forgetLapsedStaffDevices(identity.sub);
      if (n) await auditSignIn({ actor, action: "staff.device_forgotten", target: selfTarget(actor), metadata: { reason: "expired", devices: n } });
    }
    await createStaffSession(identity);
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
  const cognito = await import("@/lib/auth/staff-cognito");
  const nextPath = safeStaffNext(form.get("next"));

  // A trusted browser: use its remembered device, but only for the account it was trusted for.
  let device: TrustedDevice | undefined;
  if (staffRememberDeviceEnabled()) {
    const t = await getTrustedDevice();
    if (t?.status === "valid" && t.device.email === parsed.data.email.trim().toLowerCase()) device = t.device;
    else if (t?.status === "expired") {
      // Past its 30 days (the server-side check, whatever the browser kept): forget it everywhere.
      await clearTrustedDevice();
      await auditDropped(t.device, { reason: "expired", forgotten: await cognito.forgetStaffDevice(t.device.sub, t.device.deviceKey) });
    } else if (t?.status === "invalid") await clearTrustedDevice();
  }

  const outcome = await cognito.staffSignIn(parsed.data.email, parsed.data.password, nextPath, { device });
  if (device && outcome.droppedDevice) await auditDropped(device, outcome.droppedDevice);
  const r = await proceed(outcome, null, nextPath);
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
  // "Trust this browser for 30 days" (only offered with STAFF_REMEMBER_DEVICE=1).
  const trust = staffRememberDeviceEnabled() && form.get("trust") === "on" ? { deviceName: `Plain Theory staff console, ${await browserName()}` } : undefined;
  return proceed(await verify(challenge, code, { trust }), "code");
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

/**
 * Sign yourself out everywhere: end every console session, sign out of Cognito and forget every
 * trusted browser, so the next sign-in anywhere needs the authenticator code again.
 */
export async function staffSignOutEverywhere() {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  const actor = { sub: s.staff.sub, email: s.staff.email, role: s.role };
  const { staffGlobalSignOut } = await import("@/lib/auth/staff-cognito");
  const g = await staffGlobalSignOut(s.staff.sub);
  const ended = await revokeStaffSessions(s.staff.sub);
  await clearTrustedDevice();
  await auditSignIn({
    actor,
    action: "staff.signed_out_everywhere",
    target: selfTarget(actor),
    metadata: { sessionsEnded: ended, cognitoSignOut: g.signedOut ? "ok" : "failed", devicesForgotten: g.devicesForgotten },
  });
  if (g.devicesForgotten) await auditSignIn({ actor, action: "staff.device_forgotten", target: selfTarget(actor), metadata: { reason: "sign_out_everywhere", devices: g.devicesForgotten } });
  await destroyStaffSession();
  redirect("/admin/login?signed_out=1");
}
