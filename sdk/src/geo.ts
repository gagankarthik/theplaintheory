import type { Framework, PublicConfig } from "./types";

// Mirrors src/lib/geo.ts frameworkFor(). Kept separate so the SDK has no server imports.
const EEA = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH";

export function frameworkFor(country: string, region: string, cfg: PublicConfig): Framework {
  const c = country.toUpperCase();
  let f: Framework = "generic";
  if (c.length === 2 && EEA.includes(c)) f = "gdpr";
  else if (c === "IN") f = "dpdpa";
  else if (c === "US" && region.toUpperCase() === "CA") f = "ccpa";
  return cfg.regions[f] ? f : "generic";
}
