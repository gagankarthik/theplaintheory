import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { id } from "../crypto";
import { requestContext } from "../request-context";
import { getStore } from "../store";
import type { SessionRecord, StaffIdentity } from "../types";
import { assertPlatform, canPlatform, type PlatformPermission, type PlatformRole } from "./platform";
import { STAFF_CHALLENGE_SECONDS, openChallenge, sealChallenge, type StaffChallenge, type StaffStep } from "./staff-auth";
import {
  STAFF_ABSOLUTE_SECONDS,
  STAFF_CHALLENGE_COOKIE,
  STAFF_COOKIE,
  STAFF_COOKIE_PATH,
  signStaffToken,
  staffCookieOptions,
  staffSessionProblem,
  staffUserKey,
  verifyStaffToken,
} from "./staff-token";

/**
 * Staff console sessions. Separate from customer sessions (session.ts) in every way that matters:
 * - their own cookie (`pt_staff`, path /admin) and token type, so neither can stand in for the other;
 * - server-side records with kind "staff", keyed by "staff:<cognito sub>", holding the identity and
 *   role read from the verified staff-pool ID token at sign-in;
 * - 1-hour idle timeout and 8-hour absolute lifetime.
 * The role is refreshed at every sign-in; staff management revokes a person's sessions whenever their
 * role or status changes, so a change takes effect immediately.
 */

/** Record lastSeenAt at most once a minute. */
const TOUCH_AFTER_MS = 60_000;

export interface StaffSession {
  sid: string;
  staff: StaffIdentity;
  role: PlatformRole;
  record: SessionRecord;
}

/** Start a staff session after a completed Cognito sign-in (password + TOTP). Rotates any previous one. */
export async function createStaffSession(identity: StaffIdentity) {
  const store = await getStore();
  const jar = await cookies();
  const now = new Date();
  const previous = await verifyStaffToken(jar.get(STAFF_COOKIE)?.value);
  if (previous) await store.revokeSession(previous.sid, now.toISOString());
  const ctx = await requestContext();
  const record: SessionRecord = {
    id: id("sst", 24),
    userId: staffUserKey(identity.sub),
    kind: "staff",
    staff: { sub: identity.sub, email: identity.email, name: identity.name, role: identity.role },
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STAFF_ABSOLUTE_SECONDS * 1000).toISOString(),
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
    // The staff pool requires TOTP, so every staff session passed two factors.
    mfaVerified: true,
  };
  await store.createSessionRecord(record);
  const claims = { sid: record.id, sub: identity.sub, abs: Math.floor(Date.parse(record.expiresAt) / 1000) };
  jar.set(STAFF_COOKIE, await signStaffToken(claims), staffCookieOptions(claims));
  jar.delete({ name: STAFF_CHALLENGE_COOKIE, path: STAFF_COOKIE_PATH });
  return record;
}

/**
 * The current staff session, validated against its server-side record. Memoised per request so the
 * layout, page and actions share one lookup.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const claims = await verifyStaffToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!claims) return null;
  const store = await getStore();
  const rec = await store.getSessionRecord(claims.sid);
  if (staffSessionProblem(rec, claims.sub)) return null;
  const now = Date.now();
  if (now - Date.parse(rec!.lastSeenAt) > TOUCH_AFTER_MS) await store.touchSession(rec!.id, new Date(now).toISOString());
  return { sid: rec!.id, staff: rec!.staff!, role: rec!.staff!.role, record: rec! };
});

/** Sign this browser out of the console: revoke the record and clear the cookie. */
export async function destroyStaffSession() {
  const jar = await cookies();
  const claims = await verifyStaffToken(jar.get(STAFF_COOKIE)?.value);
  if (claims) await (await getStore()).revokeSession(claims.sid, new Date().toISOString());
  jar.delete({ name: STAFF_COOKIE, path: STAFF_COOKIE_PATH });
  jar.delete({ name: STAFF_CHALLENGE_COOKIE, path: STAFF_COOKIE_PATH });
}

/** End every console session a staff member has (role change, disable, removal, password reset). */
export async function revokeStaffSessions(sub: string) {
  return (await getStore()).revokeUserSessions(staffUserKey(sub), new Date().toISOString());
}

/* ---------------- sign-in challenge (between the /admin/login pages) ---------------- */

/** The in-progress Cognito challenge, if any (and, given `step`, only when it's at that step). */
export async function getStaffChallenge(step?: StaffStep): Promise<StaffChallenge | null> {
  const c = openChallenge((await cookies()).get(STAFF_CHALLENGE_COOKIE)?.value);
  return c && (!step || c.step === step) ? c : null;
}

/** Seal the challenge (with Cognito's Session) into a short-lived httpOnly cookie. Server Functions only. */
export async function setStaffChallenge(c: Omit<StaffChallenge, "expiresAt">) {
  (await cookies()).set(STAFF_CHALLENGE_COOKIE, sealChallenge(c), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: STAFF_COOKIE_PATH,
    maxAge: STAFF_CHALLENGE_SECONDS,
  });
}

export async function clearStaffChallenge() {
  (await cookies()).delete({ name: STAFF_CHALLENGE_COOKIE, path: STAFF_COOKIE_PATH });
}

export async function staffMetadata(title?: string): Promise<Metadata> {
  return { title: title ?? { default: "Staff console", template: "%s | Staff console" }, robots: { index: false, follow: false } };
}

/**
 * For console pages: the staff session, or a redirect to the staff sign-in. A role without the
 * permission gets the console's not-found page (the nav already hides what a role can't open).
 */
export async function requireStaff(permission?: PlatformPermission): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (permission && !canPlatform(s.role, permission)) notFound();
  return s;
}

/** For staff server actions: throws a plain Error (turned into an ActionResult by failure()). */
export async function requireStaffAction(permission: PlatformPermission): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) throw new Error("Your staff session has ended. Sign in again.");
  assertPlatform(s.role, permission);
  return s;
}
