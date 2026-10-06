"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

const orgSchema = z.object({
  name: z.string().trim().min(2, "Organization name needs at least 2 characters.").max(80),
  dataRegion: z.enum(["ap-south-1", "ap-south-2", "eu-central-1", "us-east-1"], "Pick a storage region."),
  dpoName: z.string().trim().max(80),
  dpoEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Use an email address under 254 characters.")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter the DPO's email, like dpo@company.com."),
  dpoAddress: z.string().trim().max(300),
});

export async function updateOrgSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "org:settings");
    const parsed = orgSchema.safeParse({
      name: form.get("name"),
      dataRegion: form.get("dataRegion"),
      dpoName: form.get("dpoName") ?? "",
      dpoEmail: form.get("dpoEmail") ?? "",
      dpoAddress: form.get("dpoAddress") ?? "",
    });
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    if (Boolean(d.dpoName) !== Boolean(d.dpoEmail)) {
      const msg = "Give the DPO both a name and an email, or leave both empty.";
      return { error: msg, fieldErrors: d.dpoName ? { dpoEmail: [msg] } : { dpoName: [msg] } };
    }
    await (await getStore()).updateOrg(org.id, {
      name: d.name,
      dataRegion: d.dataRegion,
      dpo: d.dpoName ? { name: d.dpoName, email: d.dpoEmail, address: d.dpoAddress || undefined } : undefined,
    });
    const changed = [
      d.name !== org.name && "name",
      d.dataRegion !== org.dataRegion && "dataRegion",
      (d.dpoName !== (org.dpo?.name ?? "") || d.dpoEmail !== (org.dpo?.email ?? "") || d.dpoAddress !== (org.dpo?.address ?? "")) && "dpo",
    ].filter(Boolean);
    await recordAudit({
      orgId: org.id,
      actor: { userId: user.id, email: user.email },
      action: "org.settings_updated",
      target: { type: "org", id: org.id, label: d.name },
      metadata: { changed: changed.join(" ") || "none" },
    });
    revalidatePath("/app", "layout");
    return { ok: "Settings saved. Republish your sites so DPDPA notices show the new DPO details." };
  } catch (e) {
    return failure(e);
  }
}

/** Organization security policy (owner only). Requiring MFA sends un-enrolled members to enrol. */
export async function updateSecuritySettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { org, role, user } = await requireUser();
    assertCan(role, "security:manage");
    const requireMfa = form.get("requireMfa") === "on";
    if (requireMfa && !user.mfa) return { error: "Turn on two-factor for your own account first (Account), so you aren't locked out." };
    if (Boolean(org.security?.requireMfa) === requireMfa) return { ok: "No change." };
    await (await getStore()).updateOrg(org.id, { security: { ...org.security, requireMfa } });
    await recordAudit({
      orgId: org.id,
      actor: { userId: user.id, email: user.email },
      action: "org.security_updated",
      target: { type: "org", id: org.id, label: org.name },
      metadata: { requireMfa },
    });
    revalidatePath("/app", "layout");
    return { ok: requireMfa ? "Two-factor is now required. Members without it are asked to set it up next time they open the app." : "Two-factor is now optional." };
  } catch (e) {
    return failure(e);
  }
}
