import "server-only";
import { recordAudit } from "./audit";
import { buildConfigVersion } from "./config-versions";
import { evaluateFairness } from "./fairness";
import { publishConfig, toPublicConfig } from "./publish";
import type { Store } from "./store/types";
import { heldTrackers } from "./trackers";
import type { Organization, Property } from "./types";

export type PublishOutcome = { ok: true; version: number } | { ok: false; error: string };

/**
 * Publish a site's current banner config, the one way it's done everywhere (the dashboard's Publish
 * button, and automatically when a site is created): the server-side fairness check, the config on
 * the CDN, an immutable snapshot of the version, the site's published state and an audit event.
 */
export async function publishProperty(
  store: Store,
  property: Property,
  org: Pick<Organization, "id" | "dpo">,
  actor: { userId: string; email: string },
  opts: { automatic?: boolean } = {},
): Promise<PublishOutcome> {
  const fairness = evaluateFairness(property.config, { dpoEmail: org.dpo?.email });
  if (fairness.failures.length) {
    const first = fairness.failures[0];
    const more = fairness.failures.length > 1 ? ` (and ${fairness.failures.length - 1} more)` : "";
    return { ok: false, error: `Can't publish yet: ${first.title}. ${first.detail}${more}` };
  }
  const dpo = org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined;
  await publishConfig(toPublicConfig(property, dpo));
  // the snapshot keeps the approved inventory only: suggestions and ignored items were never live
  const trackers = heldTrackers(property.trackers);
  const publishedAt = new Date().toISOString();
  // Keep an immutable copy of this version so every receipt can show the notice behind it.
  // Write-once: re-publishing an unchanged version keeps the first snapshot.
  await store.saveConfigVersion(buildConfigVersion({ propertyId: property.id, version: property.config.version, config: property.config, trackers, publishedAt, publishedBy: actor.userId }));
  await store.updateProperty(property.id, { publishedVersion: property.config.version, publishedAt, published: { config: property.config, trackers } });
  await recordAudit({
    orgId: org.id,
    actor,
    action: "property.published",
    target: { type: "property", id: property.id, label: property.domain },
    metadata: { version: property.config.version, fairnessScore: fairness.score, ...(opts.automatic ? { automatic: true } : {}) },
  });
  return { ok: true, version: property.config.version };
}
