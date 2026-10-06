import "server-only";
import { getStore } from "../store";
import type { User } from "../types";
import { open, seal } from "./secret-box";
import { consumeRecoveryCode, generateRecoveryCodes, generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

const PENDING_TTL_MS = 15 * 60_000;

/** Begin enrolment: a fresh secret held as "pending" until the user proves their app has it. */
export async function beginEnrolment(user: User) {
  const secret = generateTotpSecret();
  await (await getStore()).updateUser(user.id, { mfaPending: { secretEnc: seal(secret), createdAt: new Date().toISOString() } });
  return { secret, uri: otpauthUri(secret, user.email) };
}

/** The pending secret, if enrolment is still open. */
export function pendingSecret(user: User) {
  if (!user.mfaPending || Date.now() - Date.parse(user.mfaPending.createdAt) > PENDING_TTL_MS) return null;
  return open(user.mfaPending.secretEnc);
}

/** Confirm enrolment with a code from the app. Returns the one-time recovery codes to show once. */
export async function confirmEnrolment(user: User, code: string) {
  const secret = pendingSecret(user);
  if (!secret) return { ok: false as const, error: "Setup expired. Start again to get a new key." };
  const step = verifyTotp(secret, code);
  if (step === null) return { ok: false as const, error: "That code didn't match. Check the time on your phone and try the newest code." };
  const recovery = generateRecoveryCodes();
  await (await getStore()).updateUser(user.id, {
    mfa: { secretEnc: seal(secret), enabledAt: new Date().toISOString(), recoveryCodes: recovery.hashes, lastStep: step },
    mfaPending: undefined,
  });
  return { ok: true as const, recoveryCodes: recovery.plain };
}

/**
 * Check a second factor: a TOTP code (not reusable within its window) or a single-use recovery code.
 * Persists the replay guard or the consumed recovery code.
 */
export async function verifySecondFactor(user: User, code: string) {
  if (!user.mfa) return { ok: false as const };
  const store = await getStore();
  const step = verifyTotp(open(user.mfa.secretEnc), code, { lastUsedStep: user.mfa.lastStep });
  if (step !== null) {
    await store.updateUser(user.id, { mfa: { ...user.mfa, lastStep: step } });
    return { ok: true as const, method: "totp" as const };
  }
  const remaining = consumeRecoveryCode(user.mfa.recoveryCodes, code);
  if (remaining) {
    await store.updateUser(user.id, { mfa: { ...user.mfa, recoveryCodes: remaining } });
    return { ok: true as const, method: "recovery" as const, remaining: remaining.length };
  }
  return { ok: false as const };
}

export async function disableMfa(user: User) {
  await (await getStore()).updateUser(user.id, { mfa: undefined, mfaPending: undefined });
}

/** Replace all recovery codes (after a fresh second-factor check). */
export async function regenerateRecoveryCodes(user: User) {
  if (!user.mfa) return null;
  const recovery = generateRecoveryCodes();
  await (await getStore()).updateUser(user.id, { mfa: { ...user.mfa, recoveryCodes: recovery.hashes } });
  return recovery.plain;
}
