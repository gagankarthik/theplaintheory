import "server-only";
import { hashPassword, id, verifyPassword } from "../crypto";
import { getStore } from "../store";
import type { User } from "../types";

/**
 * AUTH_DRIVER=cognito verifies credentials against an AWS Cognito user pool (USER_PASSWORD_AUTH flow,
 * MFA handled by the pool). The default local driver stores scrypt hashes in the data store.
 * Either way the app issues its own short-lived session cookie keyed by our user id.
 */
export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const store = await getStore();
  const email = input.email.trim().toLowerCase();
  if (await store.getUserByEmail(email)) return { ok: false, error: "An account with this email already exists. Sign in instead." };

  if (process.env.AUTH_DRIVER === "cognito") {
    const { cognitoSignUp } = await import("./cognito");
    const r = await cognitoSignUp(email, input.password, input.name);
    if (!r.ok) return r;
    const user: User = { id: r.sub, email, name: input.name, createdAt: new Date().toISOString() };
    return { ok: true, user: await store.createUser(user) };
  }

  const user: User = {
    id: id("usr"),
    email,
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  return { ok: true, user: await store.createUser(user) };
}

export async function signIn(emailRaw: string, password: string): Promise<AuthResult> {
  const store = await getStore();
  const email = emailRaw.trim().toLowerCase();
  const invalid = { ok: false as const, error: "That email and password don't match an account." };

  if (process.env.AUTH_DRIVER === "cognito") {
    const { cognitoSignIn } = await import("./cognito");
    const r = await cognitoSignIn(email, password);
    if (!r.ok) return r;
    const user = (await store.getUserByEmail(email)) ?? (await store.createUser({ id: r.sub, email, name: email.split("@")[0], createdAt: new Date().toISOString() }));
    return { ok: true, user };
  }

  const user = await store.getUserByEmail(email);
  if (!user?.passwordHash) return invalid;
  return (await verifyPassword(password, user.passwordHash)) ? { ok: true, user } : invalid;
}
