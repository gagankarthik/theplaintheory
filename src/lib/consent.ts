import "server-only";
import { z } from "zod";
import { anonymizeIp, id } from "./crypto";
import { parseUserAgent, viewerLocation } from "./geo";
import { toPublicConfig, type PublicConfig } from "./public-config";
import { getStore } from "./store";
import type { CategoryId, ConsentReceipt, LeakReport, Organization, Property } from "./types";
import { dispatchWebhooks, subscribers, webhooksEnabled } from "./webhooks";

/** Replace identifier-like path segments (emails, long numbers, UUIDs, tokens) before a leak report is stored. */
export function redactPath(path: string) {
  return path
    .split("/")
    .map((seg) => (/@|%40|\d{4,}|^[\w-]{24,}$/.test(seg) ? ":id" : seg))
    .join("/")
    .slice(0, 300);
}

/**
 * Consent domain logic behind the public SDK API (/api/v1/*).
 * Route handlers only parse, call one of these, and map the outcome to HTTP.
 */

export const SiteKey = z.string().min(3).max(64).regex(/^[\w-]+$/);
export const VisitorId = z.string().regex(/^[a-f0-9]{16,64}$/, "Visitor id must be 16 to 64 hex characters.");

export const ConsentInput = z.object({
  siteKey: SiteKey,
  visitorId: VisitorId,
  action: z.enum(["accept_all", "reject_all", "custom", "revoke"]),
  framework: z.enum(["gdpr", "ccpa", "dpdpa", "generic"]),
  categories: z.object({ essential: z.boolean(), functional: z.boolean(), analytics: z.boolean(), marketing: z.boolean() }),
  configVersion: z.number().int().nonnegative(),
  /** the browser sent Global Privacy Control and the decision honoured it */
  gpc: z.boolean().optional(),
  /** navigator.webdriver was true: an automated browser or AI agent made the choice */
  automated: z.boolean().optional(),
  /** BCP-47 language the notice was shown in */
  language: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, "Language must be a BCP-47 code like hi or en-IN.")
    .optional(),
});
export type ConsentInput = z.infer<typeof ConsentInput>;

