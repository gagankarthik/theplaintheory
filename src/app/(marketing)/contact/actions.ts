"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { invalid, type ActionResult } from "@/lib/action-result";
import { anonymizeIp } from "@/lib/crypto";
import { checkFormGuard, type FormName } from "@/lib/form-guard";
import { RESPONSE_TIMES } from "@/lib/lead-options";
import { TOPIC_EMAIL, enterpriseSchema, partnerSchema, submitContact, supportSchema, type TopicInput } from "@/lib/leads";
import { rateLimiter, retryAfterText } from "@/lib/rate-limit";
import type { LeadTopic } from "@/lib/types";

/**
 * Support, partner and enterprise requests. Each passes the same layers as /contact-sales, in order:
 * honeypot (bots get a fake success and nothing is stored), signed time trap, schema with disposable-
 * email, link and spam-marker checks, the shared "contact" rate limit, then the store's per-network
 * count inside submitContact.
 */

export type RequestState =
  | (ActionResult & {
      values?: Record<string, string | string[]>;
      formToken?: string;
      /** set on success: the short reference to quote in replies */
      reference?: string;
      email?: string;
    })
  | null;

type Raw = Record<string, string | string[]>;

/** A plausible reference for bots that trip the honeypot, so the fake success looks real. */
const fakeReference = () => `PT-${randomBytes(6).toString("base64url")}`;

async function handle(form: FormData, formName: FormName, topic: Exclude<LeadTopic, "sales">, raw: Raw, parse: (raw: Raw) => { ok: true; t: TopicInput; email: string; name: string } | { ok: false; state: RequestState }): Promise<RequestState> {
  const guard = checkFormGuard(form, formName);
  if (guard.status === "bot") return { ok: RESPONSE_TIMES[topic], reference: fakeReference() };
  if (guard.status === "retry") return { error: guard.error, values: raw, formToken: guard.formToken };

  const parsed = parse(raw);
  if (!parsed.ok) return parsed.state;

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
  const limit = await rateLimiter("contact").consume(anonymizeIp(ip));
  if (!limit.ok) {
    return {
      error: `We've had several requests from your network in the last hour. Try again in ${retryAfterText(limit.retryAfterMs)}, or email ${TOPIC_EMAIL[topic]}.`,
      values: raw,
    };
  }

  const result = await submitContact(parsed.t, ip);
  if (!result.ok) return { error: result.error, values: raw };
  return { ok: `Thanks, ${parsed.name.split(" ")[0]}. ${RESPONSE_TIMES[topic]}`, reference: result.reference, email: parsed.email };
}

const str = (form: FormData, k: string) => String(form.get(k) ?? "");

export async function requestSupport(_prev: RequestState, form: FormData): Promise<RequestState> {
  const raw = {
    name: str(form, "name"),
    email: str(form, "email"),
    siteDomain: str(form, "siteDomain"),
    category: str(form, "category"),
    severity: str(form, "severity"),
    subject: str(form, "subject"),
    message: str(form, "message"),
  };
  return handle(form, "contact-support", "support", raw, () => {
    const p = supportSchema.safeParse(raw);
    return p.success ? { ok: true, t: { topic: "support", input: p.data }, email: p.data.email, name: p.data.name } : { ok: false, state: { ...invalid(p.error), values: raw } };
  });
}

export async function requestPartner(_prev: RequestState, form: FormData): Promise<RequestState> {
  const raw = {
    name: str(form, "name"),
    email: str(form, "email"),
    company: str(form, "company"),
    website: str(form, "website"),
    partnershipType: str(form, "partnershipType"),
    queryType: str(form, "queryType"),
    message: str(form, "message"),
  };
  return handle(form, "contact-partners", "partner", raw, () => {
    const p = partnerSchema.safeParse(raw);
    return p.success ? { ok: true, t: { topic: "partner", input: p.data }, email: p.data.email, name: p.data.name } : { ok: false, state: { ...invalid(p.error), values: raw } };
  });
}

export async function requestEnterprise(_prev: RequestState, form: FormData): Promise<RequestState> {
  const raw = {
    name: str(form, "name"),
    email: str(form, "email"),
    company: str(form, "company"),
    companySize: str(form, "companySize"),
    requestType: str(form, "requestType"),
    regions: form.getAll("regions").map(String),
    message: str(form, "message"),
  };
  return handle(form, "contact-enterprise", "enterprise", raw, () => {
    const p = enterpriseSchema.safeParse(raw);
    return p.success ? { ok: true, t: { topic: "enterprise", input: p.data }, email: p.data.email, name: p.data.name } : { ok: false, state: { ...invalid(p.error), values: raw } };
  });
}
