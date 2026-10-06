import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "../store";

export const SESSION_COOKIE = "pt_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
}

export interface Session {
  userId: string;
  email: string;
  /** currently selected organization */
  orgId?: string;
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.userId as string, email: payload.email as string, orgId: payload.orgId as string | undefined };
  } catch {
    return null;
  }
}

export async function getSession() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** For server components/actions inside /app: returns the user and the active org or redirects. */
export async function requireUser() {
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
  return { session, user, org, role: active.role, memberships };
}
