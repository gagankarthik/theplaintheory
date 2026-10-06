"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { assertCan } from "@/lib/auth/rbac";
import { recordAudit, recordUserAudit } from "@/lib/audit";
import { destroySession, getSession, requireUser, setActiveOrg } from "@/lib/auth/session";
import { planById } from "@/lib/plans";
import { buildProperty } from "@/lib/properties";
import { getStore } from "@/lib/store";
import type { Property } from "@/lib/types";
import { domainSchema } from "@/lib/validation";

/* ---------------- session & org ---------------- */

export async function signOut() {
  const session = await getSession();
  if (session) await recordUserAudit(session.userId, session.email, "auth.logout");
  await destroySession();
  redirect("/login");
}

export async function switchOrg(orgId: string) {
  const { memberships } = await requireUser();
  if (!memberships.some((m) => m.orgId === orgId)) return;
  await setActiveOrg(orgId);
  redirect("/app");
}

/* ---------------- sites ---------------- */

const siteSchema = z.object({
  name: z.string().trim().min(2, "Give the site a name of at least 2 characters.").max(60),
  domain: domainSchema,
});

export async function createSite(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { org, role, user } = await requireUser();
  let property: Property;
  try {
    assertCan(role, "property:write");
    const parsed = siteSchema.safeParse({ name: form.get("name"), domain: form.get("domain") });
    if (!parsed.success) return invalid(parsed.error);
    const store = await getStore();
    const existing = await store.listProperties(org.id);
    const plan = planById(org.plan);
    if (plan.properties !== null && existing.length >= plan.properties) {
      return { error: `The ${plan.name} plan includes ${plan.properties} site${plan.properties > 1 ? "s" : ""}. Upgrade in Billing to add more.` };
    }
    if (existing.some((p) => p.domain === parsed.data.domain)) return { error: `${parsed.data.domain} is already in this organization.` };
    property = await store.createProperty(buildProperty(org.id, parsed.data.name, parsed.data.domain));
    await recordAudit({ orgId: org.id, actor: { userId: user.id, email: user.email }, action: "property.created", target: { type: "property", id: property.id, label: property.domain } });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app");
  redirect(`/app/sites/${property.id}/install`);
}
