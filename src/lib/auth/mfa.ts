import "server-only";
import { getStore } from "../store";
import type { User, UserMfa } from "../types";
import { open, seal } from "./secret-box";
import { withoutFactor, type Factor } from "./second-factor";
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

/**
 * Confirm enrolment with a code from the app. When this is the first factor, two-factor turns on and
 * the one-time recovery codes come back to show once; alongside passkeys, the existing codes stay.
 */
export async function confirmEnrolment(user: User, code: string) {
  const secret = pendingSecret(user);
  if (!secret) return { ok: false as const, error: "Setup expired. Start again to get a new key." };
  const step = verifyTotp(secret, code);
  if (step === null) return { ok: false as const, error: "That code didn't match. Check the time on your phone and try the newest code." };
  // Decided before the write: the local store hands back its live record.
  const firstFactor = !user.mfa;
  const recovery = firstFactor ? generateRecoveryCodes() : null;
  const mfa: UserMfa = user.mfa
    ? { ...user.mfa, secretEnc: seal(secret), lastStep: step }
    : { secretEnc: seal(secret), enabledAt: new Date().toISOString(), recoveryCodes: recovery!.hashes, lastStep: step };
  await (await getStore()).updateUser(user.id, { mfa, mfaPending: undefined, ...SETUP_DONE });
  return { ok: true as const, firstFactor, recoveryCodes: recovery?.plain };
}

/** Grace-period and prompt bookkeeping that no longer matters once a factor exists. */
export const SETUP_DONE = { mfaSetupDeferredUntil: undefined, mfaSetupSkippedAt: undefined, mfaPromptDismissedAt: undefined } as const;

/**
 * Check a second factor: a TOTP code (not reusable within its window) or a single-use recovery code.
 * Persists the replay guard or the consumed recovery code.
 */
export async function verifySecondFactor(user: User, code: string) {
  if (!user.mfa) return { ok: false as const };
  const store = await getStore();
  // Passkey-only accounts have no authenticator secret; only a recovery code can match then.
  const step = user.mfa.secretEnc ? verifyTotp(open(user.mfa.secretEnc), code, { lastUsedStep: user.mfa.lastStep }) : null;
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

/**
 * Remove one factor. Removing the last one turns two-factor off (and the recovery codes stop working).
 * Returns whether two-factor is still on.
 */
export async function removeFactor(user: User, factor: Factor) {
  if (!user.mfa) return { stillOn: false };
  const mfa = withoutFactor(user.mfa, factor);
  await (await getStore()).updateUser(user.id, mfa ? { mfa } : { mfa: undefined, mfaPending: undefined });
  return { stillOn: Boolean(mfa) };
}

/** Replace all recovery codes (after a fresh second-factor check). */
export async function regenerateRecoveryCodes(user: User) {
  if (!user.mfa) return null;
  const recovery = generateRecoveryCodes();
  await (await getStore()).updateUser(user.id, { mfa: { ...user.mfa, recoveryCodes: recovery.hashes } });
  return recovery.plain;
}