/** A tracker request the SDK saw after its category was declined. Query strings never leave the browser. */
export const LeakInput = z.object({
  siteKey: SiteKey,
  url: z
    .string()
    .max(500)
    .regex(/^https?:\/\/[^\s?#]+$/, "Leak URLs must be http(s) without a query string."),
  category: z.enum(["functional", "analytics", "marketing"]),
  page: z.string().max(300).regex(/^\/[^\s?#]*$/, "Page must be a path without a query string."),
  framework: z.enum(["gdpr", "ccpa", "dpdpa", "generic"]),
});
export type LeakInput = z.infer<typeof LeakInput>;

export const EventInput = z.object({ siteKey: SiteKey, kind: z.enum(["view", "bounce"]) });
export type EventInput = z.infer<typeof EventInput>;

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: "not_found" | "not_published" | "forbidden_origin" };

export interface ConsentReceiptSummary {
  id: string;
  hash: string;
  seq: number;
}

/** Work that must run after the response is sent (webhook delivery); call it from `after()`. */
export type FollowUp = () => Promise<unknown>;

export interface VisitorReceipts {
  site: string;
  receipts: Pick<ConsentReceipt, "action" | "framework" | "categories" | "timestamp" | "hash">[];
}

/** Normalise "https://www.Example.com/path" to "example.com". */
export function bareDomain(domain: string) {
  return domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/[/:].*$/, "").replace(/^www\./, "");
}

/**
 * Writes must come from the property's own domain or a subdomain of it.
 * localhost is accepted outside production so the demo page and local sites work.
 */
export function originAllowed(headers: Headers, p: Pick<Property, "domain">) {
  const raw = headers.get("origin") ?? headers.get("referer");
  if (!raw) return false;
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return false;
  }
  const domain = bareDomain(p.domain);
  if (host === domain || host.endsWith(`.${domain}`)) return true;
  return process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1");
}

export const clientIp = (headers: Headers) => headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
export const ipHashFor = (headers: Headers) => anonymizeIp(clientIp(headers));

const today = (d = new Date()) => d.toISOString().slice(0, 10);

/** The published banner config for a site key, plus the viewer's location for geo routing. */
export async function getPublishedConfig(
  siteKey: string,
  headers: Headers,
  url: URL,
): Promise<Outcome<{ config: PublicConfig; country: string; region: string }>> {
  const store = await getStore();
  const property = await store.getPropertyBySiteKey(siteKey);
  if (!property) return { ok: false, reason: "not_found" };
  if (!property.publishedVersion) return { ok: false, reason: "not_published" };
  const org = await store.getOrg(property.orgId);
  const dpo = org?.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined;
  const { country, region } = viewerLocation(headers, url);
  // Serve the snapshot taken at publish time; drafts saved since then stay private.
  const live = property.published ? { ...property, ...property.published } : property;
  return { ok: true, value: { config: toPublicConfig(live, dpo), country, region } };
}

/** The categories a visitor had on in `prev` and turned off in `next`. */
export function withdrawnCategories(prev: Pick<ConsentReceipt, "categories"> | undefined, next: Pick<ConsentReceipt, "categories" | "action">) {
  const ids: CategoryId[] = ["functional", "analytics", "marketing"];
  if (next.action === "revoke") return ids.filter((c) => !prev || prev.categories[c]);
  if (!prev) return [];
  return ids.filter((c) => prev.categories[c] && !next.categories[c]);
}

const receiptPayload = (r: ConsentReceipt) => ({
  id: r.id,
  seq: r.seq,
  hash: r.hash,
  visitorId: r.visitorId,
  action: r.action,
  framework: r.framework,
  categories: r.categories,
  country: r.country,
  gpc: r.gpc ?? false,
  timestamp: r.timestamp,
});

/**
 * Record one consent decision as a hash-chained receipt (FR-4.1).
 * Country, device, browser and IP hash are derived server-side, so the client can't forge them.
 * Returns a follow-up that propagates the decision to the property's webhooks.
 */
export async function recordConsent(input: ConsentInput, headers: Headers): Promise<Outcome<ConsentReceiptSummary & { followUp: FollowUp }>> {
  const store = await getStore();
  const property = await store.getPropertyBySiteKey(input.siteKey);
  if (!property) return { ok: false, reason: "not_found" };
  if (!originAllowed(headers, property)) return { ok: false, reason: "forbidden_origin" };

  const { country } = viewerLocation(headers);
  const { device, browser } = parseUserAgent(headers.get("user-agent"));
  const receipt = await store.appendReceipt({
    propertyId: property.id,
    visitorId: input.visitorId,
    action: input.action,
    framework: input.framework,
    categories: { ...input.categories, essential: true },
    country,
    device,
    browser,
    ipHash: ipHashFor(headers),
    configVersion: input.configVersion,
    // Signals are only written when the SDK sent them, so receipts from older SDKs hash as before.
    ...(input.gpc !== undefined ? { gpc: input.gpc } : {}),
    ...(input.automated !== undefined ? { automated: input.automated } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    timestamp: new Date().toISOString(),
  });

  const followUp: FollowUp = async () => {
    const org = await store.getOrg(property.orgId);
    if (!webhooksEnabled(org)) return;
    await dispatchWebhooks(property, org, "consent.created", { receipt: receiptPayload(receipt) });
    if (!subscribers(property, "consent.withdrawn").length) return;
    // The visitor's previous decision, from the recent tail of the log (cheap; no full scan).
    const recent = await store.listReceipts(property.id, { before: receipt.seq, limit: 500 });
    const prev = recent.find((r) => r.visitorId === receipt.visitorId);
    const withdrawn = withdrawnCategories(prev, receipt);
    if (withdrawn.length) await dispatchWebhooks(property, org, "consent.withdrawn", { withdrawn, receipt: receiptPayload(receipt) });
  };

  return { ok: true, value: { id: receipt.id, hash: receipt.hash, seq: receipt.seq, followUp } };
}

/**
 * Leak detection: a tracker request the visitor's browser made after its category was declined.
 * Stored as a signal (not a consent record) and sent to "leak.detected" webhooks.
 */
export async function recordLeak(input: LeakInput, headers: Headers): Promise<Outcome<{ id: string; followUp: FollowUp }>> {
  const store = await getStore();
  const property = await store.getPropertyBySiteKey(input.siteKey);
  if (!property) return { ok: false, reason: "not_found" };
  if (!originAllowed(headers, property)) return { ok: false, reason: "forbidden_origin" };
  const leak: LeakReport = {
    id: id("leak"),
    propertyId: property.id,
    url: input.url.split(/[?#]/)[0],
    category: input.category,
    page: redactPath(input.page.split(/[?#]/)[0]),
    framework: input.framework,
    country: viewerLocation(headers).country,
    createdAt: new Date().toISOString(),
  };
  await store.recordLeak(leak);
  const followUp: FollowUp = async () => {
    const org: Organization | null = await store.getOrg(property.orgId);
    const { propertyId: _omit, ...publicLeak } = leak;
    void _omit;
    await dispatchWebhooks(property, org, "leak.detected", { leak: publicLeak });
  };
  return { ok: true, value: { id: leak.id, followUp } };
}

/** Banner impression or bounce, counted per day for opt-in/bounce rates and plan limits. */
export async function recordBannerEvent(input: EventInput, headers: Headers): Promise<Outcome<null>> {
  const store = await getStore();
  const property = await store.getPropertyBySiteKey(input.siteKey);
  if (!property) return { ok: false, reason: "not_found" };
  if (!originAllowed(headers, property)) return { ok: false, reason: "forbidden_origin" };
  await store.recordPageview(property.id, today(), input.kind);
  return { ok: true, value: null };
}

/**
 * A visitor's own consent history (DPDPA right to a summary): choices only, no IP hash, country or device.
 * Scans the property's log; at scale add a visitor GSI (see infra/README.md).
 */
export async function visitorReceipts(siteKey: string, visitorId: string): Promise<Outcome<VisitorReceipts>> {
  const store = await getStore();
  const property = await store.getPropertyBySiteKey(siteKey);
  if (!property) return { ok: false, reason: "not_found" };
  const all = await store.listReceipts(property.id, { limit: 50_000 });
  const receipts = all
    .filter((r) => r.visitorId === visitorId)
    .map(({ action, framework, categories, timestamp, hash }) => ({ action, framework, categories, timestamp, hash }));
  return { ok: true, value: { site: property.domain, receipts } };
}
