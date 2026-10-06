import type { Framework, Property } from "./types";

// Client-safe: used by the server publisher, the builder preview and the SDK contract.

/**
 * Public, cacheable config the SDK fetches. Contains no tenant-private data.
 * Shape is versioned (`v`) so old cached SDKs keep working.
 */
export interface PublicConfig {
  v: 1;
  siteKey: string;
  version: number;
  theme: Property["config"]["theme"];
  categories: Property["config"]["categories"];
  regions: Partial<Record<Framework, Property["config"]["regions"][Framework]>>;
  trackers: { p: string; c: string }[];
  policyUrl: string;
  headless: boolean;
  gcm: boolean;
  expiryDays: number;
  dpo?: { name: string; email: string };
  /** days to wait before asking again after "reject all" */
  reask: number;
  rights?: Property["config"]["rights"];
  /** report tracker requests that fire after a decline */
  leaks: boolean;
}

export function toPublicConfig(p: Property, dpo?: { name: string; email: string }): PublicConfig {
  const regions = Object.fromEntries(
    Object.entries(p.config.regions).filter(([, r]) => r.enabled),
  ) as PublicConfig["regions"];
  return {
    v: 1,
    siteKey: p.siteKey,
    version: p.config.version,
    theme: p.config.theme,
    categories: p.config.categories,
    regions,
    trackers: p.trackers.map((t) => ({ p: t.pattern, c: t.category })),
    policyUrl: p.config.policyUrl,
    headless: p.config.headless,
    gcm: p.config.googleConsentMode,
    expiryDays: p.config.expiryDays,
    dpo,
    reask: p.config.reaskAfterRejectDays ?? 180,
    rights: p.config.rights,
    leaks: p.config.leakDetection ?? true,
  };
}
