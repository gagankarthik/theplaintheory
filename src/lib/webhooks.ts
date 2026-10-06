import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { id } from "./crypto";
import { planById } from "./plans";
import { getStore } from "./store";
import type { Organization, Property, Webhook, WebhookDelivery, WebhookEvent } from "./types";

/**
 * Signed webhooks: consent and withdrawal propagation to CRMs, CDPs and analytics tools, plus leak
 * alerts. Delivery is best-effort with bounded retries; every attempt is recorded so customers can
 * see exactly what was sent and when.
 *
 * Signature header (Stripe-style, replay-resistant):
 *   X-Plain-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 */

const TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1_000, 4_000];
const MAX_CONCURRENCY = 4;

export const SIGNATURE_HEADER = "x-plain-signature";

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { header: `t=${timestamp},v1=${v1}`, timestamp };
}

/**
 * Verify a webhook on the receiving side.
 *
 * @example
 * // Next.js route handler on the customer's server
 * export async function POST(req: Request) {
 *   const body = await req.text(); // the raw body, before JSON.parse
 *   if (!verifySignature(process.env.PLAIN_WEBHOOK_SECRET!, req.headers.get("x-plain-signature"), body)) {
 *     return new Response("bad signature", { status: 401 });
 *   }
 *   const event = JSON.parse(body); // { event: "consent.withdrawn", siteKey, receipt: {...} }
 *   return new Response("ok");
 * }
 */
export function verifySignature(secret: string, header: string | null | undefined, body: string, toleranceSec = 300, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(parts.v1, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/* ---------- destination safety (SSRF) ---------- */

function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || /^(fc|fd|fe80)/.test(v) || /^::ffff:(127|10|192\.168|169\.254)\./.test(v);
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

const isLocalDevHost = (host: string) => process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1");

/** Throws a user-facing message when a URL isn't an acceptable webhook destination. */
export async function assertWebhookUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a full URL, like https://example.com/hooks/consent.");
  }
  if (isLocalDevHost(url.hostname) && (url.protocol === "http:" || url.protocol === "https:")) return url;
  if (url.protocol !== "https:") throw new Error("Webhook URLs must use https.");
  if (url.username || url.password) throw new Error("Don't put credentials in the webhook URL. Verify the signature instead.");
  const host = url.hostname.replace(/^\[|\]$/g, ""); // IPv6 literals arrive bracketed
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Webhooks can't be sent to local or internal addresses.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That URL points to a private network address.");
  return url;
}

/* ---------- delivery ---------- */

export interface WebhookPayload {
  event: WebhookEvent;
  siteKey: string;
  test?: boolean;
  [key: string]: unknown;
}

async function attemptOnce(property: Property, hook: Webhook, payload: WebhookPayload, attempt: number, deliveryId: string): Promise<WebhookDelivery> {
  const body = JSON.stringify(payload);
  const { header } = signPayload(hook.secret, body);
  const started = Date.now();
  let status: WebhookDelivery["status"] = "failed";
  let httpStatus: number | undefined;
  try {
    const url = await assertWebhookUrl(hook.url);
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual", // a redirect could point anywhere; treat it as a failure
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        "user-agent": "PlainTheory-Webhooks/1.0",
        [SIGNATURE_HEADER]: header,
        "x-plain-event": payload.event,
        "x-plain-delivery": deliveryId,
      },
      body,
    });
    httpStatus = res.status;
    if (res.status >= 200 && res.status < 300) status = "delivered";
  } catch {
    /* network error, timeout or blocked destination: recorded as failed */
  }
  // One record per attempt; the X-Plain-Delivery id stays the same across retries so receivers can dedupe.
  const delivery: WebhookDelivery = {
    id: `${deliveryId}_${attempt}`,
    propertyId: property.id,
    webhookId: hook.id,
    event: payload.event,
    status,
    httpStatus,
    attempt,
    durationMs: Date.now() - started,
    createdAt: new Date().toISOString(),
  };
  await (await getStore()).recordWebhookDelivery(delivery);
  return delivery;
}

/** Up to MAX_ATTEMPTS with backoff; 4xx other than 408/429 are not retried (the receiver rejected it). */
async function deliver(property: Property, hook: Webhook, payload: WebhookPayload): Promise<WebhookDelivery> {
  const deliveryId = id("dlv");
  let last!: WebhookDelivery;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt - 1]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    last = await attemptOnce(property, hook, payload, attempt, deliveryId);
    if (last.status === "delivered") return last;
    const s = last.httpStatus;
    if (s && s >= 400 && s < 500 && s !== 408 && s !== 429) return last;
  }
  return last;
}

/** Webhooks are a Business+ feature; the plan decides, not the client. */
export function webhooksEnabled(org: Pick<Organization, "plan"> | null | undefined) {
  return !!org && planById(org.plan).limits.webhooks;
}

export function subscribers(property: Property, event: WebhookEvent) {
  return (property.webhooks ?? []).filter((h) => h.active && h.events.includes(event));
}

/**
 * Send `payload` to every active webhook subscribed to `event`. Returns once all deliveries
 * (including retries) settle; call it from `after()` so the API response never waits on it.
 */
export async function dispatchWebhooks(property: Property, org: Pick<Organization, "plan"> | null, event: WebhookEvent, payload: Omit<WebhookPayload, "event" | "siteKey">) {
  if (!webhooksEnabled(org)) return [];
  const hooks = subscribers(property, event);
  const results: WebhookDelivery[] = [];
  const full: WebhookPayload = { event, siteKey: property.siteKey, ...payload };
  for (let i = 0; i < hooks.length; i += MAX_CONCURRENCY) {
    const batch = await Promise.allSettled(hooks.slice(i, i + MAX_CONCURRENCY).map((h) => deliver(property, h, full)));
    for (const r of batch) if (r.status === "fulfilled") results.push(r.value);
  }
  return results;
}

/** One signed test delivery (no retries) so customers can check their endpoint from the dashboard. */
export async function sendTestWebhook(property: Property, webhookId: string): Promise<WebhookDelivery | null> {
  const hook = (property.webhooks ?? []).find((h) => h.id === webhookId);
  if (!hook) return null;
  const payload: WebhookPayload = {
    event: hook.events[0] ?? "consent.created",
    siteKey: property.siteKey,
    test: true,
    receipt: { id: "rcpt_test", seq: 0, hash: "0".repeat(64), visitorId: "0".repeat(32), action: "accept_all", framework: "gdpr", categories: { essential: true, functional: true, analytics: true, marketing: true }, country: "XX", gpc: false, timestamp: new Date().toISOString() },
  };
  return attemptOnce(property, hook, payload, 1, id("dlv"));
}
