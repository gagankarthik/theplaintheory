"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { getSignedInUser, setActiveOrg } from "@/lib/auth/session";
import { id } from "@/lib/crypto";
import { buildProperty } from "@/lib/properties";
import { getStore } from "@/lib/store";
import { domainSchema } from "@/lib/validation";

export type OnboardState = ActionResult;

const schema = z.object({
  org: z.string().trim().min(2, "Name your organization (your company or agency).").max(80),
  dataRegion: z.enum(["ap-south-1", "ap-south-2", "eu-central-1", "us-east-1"], "Pick where records are stored."),
  site: z.string().trim().min(2, "Name your first site.").max(60),
  domain: domainSchema,
});

export async function createWorkspace(_: OnboardState, form: FormData): Promise<OnboardState> {
  const session = await getSignedInUser();
  if (!session) redirect("/login");
  const parsed = schema.safeParse({
    org: form.get("org"),
    dataRegion: form.get("dataRegion"),
    site: form.get("site"),
    domain: form.get("domain"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const store = await getStore();
  const orgId = id("org");
  await store.createOrg({ id: orgId, name: parsed.data.org, plan: "free", dataRegion: parsed.data.dataRegion, createdAt: new Date().toISOString() }, session.userId);
  const property = await store.createProperty(buildProperty(orgId, parsed.data.site, parsed.data.domain));
  const actor = { userId: session.userId, email: session.email };
  await recordAudit({ orgId, actor, action: "org.created", target: { type: "org", id: orgId, label: parsed.data.org }, metadata: { dataRegion: parsed.data.dataRegion } });
  await recordAudit({ orgId, actor, action: "property.created", target: { type: "property", id: property.id, label: property.domain } });
  await setActiveOrg(orgId);
  redirect(`/app/sites/${property.id}/install`);
}
