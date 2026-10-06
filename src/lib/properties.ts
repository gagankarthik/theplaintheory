import { randomBytes } from "node:crypto";
import { id } from "./crypto";
import { defaultConfig } from "./defaults";
import type { Property } from "./types";

/** A new, unpublished property with compliant defaults. */
export function buildProperty(orgId: string, name: string, domain: string): Property {
  const now = new Date().toISOString();
  return {
    id: id("prop"),
    orgId,
    name,
    domain,
    siteKey: `pk_${randomBytes(12).toString("base64url")}`,
    config: defaultConfig(domain),
    trackers: [],
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
}
