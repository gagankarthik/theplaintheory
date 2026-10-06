import { SignJWT, jwtVerify } from "jose";

/**
 * Session and MFA-challenge tokens. Shared by the session module and proxy.ts, so it stays free of
 * next/headers and server-only imports.
 *
 * Session policy (SOC 2 CC6.1): the cookie carries a server-side session id plus a short expiry.
 * - Idle timeout: 30 minutes. Each authenticated request slides the expiry forward (proxy.ts).
 * - Absolute lifetime: 12 hours from sign-in, whatever the activity.
 * The server-side record (store) is authoritative for revocation; the token alone never is.
 */
export const SESSION_COOKIE = "pt_session";
export const MFA_COOKIE = "pt_mfa";
export const IDLE_SECONDS = 30 * 60;
export const ABSOLUTE_SECONDS = 12 * 60 * 60;
export const MFA_CHALLENGE_SECONDS = 5 * 60;
/** Re-issue the cookie at most this often while active. */
export const REFRESH_AFTER_SECONDS = 60;

export interface SessionClaims {
  sid: string;
  userId: string;
  email: string;
  orgId?: string;
  /** absolute end of the session, epoch seconds */
  abs: number;
  /** issued at, epoch seconds */
  iat?: number;
}

export function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
}

const nowSec = () => Math.floor(Date.now() / 1000);

export async function signSessionToken(c: Omit<SessionClaims, "iat">) {
  const now = nowSec();
  const exp = Math.min(now + IDLE_SECONDS, c.abs);
  return new SignJWT({ sid: c.sid, userId: c.userId, email: c.email, orgId: c.orgId, abs: c.abs, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.typ !== "session" || typeof payload.sid !== "string" || typeof payload.abs !== "number") return null;
    if (payload.abs <= nowSec()) return null;
    return {
      sid: payload.sid,
      userId: payload.userId as string,
      email: payload.email as string,
      orgId: payload.orgId as string | undefined,
      abs: payload.abs,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export const isValidSessionToken = async (token: string | undefined) => (await verifySessionToken(token)) !== null;

export function sessionCookieOptions(c: Pick<SessionClaims, "abs">) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.min(IDLE_SECONDS, c.abs - nowSec())),
  };
}

/** Short-lived proof that the password step passed; the second factor completes sign-in. */
export async function signMfaChallenge(userId: string, next: string) {
  return new SignJWT({ userId, next, typ: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_CHALLENGE_SECONDS}s`)
    .sign(sessionSecret());
}

export async function verifyMfaChallenge(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.typ !== "mfa" || typeof payload.userId !== "string") return null;
    return { userId: payload.userId, next: typeof payload.next === "string" ? payload.next : "/app" };
  } catch {
    return null;
  }
}
