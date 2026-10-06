"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-result";
import { requireProperty } from "@/lib/auth/access";
import { id } from "@/lib/crypto";
import { planById } from "@/lib/plans";
import { auditSite } from "@/lib/site-config";
import type { Webhook, WebhookDelivery, WebhookEvent } from "@/lib/types";
import { assertWebhookUrl, sendTestWebhook } from "@/lib/webhooks";

const MAX_WEBHOOKS = 10;
const EVENTS = ["consent.created", "consent.withdrawn", "leak.detected"] as const;

async function guard(propertyId: string) {
  const ctx = await requireProperty(propertyId, "property:write");
  if (!planById(ctx.org.plan).limits.webhooks) throw new Error(`Webhooks are on the Business plan and above. ${ctx.org.name} is on ${planById(ctx.org.plan).name}.`);
  return ctx;
}

export type CreateWebhookState = (ActionResult & { secret?: string; url?: string }) | null;

export async function createWebhook(propertyId: string, _: CreateWebhookState, form: FormData): Promise<CreateWebhookState> {
  try {
    const ctx = await guard(propertyId);
    const { property, store } = ctx;
    const parsed = z
      .object({
        url: z.string().trim().min(1, "Enter the URL to send events to.").max(500),
        events: z.array(z.enum(EVENTS)).min(1, "Choose at least one event."),
      })
      .safeParse({ url: form.get("url"), events: form.getAll("events") });
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = [i.message];
      return { error: "Fix the highlighted fields and try again.", fieldErrors, url: String(form.get("url") ?? "") };
    }
    const existing = property.webhooks ?? [];
    if (existing.length >= MAX_WEBHOOKS) return { error: `You can add up to ${MAX_WEBHOOKS} webhooks per site.` };
    try {
      await assertWebhookUrl(parsed.data.url);
    } catch (e) {
      return { error: (e as Error).message, fieldErrors: { url: [(e as Error).message] }, url: parsed.data.url };
    }
    if (existing.some((w) => w.url === parsed.data.url)) return { error: "That URL already has a webhook.", fieldErrors: { url: ["Already added."] }, url: parsed.data.url };
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const hook: Webhook = { id: id("whk", 6), url: parsed.data.url, secret, events: parsed.data.events as WebhookEvent[], active: true, createdAt: new Date().toISOString() };
    // Webhooks aren't part of the published banner, so they don't bump the config version.
    await store.updateProperty(propertyId, { webhooks: [...existing, hook] });
    await auditSite(ctx, "webhook.created", { webhookId: hook.id, url: hook.url, events: hook.events.join(" ") });
    revalidatePath(`/app/sites/${propertyId}/webhooks`);
    return { ok: "Webhook added. Copy the signing secret now; it won't be shown again.", secret };
  } catch (e) {
    return failure(e);
  }
}

export async function setWebhookActive(propertyId: string, webhookId: string, active: boolean): Promise<ActionResult> {
  try {
    const ctx = await guard(propertyId);
    const { property, store } = ctx;
    const hooks = property.webhooks ?? [];
    if (!hooks.some((w) => w.id === webhookId)) return { error: "That webhook no longer exists." };
    await store.updateProperty(propertyId, { webhooks: hooks.map((w) => (w.id === webhookId ? { ...w, active } : w)) });
    await auditSite(ctx, "webhook.updated", { webhookId, active });
    revalidatePath(`/app/sites/${propertyId}/webhooks`);
    return { ok: active ? "Webhook turned on." : "Webhook paused. Events won't be sent until you turn it back on." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteWebhook(propertyId: string, webhookId: string): Promise<ActionResult> {
  try {
    const ctx = await guard(propertyId);
    const { property, store } = ctx;
    const hook = (property.webhooks ?? []).find((w) => w.id === webhookId);
    if (!hook) return { error: "That webhook no longer exists." };
    await store.updateProperty(propertyId, { webhooks: (property.webhooks ?? []).filter((w) => w.id !== webhookId) });
    await auditSite(ctx, "webhook.deleted", { webhookId, url: hook.url });
    revalidatePath(`/app/sites/${propertyId}/webhooks`);
    return { ok: "Webhook deleted." };
  } catch (e) {
    return failure(e);
  }
}

export async function testWebhook(propertyId: string, webhookId: string): Promise<{ ok: boolean; delivery?: WebhookDelivery; error?: string }> {
  try {
    const ctx = await guard(propertyId);
    const delivery = await sendTestWebhook(ctx.property, webhookId);
    if (delivery) await auditSite(ctx, "webhook.tested", { webhookId, status: delivery.status });
    revalidatePath(`/app/sites/${propertyId}/webhooks`);
    if (!delivery) return { ok: false, error: "That webhook no longer exists." };
    return { ok: delivery.status === "delivered", delivery };
  } catch (e) {
    return { ok: false, error: failure(e)?.error };
  }
}
