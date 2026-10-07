"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { getSignedInUser, setActiveOrg } from "@/lib/auth/session";
import { createCheckoutUrl } from "@/lib/billing";
import { id } from "@/lib/crypto";
import { planById } from "@/lib/plans";
import { buildProperty } from "@/lib/properties";
import { getStore } from "@/lib/store";
import { TEAM_SIZES } from "@/lib/types";
import { domainSchema } from "@/lib/validation";

export type OnboardState = ActionResult;

const schema = z
  .object({
    kind: z.enum(["personal", "organization"], "Choose who this workspace is for."),
    org: z.string().trim().min(2, "Name your workspace.").max(80, "Keep the name under 80 characters."),
    teamSize: z.enum(TEAM_SIZES).optional(),
    dataRegion: z.enum(["ap-south-1", "ap-south-2", "eu-central-1", "us-east-1"], "Pick where records are stored."),
    site: z.string().trim().min(2, "Name your first site.").max(60, "Keep the site name under 60 characters."),
    domain: domainSchema,
    plan: z.enum(["free", "starter", "growth", "business"], "Choose a plan."),
    interval: z.enum(["monthly", "annual"]).default("monthly"),
    currency: z.enum(["usd", "eur", "gbp", "inr"]).default("usd"),
  })
  .refine((d) => d.kind === "personal" || d.teamSize, { path: ["teamSize"], message: "Choose your team size." });

const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v !== "" ? v : undefined;
};

export async function createWorkspace(_: OnboardState, form: FormData): Promise<OnboardState> {
  const session = await getSignedInUser();
  if (!session) redirect("/login");
  const parsed = schema.safeParse(
    Object.fromEntries(["kind", "org", "teamSize", "dataRegion", "site", "domain", "plan", "interval", "currency"].map((k) => [k, field(form, k)])),
  );
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const store = await getStore();
  const orgId = id("org");
  // Every workspace starts on Free; a paid plan applies once Stripe confirms the subscription.
  const org = await store.createOrg(
    {
      id: orgId,
      name: d.org,
      kind: d.kind,
      teamSize: d.kind === "organization" ? d.teamSize : undefined,
      plan: "free",
      dataRegion: d.dataRegion,
      createdAt: new Date().toISOString(),
    },
    session.userId,
  );
  const property = await store.createProperty(buildProperty(orgId, d.site, d.domain));
  const actor = { userId: session.userId, email: session.email };
  await recordAudit({ orgId, actor, action: "org.created", target: { type: "org", id: orgId, label: d.org }, metadata: { dataRegion: d.dataRegion, kind: d.kind, plan: d.plan } });
  await recordAudit({ orgId, actor, action: "property.created", target: { type: "property", id: property.id, label: property.domain } });
  await setActiveOrg(orgId);

  const install = `/app/sites/${property.id}/install`;
  if (d.plan === "free") redirect(install);

  const url = await createCheckoutUrl({
    org,
    email: session.email,
    plan: planById(d.plan),
    interval: d.interval,
    currency: d.currency,
    successPath: `${install}?checkout=success`,
    cancelPath: "/app/billing?checkout=cancelled",
  });
  // Checkout not connected (e.g. local dev): the workspace exists on Free; billing explains why.
  redirect(url ?? "/app/billing?error=not-configured");
}
