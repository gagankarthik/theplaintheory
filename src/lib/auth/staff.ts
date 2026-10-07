import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getStore } from "../store";
import type { SessionRecord, User } from "../types";
import { assertPlatform, resolvePlatformRole, staffMfaProblem, type PlatformPermission, type PlatformRole } from "./platform";
import { getSession, type Session } from "./session";

export type StaffContext =
  | { status: "none" }
  /** staff, but this session can't use the console until two-factor is on and verified */
  | { status: "mfa"; problem: "enroll" | "verify"; user: User; role: PlatformRole }
  | { status: "ok"; session: Session; record: SessionRecord; user: User; role: PlatformRole };

/**
 * Who is asking, as staff. Memoised per request so the layout, page and actions share one lookup.
 * Anything short of a valid session for a user with a platform role is "none": callers respond with
 * notFound() so the console's existence isn't revealed to customers or signed-out visitors.
 */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const session = await getSession();
  if (!session) return { status: "none" };
  const store = await getStore();
  const [user, record] = await Promise.all([store.getUser(session.userId), store.getSessionRecord(session.sid)]);
  if (!user || !record) return { status: "none" };
  const role = resolvePlatformRole(user);
  if (!role) return { status: "none" };
  const problem = staffMfaProblem({ userHasMfa: Boolean(user.mfa), sessionMfaVerified: record.mfaVerified, production: process.env.NODE_ENV === "production" });
  if (problem) return { status: "mfa", problem, user, role };
  return { status: "ok", session, record, user, role };
});

/**
 * Page titles only for staff. Metadata resolves even when the layout 404s, so a static title would
 * tell a customer which console page exists; non-staff get the generic 404 title instead.
 */
export async function staffMetadata(title?: string): Promise<Metadata> {
  const ctx = await getStaffContext();
  if (ctx.status !== "ok") return { robots: { index: false, follow: false } };
  return { title: title ?? { default: "Staff console", template: "%s | Staff console" }, robots: { index: false, follow: false } };
}

/** For console pages: the staff context, or a 404. Optionally checks a permission (also a 404). */
export async function requireStaff(permission?: PlatformPermission) {
  const ctx = await getStaffContext();
  if (ctx.status !== "ok") notFound();
  if (permission) {
    try {
      assertPlatform(ctx.role, permission);
    } catch {
      notFound();
    }
  }
  return ctx;
}

/**
 * For staff server actions: throws a plain Error (turned into an ActionResult by failure()) instead of
 * redirecting. Non-staff get the same message as a missing record, so actions don't confirm the console.
 */
export async function requireStaffAction(permission: PlatformPermission) {
  const ctx = await getStaffContext();
  if (ctx.status === "none") throw new Error("Not found.");
  if (ctx.status === "mfa") throw new Error("Staff actions need a two-factor sign-in. Sign in again with your authenticator.");
  assertPlatform(ctx.role, permission);
  return ctx;
}
