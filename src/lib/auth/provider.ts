import "server-only";
import { hashPassword, id, verifyPassword } from "../crypto";
import { getStore } from "../store";
import type { User } from "../types";
import { allowIpAttempt, isLocked, registerFailure } from "./lockout";
import { checkPassword } from "./password-policy";

/**
 * AUTH_DRIVER=cognito verifies credentials against an AWS Cognito user pool (USER_PASSWORD_AUTH flow;
 * MFA, advanced security and lockout are configured in the pool). The default local driver stores
 * scrypt hashes in the data store and enforces TOTP MFA, lockout and the password policy itself.
 * Either way the app issues its own server-side session keyed by our user id.
 */
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string; reason: "invalid" | "locked" | "throttled" | "policy" | "exists" | "provider"; user?: User; lockedNow?: boolean };

export const INVALID_CREDENTIALS = "That email and password don't match an account.";
const INVALID = INVALID_CREDENTIALS;
const LOCKED = "Too many failed attempts. Sign-in for this account is paused for 15 minutes.";
const THROTTLED = "Too many sign-in attempts from your network. Wait 15 minutes and try again.";

/** A real scrypt hash so unknown emails cost the same time as known ones (no account enumeration by timing). */
let dummyHash: Promise<string> | null = null;
const timingDummy = () => (dummyHash ??= hashPassword("timing-equaliser-not-a-real-password"));

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const store = await getStore();
  const email = input.email.trim().toLowerCase();
  const weak = checkPassword(input.password, email);
  if (weak) return { ok: false, error: weak, reason: "policy" };
  if (await store.getUserByEmail(email)) return { ok: false, error: "An account with this email already exists. Sign in instead.", reason: "exists" };

  if (process.env.AUTH_DRIVER === "cognito") {
    const { cognitoSignUp } = await import("./cognito");
    const r = await cognitoSignUp(email, input.password, input.name);
    if (!r.ok) return { ok: false, error: r.error, reason: "provider" };
    const user: User = { id: r.sub, email, name: input.name, createdAt: new Date().toISOString() };
    return { ok: true, user: await store.createUser(user) };
  }

  const now = new Date().toISOString();
  const user: User = {
    id: id("usr"),
    email,
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    passwordChangedAt: now,
    createdAt: now,
  };
  return { ok: true, user: await store.createUser(user) };
}

export async function signIn(emailRaw: string, password: string, ipHash: string): Promise<AuthResult> {
  if (!allowIpAttempt(ipHash)) return { ok: false, error: THROTTLED, reason: "throttled" };
  const store = await getStore();
  const email = emailRaw.trim().toLowerCase();
  const existing = await store.getUserByEmail(email);

  if (existing && isLocked(existing)) return { ok: false, error: LOCKED, reason: "locked", user: existing };

  let passed = false;
  let user = existing;
  if (process.env.AUTH_DRIVER === "cognito") {
    const { cognitoSignIn } = await import("./cognito");
    const r = await cognitoSignIn(email, password);
    passed = r.ok;
    if (r.ok && !user) user = await store.createUser({ id: r.sub, email, name: email.split("@")[0], createdAt: new Date().toISOString() });
    if (!r.ok && r.error !== INVALID && !existing) return { ok: false, error: r.error, reason: "provider" };
  } else {
    passed = await verifyPassword(password, existing?.passwordHash ?? (await timingDummy()));
    passed = passed && Boolean(existing?.passwordHash);
  }

  if (!passed || !user) {
    if (!existing) return { ok: false, error: INVALID, reason: "invalid" };
    const next = registerFailure(existing);
    await store.updateUser(existing.id, { loginFailures: next.loginFailures, lockedUntil: next.lockedUntil });
    return { ok: false, error: next.locked ? LOCKED : INVALID, reason: next.locked ? "locked" : "invalid", user: existing, lockedNow: next.locked };
  }

  if (user.loginFailures || user.lockedUntil) user = await store.updateUser(user.id, { loginFailures: undefined, lockedUntil: undefined });
  return { ok: true, user };
}

/** Change a local password after the caller has re-authenticated. */
export async function setPassword(user: User, newPassword: string): Promise<string | null> {
  const weak = checkPassword(newPassword, user.email);
  if (weak) return weak;
  if (user.passwordHash && (await verifyPassword(newPassword, user.passwordHash))) return "Choose a password you haven't used here before.";
  const store = await getStore();
  await store.updateUser(user.id, { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date().toISOString() });
  return null;
}
