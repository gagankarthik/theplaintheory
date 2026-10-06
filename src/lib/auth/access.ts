import "server-only";
import { notFound, redirect } from "next/navigation";
import { getStore } from "../store";
import { assertCan, type Permission } from "./rbac";
import { requireUser } from "./session";

/**
 * Load a property for the signed-in user. The role comes from the membership of the
 * property's own organization, so agency users with several orgs get the right permissions.
 */
export async function requireProperty(propertyId: string, permission: Permission = "property:read") {
  const ctx = await requireUser();
  const store = await getStore();
  const property = await store.getProperty(propertyId);
  if (!property) notFound();
  const membership = ctx.memberships.find((m) => m.orgId === property.orgId);
  if (!membership) notFound();
  assertCan(membership.role, permission);
  const org = property.orgId === ctx.org.id ? ctx.org : (await store.getOrg(property.orgId))!;
  if (org.security?.requireMfa && !ctx.user.mfa) redirect("/app/account?mfa=required");
  return { ...ctx, org, role: membership.role, property, store };
}
