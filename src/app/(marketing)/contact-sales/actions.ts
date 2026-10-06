"use server";

import { headers } from "next/headers";
import { invalid, type ActionResult } from "@/lib/action-result";
import { anonymizeIp } from "@/lib/crypto";
import { checkFormGuard } from "@/lib/form-guard";
import { leadSchema, submitLead } from "@/lib/leads";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";

export type ContactState = (ActionResult & { values?: Record<string, string | string[]>; formToken?: string }) | null;

const THANKS = "Thanks. We'll be in touch within one business day.";

export async function contactSales(_prev: ContactState, form: FormData): Promise<ContactState> {
  const raw = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    company: String(form.get("company") ?? ""),
    sites: String(form.get("sites") ?? ""),
    pageviews: String(form.get("pageviews") ?? ""),
    regions: form.getAll("regions").map(String),
    message: String(form.get("message") ?? ""),
  };

  // Honeypot filled: a bot. Pretend it worked so it moves on; store nothing.
  const guard = checkFormGuard(form, "contact-sales");
  if (guard.status === "bot") return { ok: THANKS };
  if (guard.status === "retry") return { error: guard.error, values: raw, formToken: guard.formToken };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return { ...invalid(parsed.error), values: raw };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
  const limit = await rateLimiter("contactSales").consume(anonymizeIp(ip));
  if (!limit.ok) {
    return {
      error: `We've had several requests from your network in the last hour. Try again in ${retryAfterText(limit.retryAfterMs)}, or email sales@theplaintheory.com.`,
      values: raw,
    };
  }

  // submitLead keeps a durable per-network count in the store as a second line of defence.
  const result = await submitLead(parsed.data, ip);
  if (!result.ok) return { error: result.error, values: raw };
  return { ok: `Thanks, ${parsed.data.name.split(" ")[0]}. We'll reply to ${parsed.data.email} within one business day.` };
}
