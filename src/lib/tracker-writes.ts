import "server-only";
import { revalidatePath } from "next/cache";
import { requireProperty } from "./auth/access";
import { auditSite } from "./site-config";
import { trackerPatch } from "./trackers";
import type { AuditAction, Tracker } from "./types";

/**
 * Change a site's tracker list (needs property:write). The draft version moves on only when the
 * approved inventory changes, so triaging suggestions doesn't mark the banner as unpublished.
 * Returns the list the change produced.
 */
export async function writeTrackers(
  propertyId: string,
  fn: (t: Tracker[]) => Tracker[],
  audit: { action: AuditAction; metadata?: () => Record<string, string | number | boolean | null> } | null,
): Promise<Tracker[]> {
  const ctx = await requireProperty(propertyId, "property:write");
  const { property, store } = ctx;
  const next = fn(property.trackers);
  await store.updateProperty(propertyId, trackerPatch(property, next));
  if (audit) await auditSite(ctx, audit.action, audit.metadata?.());
  revalidatePath(`/app/sites/${propertyId}`, "layout");
  return next;
}
