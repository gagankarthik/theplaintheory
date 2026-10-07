import type { Organization, Passkey, User, UserMfa, WebAuthnChallenge } from "../types";

/**
 * Pure rules for two-factor sign-in: which factors a user has, the org policy with its grace period,
 * the optional prompt, WebAuthn challenges and the relying party. No I/O, so it's unit-tested.
 */

const DAY_MS = 86_400_000;
/** How long a member of a requiring organization may skip setup, from the first time they're asked. */
export const MFA_GRACE_MS = 7 * DAY_MS;
/** How long the optional "Protect your account" prompt stays away after "Skip for now". */
export const MFA_PROMPT_SNOOZE_MS = 30 * DAY_MS;
/** A WebAuthn challenge is good for one ceremony within this window. */
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60_000;

/* ---------------- factors ---------------- */

export const hasTotp = (mfa: UserMfa | undefined) => Boolean(mfa?.secretEnc);
export const passkeysOf = (mfa: UserMfa | undefined): Passkey[] => mfa?.passkeys ?? [];
/** Authenticator app (0 or 1) plus passkeys. */
export const factorCount = (mfa: UserMfa | undefined) => (hasTotp(mfa) ? 1 : 0) + passkeysOf(mfa).length;
/** Two-factor is on: at least one factor. `user.mfa` is kept in step with this. */
export const hasSecondFactor = (user: Pick<User, "mfa">) => factorCount(user.mfa) > 0;

export type Factor = { kind: "totp" } | { kind: "passkey"; id: string };

/**
 * The record after removing one factor, or undefined when nothing is left (two-factor is then off
 * and the recovery codes go with it).
 */
export function withoutFactor(mfa: UserMfa, factor: Factor): UserMfa | undefined {
  const next: UserMfa =
    factor.kind === "totp"
      ? { ...mfa, secretEnc: undefined, lastStep: undefined }
      : { ...mfa, passkeys: passkeysOf(mfa).filter((p) => p.id !== factor.id) };
  if (!next.secretEnc) delete next.secretEnc;
  if (next.lastStep === undefined) delete next.lastStep;
  if (next.passkeys && !next.passkeys.length) delete next.passkeys;
  return factorCount(next) ? next : undefined;
}

/** The record after adding a passkey. A first factor starts two-factor with the given recovery code hashes. */
export function withPasskey(mfa: UserMfa | undefined, passkey: Passkey, newRecoveryHashes: string[], now = new Date()): UserMfa {
  if (mfa) return { ...mfa, passkeys: [...passkeysOf(mfa), passkey] };
  return { enabledAt: now.toISOString(), recoveryCodes: newRecoveryHashes, passkeys: [passkey] };
}

/* ---------------- organization policy ---------------- */

export type MfaRequirement = "ok" | "deferred" | "required";

/**
 * One answer for every enforcement point (requireUser, requireProperty, the app layout and route guards):
 * - "ok": the org doesn't require two-factor, or the member has it.
 * - "deferred": required, but the member chose "Skip for now" and the grace period hasn't ended.
 * - "required": send them to set it up (they may still be offered "Skip for now"; see canSkipMfaSetup).
 */
export function mfaRequirementState(
  org: Pick<Organization, "security">,
  user: Pick<User, "mfa" | "mfaSetupDeferredUntil" | "mfaSetupSkippedAt">,
  now = Date.now(),
): MfaRequirement {
  if (!org.security?.requireMfa || hasSecondFactor(user)) return "ok";
  if (user.mfaSetupSkippedAt && user.mfaSetupDeferredUntil && now < Date.parse(user.mfaSetupDeferredUntil)) return "deferred";
  return "required";
}

/** The grace deadline: the stored one, or 7 days from now for a member being asked for the first time. */
export const mfaSetupDeadline = (user: Pick<User, "mfaSetupDeferredUntil">, now = Date.now()) =>
  user.mfaSetupDeferredUntil ?? new Date(now + MFA_GRACE_MS).toISOString();

/** "Skip for now" is offered until the deadline (or before one is set). */
export const canSkipMfaSetup = (user: Pick<User, "mfaSetupDeferredUntil">, now = Date.now()) =>
  !user.mfaSetupDeferredUntil || now < Date.parse(user.mfaSetupDeferredUntil);

/** Show the optional, dismissible prompt: no two-factor yet and not dismissed in the last 30 days. */
export const showMfaPrompt = (user: Pick<User, "mfa" | "mfaPromptDismissedAt">, now = Date.now()) =>
  !hasSecondFactor(user) && (!user.mfaPromptDismissedAt || now - Date.parse(user.mfaPromptDismissedAt) >= MFA_PROMPT_SNOOZE_MS);

/* ---------------- WebAuthn ---------------- */

/** The stored challenge when it's for this ceremony and still fresh, else null. Callers clear it either way. */
export function liveChallenge(stored: WebAuthnChallenge | undefined, purpose: WebAuthnChallenge["purpose"], now = Date.now()) {
  if (!stored || stored.purpose !== purpose) return null;
  const age = now - Date.parse(stored.createdAt);
  return age >= 0 && age <= WEBAUTHN_CHALLENGE_TTL_MS ? stored.challenge : null;
}

/** Relying party ID: the site's hostname without a leading "www." (theplaintheory.in, localhost). */
export function rpIdFor(siteUrl: string) {
  return new URL(siteUrl).hostname.replace(/^www\./, "");
}

/** Origins a passkey ceremony may come from: the site origin plus its www/apex twin. */
export function expectedOriginsFor(siteUrl: string) {
  const u = new URL(siteUrl);
  const origins = [u.origin];
  const isIp = /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":");
  if (u.hostname !== "localhost" && !isIp) {
    const twin = new URL(u.origin);
    twin.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
    origins.push(twin.origin);
  }
  return origins;
}
