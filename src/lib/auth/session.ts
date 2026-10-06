import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { id } from "../crypto";
import { requestContext } from "../request-context";
import { getStore } from "../store";
import type { SessionRecord } from "../types";
import {
  ABSOLUTE_SECONDS,
  IDLE_SECONDS,
  MFA_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "./token";

export { SESSION_COOKIE, MFA_COOKIE };

export interface Session {
  sid: string;
  userId: string;
  email: string;
  /** currently selected organization */
  orgId?: string;
}

/** Record lastSeenAt at most once a minute, so reads don't turn into a write per request. */
const TOUCH_AFTER_MS = 60_000;

/**
 * Start a new server-side session and set its cookie. Called on sign-in and after MFA, so the
 * session id always rotates at a privilege change. Any session the browser already had is revoked.
 */
export async function createSession(input: { userId: string; email: string; orgId?: string }, opts: { mfaVerified?: boolean } = {}) {
  const store = await getStore();
  const jar = await cookies();
  const previous = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  const now = new Date();
  if (previous) await store.revokeSession(previous.sid, now.toISOString());

  const ctx = await requestContext();
  const record: SessionRecord = {
    id: id("ses", 24),
    userId: input.userId,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ABSOLUTE_SECONDS * 1000).toISOString(),
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
    mfaVerified: Boolean(opts.mfaVerified),
  };
  await store.createSessionRecord(record);
  const claims = { sid: record.id, userId: input.userId, email: input.email, orgId: input.orgId, abs: Math.floor(Date.parse(record.expiresAt) / 1000) };
  jar.set(SESSION_COOKIE, await signSessionToken(claims), sessionCookieOptions(claims));
  jar.delete(MFA_COOKIE);
  await store.updateUser(input.userId, { lastActiveAt: record.createdAt });
  return record;
}

/** Change the active organization without rotating the session. */
export async function setActiveOrg(orgId: string) {
  const jar = await cookies();
  const claims = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return;
  const next = { ...claims, orgId };
  jar.set(SESSION_COOKIE, await signSessionToken(next), sessionCookieOptions(next));
}

/** Why a session record no longer counts, or null when it's valid. */
export function sessionProblem(rec: SessionRecord | null, now = Date.now()) {
  if (!rec) return "missing";
  if (rec.revokedAt) return "revoked";
  if (Date.parse(rec.expiresAt) <= now) return "expired";
  if (now - Date.parse(rec.lastSeenAt) > IDLE_SECONDS * 1000) return "idle";
  return null;
}

/**
 * The current session, validated against its server-side record: unknown, revoked, expired or idle
 * sessions return null. This is the authoritative check; the proxy only does a fast token check.
 */
export async function getSession(): Promise<Session | null> {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const store = await getStore();
  const rec = await store.getSessionRecord(claims.sid);
  if (sessionProblem(rec) || rec!.userId !== claims.userId) return null;
  const now = Date.now();
  if (now - Date.parse(rec!.lastSeenAt) > TOUCH_AFTER_MS) {
    const iso = new Date(now).toISOString();
    await store.touchSession(rec!.id, iso);
    await store.updateUser(rec!.userId, { lastActiveAt: iso }).catch(() => undefined);
  }
  return { sid: claims.sid, userId: claims.userId, email: claims.email, orgId: claims.orgId };
}

/** Sign out this browser: revoke the record and clear the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const claims = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (claims) await (await getStore()).revokeSession(claims.sid, new Date().toISOString());
  jar.delete(SESSION_COOKIE);
}

/**
 * For server components and actions inside /app: the user and active org, or a redirect.
 * When the organization requires MFA and this user hasn't enrolled, everything except the account
 * page redirects to enrolment (pass `allowWithoutMfa` from the account page and its actions).
 */
export async function requireUser(opts: { allowWithoutMfa?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const store = await getStore();
  const user = await store.getUser(session.userId);
  if (!user) redirect("/login");
  const memberships = await store.listMemberships(user.id);
  const active = memberships.find((m) => m.orgId === session.orgId) ?? memberships[0];
  if (!active) redirect("/onboarding");
  const org = await store.getOrg(active.orgId);
  if (!org) redirect("/onboarding");
  if (org.security?.requireMfa && !user.mfa && !opts.allowWithoutMfa) redirect("/app/account?mfa=required");
  return { session, user, org, role: active.role, memberships };
}

/** Session plus a user that still exists (a stale cookie after a data reset returns null). */
export async function getSignedInUser() {
  const session = await getSession();
  if (!session) return null;
  return (await (await getStore()).getUser(session.userId)) ? session : null;
}
