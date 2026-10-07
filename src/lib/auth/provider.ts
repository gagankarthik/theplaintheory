import "server-only";
import { hashPassword, id, verifyPassword } from "../crypto";
import { getStore } from "../store";
import type { User } from "../types";
import { INVALID_CREDENTIALS, cognitoPasswordProblem } from "./cognito-errors";
import { allowIpAttempt, isLocked, registerFailure } from "./lockout";
import { checkPassword } from "./password-policy";

/**
 * Who verifies a password. AUTH_DRIVER=cognito uses the Amazon Cognito user pool (sign-up with an
 * e-mailed code, USER_PASSWORD_AUTH, resets by e-mail); the default local driver keeps scrypt hashes
 * in the data store for offline development and tests. Either way the app then runs its own TOTP
 * second factor, lockout and RBAC, and issues its own server-side session keyed by our user id.
 */
export const isCognito = () => process.env.AUTH_DRIVER === "cognito";

export type AuthResult =
  | { ok: true; user: User }
  | {
      ok: false;
      error: string;
      reason: "invalid" | "locked" | "throttled" | "policy" | "exists" | "provider" | "unconfirmed" | "reset_required";
      user?: User;
      lockedNow?: boolean;
    };

export { INVALID_CREDENTIALS };
const INVALID = INVALID_CREDENTIALS;
const LOCKED = "Too many failed attempts. Sign-in for this account is paused for 15 minutes.";
const THROTTLED = "Too many sign-in attempts from your network. Wait 15 minutes and try again.";

/** The hint shown under new-password fields, matching the active driver's rules. */
export const passwordHint = () =>
  isCognito() ? "At least 12 characters, with a lowercase letter, a number and a symbol. Avoid common passwords and your email name." : "At least 12 characters. Avoid common passwords and your email name.";

/** App policy (length, breach list, email name) plus, with Cognito, the pool's composition rule. */
export function passwordProblem(password: string, email: string): string | null {
  return checkPassword(password, email) ?? (isCognito() ? cognitoPasswordProblem(password) : null);
}

/** A real scrypt hash so unknown emails cost the same time as known ones (no account enumeration by timing). */
let dummyHash: Promise<string> | null = null;
const timingDummy = () => (dummyHash ??= hashPassword("timing-equaliser-not-a-real-password"));

/**
 * Local driver: create the user and return it, ready for a session.
 * Cognito driver: create the pool user (Cognito e-mails a code) and a store record linked by `sub`;
 * returns `pending: true` because nobody is signed in until the code is confirmed.
 */
export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthResult & { pending?: boolean }> {
  const store = await getStore();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const weak = passwordProblem(input.password, email);
  if (weak) return { ok: false, error: weak, reason: "policy" };

  if (isCognito()) {
    const { cognitoRegister } = await import("./cognito");
    const r = await cognitoRegister(email, input.password, name);
    if (!r.ok) {
      const reason = r.failure.kind === "exists" ? "exists" : r.failure.kind === "password_policy" ? "policy" : "provider";
      return { ok: false, error: r.failure.message, reason };
    }
    // An existing record (an earlier unconfirmed attempt, or an account from before Cognito) is
    // re-linked at its first successful sign-in, after the inbox has been proved.
    const existing = await store.getUserByEmail(email);
    if (existing) return { ok: true, user: existing, pending: true };
    const user: User = { id: id("usr"), email, name, cognitoSub: r.sub, createdAt: new Date().toISOString() };
    return { ok: true, user: await store.createUser(user), pending: true };
  }

  if (await store.getUserByEmail(email)) return { ok: false, error: "An account with this email already exists. Sign in instead.", reason: "exists" };
  const now = new Date().toISOString();
  const user: User = {
    id: id("usr"),
    email,
    name,
    passwordHash: await hashPassword(input.password),
    passwordChangedAt: now,
    createdAt: now,
  };
  return { ok: true, user: await store.createUser(user) };
}

/**
 * Find or create the store user for a Cognito identity, matched by e-mail (Cognito's username, unique
 * and case-insensitive in the pool), and keep `cognitoSub` current.
 */
export async function linkCognitoUser(identity: { sub: string; email: string; name?: string }): Promise<User> {
  const store = await getStore();
  const email = identity.email.toLowerCase();
  const existing = await store.getUserByEmail(email);
  if (!existing) {
    return store.createUser({ id: id("usr"), email, name: identity.name?.trim() || email.split("@")[0], cognitoSub: identity.sub, createdAt: new Date().toISOString() });
  }
  return existing.cognitoSub === identity.sub ? existing : store.updateUser(existing.id, { cognitoSub: identity.sub });
}

export async function signIn(emailRaw: string, password: string, ipHash: string): Promise<AuthResult> {
  if (!(await allowIpAttempt(ipHash))) return { ok: false, error: THROTTLED, reason: "throttled" };
  const store = await getStore();
  const email = emailRaw.trim().toLowerCase();
  const existing = await store.getUserByEmail(email);

  if (existing && isLocked(existing)) return { ok: false, error: LOCKED, reason: "locked", user: existing };

  let passed = false;
  let user = existing;
  if (isCognito()) {
    const { cognitoSignIn } = await import("./cognito");
    const r = await cognitoSignIn(email, password);
    if (r.ok) {
      passed = true;
      user = await linkCognitoUser(r.identity);
    } else if (r.failure.kind === "unconfirmed") {
      // Only reachable with the right password, so saying so reveals nothing.
      return { ok: false, error: r.failure.message, reason: "unconfirmed", user: existing ?? undefined };
    } else if (r.failure.kind === "reset_required") {
      return { ok: false, error: r.failure.message, reason: "reset_required", user: existing ?? undefined };
    } else if (r.failure.kind === "throttled") {
      return { ok: false, error: r.failure.message, reason: "throttled", user: existing ?? undefined };
    } else if (r.failure.kind !== "invalid_credentials") {
      return { ok: false, error: r.failure.message, reason: "provider" };
    }
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

/**
 * With Cognito, also invalidate the user's Cognito refresh tokens when the app signs them out
 * everywhere. Returns a sentence to add to the action's message when that part failed, else "".
 */
export async function providerSignOutEverywhere(email: string): Promise<string> {
  if (!isCognito()) return "";
  const { cognitoGlobalSignOut } = await import("./cognito");
  const r = await cognitoGlobalSignOut(email);
  return r.status === "failed" ? " Cognito couldn't be reached to revoke its tokens; app sessions are signed out regardless." : "";
}
