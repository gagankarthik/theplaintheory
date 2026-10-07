import { SignJWT, jwtVerify } from "jose";
import type { SessionRecord } from "../types";
import { isPlatformRole } from "./platform";
import { sessionSecret } from "./token";

/**
 * Staff console session cookie. Separate from the customer session (token.ts): its own cookie name,
 * token type, path and lifetimes, so a customer session can never open /admin and a staff session
 * never opens /app. Free of next/headers and server-only imports: proxy.ts uses it too.
 *
 * Policy: 1-hour idle timeout (sliding, re-issued by the proxy) and an 8-hour absolute lifetime, the
 * same as the staff pool's refresh-token validity. The server-side record (kind "staff") is
 * authoritative for revocation; the token alone never is.
 */
export const STAFF_COOKIE = "pt_staff";
/** Holds the in-progress Cognito challenge between the sign-in pages (sealed, see staff-challenge.ts). */
export const STAFF_CHALLENGE_COOKIE = "pt_staff_auth";
/** Both cookies are only sent to the console. */
export const STAFF_COOKIE_PATH = "/admin";
export const STAFF_IDLE_SECONDS = 60 * 60;
export const STAFF_ABSOLUTE_SECONDS = 8 * 60 * 60;
/** Re-issue the cookie at most this often while active. */
export const STAFF_REFRESH_AFTER_SECONDS = 60;

export interface StaffSessionClaims {
  sid: string;
  /** Cognito sub in the staff pool */
  sub: string;
  /** absolute end of the session, epoch seconds */
  abs: number;
  /** issued at, epoch seconds */
  iat?: number;
}

const nowSec = () => Math.floor(Date.now() / 1000);

export async function signStaffToken(c: Omit<StaffSessionClaims, "iat">) {
  const now = nowSec();
  return new SignJWT({ sid: c.sid, sub: c.sub, abs: c.abs, typ: "staff" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(Math.min(now + STAFF_IDLE_SECONDS, c.abs))
    .sign(sessionSecret());
}

export async function verifyStaffToken(token: string | undefined): Promise<StaffSessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.typ !== "staff" || typeof payload.sid !== "string" || typeof payload.sub !== "string" || typeof payload.abs !== "number") return null;
    if (payload.abs <= nowSec()) return null;
    return { sid: payload.sid, sub: payload.sub, abs: payload.abs, iat: payload.iat };
  } catch {
    return null;
  }
}

export function staffCookieOptions(c: Pick<StaffSessionClaims, "abs">) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: STAFF_COOKIE_PATH,
    maxAge: Math.max(0, Math.min(STAFF_IDLE_SECONDS, c.abs - nowSec())),
  };
}

/** The session-record key for a staff member: their sessions are listed and revoked under it. */
export const staffUserKey = (sub: string) => `staff:${sub}`;

/** Where to go after sign-in: a console path, never the sign-in pages or another origin. */
export function safeStaffNext(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  if (!(s === "/admin" || s.startsWith("/admin/") || s.startsWith("/admin?"))) return "/admin";
  if (s.startsWith("//") || s.includes("\\") || s === "/admin/login" || s.startsWith("/admin/login/") || s.startsWith("/admin/login?")) return "/admin";
  return s;
}

/** Why a staff session record no longer counts, or null when it's valid. Pure. */
export function staffSessionProblem(rec: SessionRecord | null, sub: string, now = Date.now()) {
  if (!rec || rec.kind !== "staff" || !rec.staff) return "missing";
  if (rec.staff.sub !== sub || rec.userId !== staffUserKey(sub)) return "mismatch";
  if (!isPlatformRole(rec.staff.role)) return "missing";
  if (rec.revokedAt) return "revoked";
  if (Date.parse(rec.expiresAt) <= now) return "expired";
  if (now - Date.parse(rec.lastSeenAt) > STAFF_IDLE_SECONDS * 1000) return "idle";
  return null;
}
