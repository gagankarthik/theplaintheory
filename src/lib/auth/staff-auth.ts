import { jwtVerify, type JWTVerifyGetKey } from "jose";
import type { StaffIdentity } from "../types";
import { cognitoErrorName } from "./cognito-errors";
import { roleFromGroups } from "./platform";
import { open, seal } from "./secret-box";

/**
 * Pure parts of staff sign-in (staff-cognito.ts does the SDK calls): the sealed challenge cookie,
 * ID-token claim checks and error wording. No SDK, no request, so they're unit-tested.
 */

/* ---------------- challenge cookie ---------------- */

/** The Cognito auth session lasts 3 minutes (the app client's AuthSessionValidity); so does the cookie. */
export const STAFF_CHALLENGE_SECONDS = 3 * 60;

export type StaffStep = "new_password" | "mfa_setup" | "mfa";

export interface StaffChallenge {
  step: StaffStep;
  /** the address they typed, for display and the otpauth label */
  email: string;
  /** Cognito's USERNAME for challenge responses (USER_ID_FOR_SRP; a UUID in this pool) */
  username: string;
  /** Cognito's opaque challenge Session. Never leaves the server unsealed. */
  session: string;
  /** MFA_SETUP only: the TOTP secret from AssociateSoftwareToken, shown once to add to an app */
  secret?: string;
  /** a console path to land on after sign-in */
  next?: string;
  /** epoch ms */
  expiresAt: number;
}

/** AES-256-GCM sealed (secret-box.ts): the cookie value is unreadable and tamper-evident. */
export function sealChallenge(c: Omit<StaffChallenge, "expiresAt">, now = Date.now()): string {
  return seal(JSON.stringify({ v: 1, ...c, expiresAt: now + STAFF_CHALLENGE_SECONDS * 1000 }));
}

export function openChallenge(value: string | undefined, now = Date.now()): StaffChallenge | null {
  if (!value) return null;
  try {
    const c = JSON.parse(open(value)) as Partial<StaffChallenge> & { v?: number };
    if (c.v !== 1 || typeof c.expiresAt !== "number" || c.expiresAt <= now) return null;
    if (c.step !== "new_password" && c.step !== "mfa_setup" && c.step !== "mfa") return null;
    if (typeof c.email !== "string" || typeof c.username !== "string" || typeof c.session !== "string" || !c.session) return null;
    if (c.step === "mfa_setup" && typeof c.secret !== "string") return null;
    return { step: c.step, email: c.email, username: c.username, session: c.session, secret: c.secret, next: typeof c.next === "string" ? c.next : undefined, expiresAt: c.expiresAt };
  } catch {
    return null;
  }
}

/* ---------------- ID token ---------------- */

