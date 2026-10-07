import "server-only";
import { getStore } from "../store";
import type { Store } from "../store/types";
import type { Organization, Property, Role, User } from "../types";
import { can, type Permission } from "./rbac";
import { getSession } from "./session";

type Fail = { ok: false; response: Response };
type Guard = { ok: true; user: User; org: Organization; role: Role } | Fail;
type PropertyGuard = { ok: true; user: User; org: Organization; role: Role; property: Property; store: Store } | Fail;

const fail = (error: string, status: number): Fail => ({ ok: false, response: Response.json({ error }, { status }) });

/** True when the organization requires MFA and this user hasn't enrolled (SOC 2 CC6.1). */
export const blockedByMfaPolicy = (org: Organization, user: User) => Boolean(org.security?.requireMfa && !user.mfa);
const MFA_REQUIRED = "This organization requires two-factor sign-in. Turn it on in Account first.";
const SUSPENDED = "This organization is suspended. Contact support@theplaintheory.in.";

/** Route-handler equivalent of requireUser(): returns a JSON error response instead of redirecting. */
export async function guardOrg(permission: Permission): Promise<Guard> {
  const session = await getSession();
  if (!session) return fail("Sign in first.", 401);
  const store = await getStore();
  const user = await store.getUser(session.userId);
  if (!user) return fail("Sign in first.", 401);
  const memberships = await store.listMemberships(user.id);
  const m = memberships.find((x) => x.orgId === session.orgId) ?? memberships[0];
  const org = m ? await store.getOrg(m.orgId) : null;
  if (!m || !org) return fail("No organization.", 404);
  if (org.suspendedAt) return fail(SUSPENDED, 403);
  if (blockedByMfaPolicy(org, user)) return fail(MFA_REQUIRED, 403);
  if (!can(m.role, permission)) return fail("Your role can't do this.", 403);
  return { ok: true, user, org, role: m.role };
}

/** Route-handler equivalent of requireProperty(): role from the property's own organization. */
export async function guardProperty(propertyId: string, permission: Permission, denied = "Your role can't do this."): Promise<PropertyGuard> {
  const session = await getSession();
  if (!session) return fail("Sign in first.", 401);
  const store = await getStore();
  const property = await store.getProperty(propertyId);
  const membership = property ? await store.getMembership(property.orgId, session.userId) : null;
  if (!property || !membership) return fail("Site not found.", 404);
  const [org, user] = await Promise.all([store.getOrg(property.orgId), store.getUser(session.userId)]);
  if (!org || !user) return fail("Site not found.", 404);
  if (org.suspendedAt) return fail(SUSPENDED, 403);
  if (blockedByMfaPolicy(org, user)) return fail(MFA_REQUIRED, 403);
  if (!can(membership.role, permission)) return fail(denied, 403);
  return { ok: true, user, org, role: membership.role, property, store };
}
