import "server-only";
import { revalidatePath } from "next/cache";
import { requireProperty } from "./auth/access";
import { auditSite } from "./site-config";
import { heldTrackers } from "./trackers";
import type { AuditAction, Tracker } from "./types";

/** What publishing would change: the approved inventory, not suggestions or ignored items. */
const liveShape = (list: Tracker[]) => JSON.stringify(heldTrackers(list).map((t) => [t.name, t.pattern, t.category, t.kind ?? "script"]));

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
  const live = liveShape(next) !== liveShape(property.trackers);
  await store.updateProperty(propertyId, {
    trackers: next,
    ...(live ? { config: { ...property.config, version: property.config.version + 1 } } : {}),
  });
  if (audit) await auditSite(ctx, audit.action, audit.metadata?.());
  revalidatePath(`/app/sites/${propertyId}`, "layout");
  return next;
}