export const staffIssuer = (region: string, poolId: string) => `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
export const staffJwksUrl = (region: string, poolId: string) => `${staffIssuer(region, poolId)}/.well-known/jwks.json`;

export type StaffTokenResult = { ok: true; identity: StaffIdentity } | { ok: false; reason: "invalid_token" | "no_role" };

/**
 * Verify a staff pool ID token: signature against the pool's JWKS, issuer, audience (the staff app
 * client), token_use = id and expiry; then read who it is and their role from `cognito:groups`.
 */
export async function verifyStaffIdToken(token: string, opts: { jwks: JWTVerifyGetKey; issuer: string; clientId: string; now?: Date }): Promise<StaffTokenResult> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, opts.jwks, { issuer: opts.issuer, audience: opts.clientId, algorithms: ["RS256"], currentDate: opts.now, requiredClaims: ["sub", "exp"] }));
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
  if (payload.token_use !== "id" || typeof payload.sub !== "string" || typeof payload.email !== "string") return { ok: false, reason: "invalid_token" };
  const role = roleFromGroups(payload["cognito:groups"]);
  if (!role) return { ok: false, reason: "no_role" };
  const email = payload.email.toLowerCase();
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0];
  return { ok: true, identity: { sub: payload.sub, email, name, role } };
}

/* ---------------- errors ---------------- */

export const STAFF_INVALID = "That email and password don't match a staff account. If your invite is more than a day old, ask a superadmin to resend it.";
export const STAFF_NO_ROLE = "Your staff account has no console role yet. Ask a superadmin to give you one, then sign in again.";
export const STAFF_SESSION_EXPIRED = "That sign-in step took longer than 3 minutes. Sign in again.";
export const STAFF_CODE_MISMATCH = "That code didn't match. Check the time on your phone and enter the newest 6-digit code.";
export const STAFF_THROTTLED = "Too many attempts. Wait a few minutes and try again.";
export const STAFF_UNAVAILABLE = "Staff sign-in is unavailable right now. Try again in a minute.";
export const STAFF_PASSWORD_RULE = "Use at least 12 characters, including a lowercase letter, a number and a symbol.";

export type StaffAuthOp = "signIn" | "newPassword" | "mfaSetup" | "mfa";

export type StaffFailureKind = "invalid_credentials" | "session_expired" | "code_mismatch" | "password_policy" | "throttled" | "no_role" | "unavailable";

export interface StaffFailure {
  kind: StaffFailureKind;
  message: string;
  /** SDK exception name, for logs only */
  name: string;
}

/**
 * Map a Cognito exception on the staff pool to something the sign-in pages can show. Never says
 * whether an address has a staff account: unknown users, wrong passwords, disabled accounts and
 * expired invites all get the same answer at the password step.
 */
export function classifyStaffError(e: unknown, op: StaffAuthOp): StaffFailure {
  const name = cognitoErrorName(e);
  const msg = e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : "";
  const out = (kind: StaffFailureKind, message: string): StaffFailure => ({ kind, message, name });
  switch (name) {
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return out("throttled", STAFF_THROTTLED);
    case "InvalidPasswordException":
      return out("password_policy", STAFF_PASSWORD_RULE);
    case "PasswordHistoryPolicyViolationException":
      return out("password_policy", "Choose a password you haven't used here before.");
    case "CodeMismatchException":
    case "EnableSoftwareTokenMFAException":
      return out("code_mismatch", STAFF_CODE_MISMATCH);
    case "ExpiredCodeException":
      return op === "mfa" || op === "mfaSetup" ? out("code_mismatch", STAFF_CODE_MISMATCH) : out("session_expired", STAFF_SESSION_EXPIRED);
    case "UserNotFoundException":
    case "UserNotConfirmedException":
    case "PasswordResetRequiredException":
      return op === "signIn" ? out("invalid_credentials", STAFF_INVALID) : out("session_expired", STAFF_SESSION_EXPIRED);
    case "NotAuthorizedException":
      if (/attempts exceeded/i.test(msg)) return out("throttled", STAFF_THROTTLED);
      if (/session/i.test(msg)) return out("session_expired", STAFF_SESSION_EXPIRED);
      if (op === "signIn") return out("invalid_credentials", STAFF_INVALID);
      if (op === "mfa" || op === "mfaSetup") return /code/i.test(msg) ? out("code_mismatch", STAFF_CODE_MISMATCH) : out("session_expired", STAFF_SESSION_EXPIRED);
      return out("session_expired", STAFF_SESSION_EXPIRED);
    case "InvalidParameterException":
      if (op === "signIn") return out("invalid_credentials", STAFF_INVALID);
      if (op === "newPassword" && /password/i.test(msg)) return out("password_policy", STAFF_PASSWORD_RULE);
      if (op === "mfa" || op === "mfaSetup") return out("code_mismatch", STAFF_CODE_MISMATCH);
      return out("session_expired", STAFF_SESSION_EXPIRED);
    default:
      return out("unavailable", STAFF_UNAVAILABLE);
  }
}

/** A 6-digit TOTP code, with spaces removed; null when it isn't one. */
export function normaliseTotp(input: unknown): string | null {
  const digits = typeof input === "string" ? input.replace(/[\s-]/g, "") : "";
  return /^\d{6}$/.test(digits) ? digits : null;
}
