import "server-only";
import { revalidatePath } from "next/cache";
import { failure, type ActionResult } from "./action-result";
import { recordAudit } from "./audit";
import { requireProperty } from "./auth/access";
import { configSchema } from "./config-schema";
import type { AuditAction, BannerConfig } from "./types";

type Ctx = Awaited<ReturnType<typeof requireProperty>>;

/** Audit an action on this site, attributed to the signed-in user. */
export const auditSite = (ctx: Ctx, action: AuditAction, metadata?: Record<string, string | number | boolean | null>) =>
  recordAudit({
    orgId: ctx.property.orgId,
    actor: { userId: ctx.user.id, email: ctx.user.email },
    action,
    target: { type: "property", id: ctx.property.id, label: ctx.property.domain },
    metadata,
  });

/**
 * Validate and save a banner draft, recording it in the audit trail under `action`.
 * Lives outside the "use server" files so clients can't choose the audit label.
 */
export async function persistConfig(
  propertyId: string,
  input: Omit<BannerConfig, "version">,
  action: AuditAction,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<ActionResult> {
  try {
    const ctx = await requireProperty(propertyId, "property:write");
    const { property, store } = ctx;
    const parsed = configSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: `${issue.path.join(" › ")}: ${issue.message}` };
    }
    // Essential stays required no matter what the client sends.
    const categories = parsed.data.categories.map((c) => ({ ...c, required: c.id === "essential" }));
    const { regions } = parsed.data;
    if (!regions.generic.enabled) return { error: "The default notice must stay on so every visitor gets one." };
    for (const fw of ["gdpr", "dpdpa"] as const) {
      if (regions[fw].model === "opt-out") return { error: `${fw.toUpperCase()} requires opt-in consent. Switch it back to opt-in.` };
      if (regions[fw].enabled && !parsed.data.theme.equalButtons) {
        return { error: `${fw.toUpperCase()} requires rejecting to be as easy as accepting. Turn equal-weight buttons back on.` };
      }
    }
    await store.updateProperty(propertyId, {
      config: { ...parsed.data, categories, version: property.config.version + 1 },
    });
    await auditSite(ctx, action, { ...metadata, version: property.config.version + 1 });
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/app/sites/${propertyId}`, "layout");
  return { ok: "Draft saved. Publish to send it to your site." };
}

