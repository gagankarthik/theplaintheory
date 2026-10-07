import "server-only";
import { z } from "zod";
import { anonymizeIp, id } from "./crypto";
import {
  COMPANY_SIZES,
  ENTERPRISE_REQUEST_TYPES,
  PARTNERSHIP_TYPES,
  PARTNER_QUERY_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_SEVERITIES,
  TOPIC_LABEL,
  categoryLabel,
  leadReference,
  valuesOf,
} from "./lead-options";
import { DISPOSABLE_EMAIL_MESSAGE, MAX_LINKS, countLinks, hasSpamMarkers, isDisposableEmail } from "./spam";
import { getStore } from "./store";
import type { Lead, LeadTopic } from "./types";
import { domainSchema, emailSchema, plainTextSchema } from "./validation";

/**
 * Every public contact form: schemas per topic, the stored shape, and submission. Sales
 * (/contact-sales) keeps its original fields; support, partner and enterprise requests come from
 * /contact/*. All are stored as leads with a `topic`, so the staff inbox reads one table.
 */

export const SITE_BANDS = ["1", "2-10", "11-50", "50+"] as const;
export const PAGEVIEW_BANDS = ["<100k", "100k-1m", "1m-10m", "10m+"] as const;
export const REGION_OPTIONS = ["eu", "us", "in", "other"] as const;

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|icloud|proton|protonmail|aol|live|msn|gmx|zoho|rediffmail)\./i;

export const LEAD_LIMITS = { name: 120, company: 160, subject: 160, message: 2000 } as const;

/* ---------- shared fields ---------- */

const nameField = plainTextSchema({
  min: 2,
  max: LEAD_LIMITS.name,
  tooShort: "Enter your full name.",
  tooLong: `Keep your name under ${LEAD_LIMITS.name} characters.`,
  noLinks: "Enter your name without links.",
});

/** Any permanent address: customers asking for support may use personal mail. Throwaway inboxes are refused. */
const anyEmailField = emailSchema("Enter an email address like name@company.com.").refine((e) => !isDisposableEmail(e), DISPOSABLE_EMAIL_MESSAGE);

/** Work addresses only: free-mail and throwaway domains are refused. */
const workEmailField = emailSchema("Enter a work email like name@company.com.")
  .refine((e) => !FREE_MAIL.test(e), "Use your work email, like name@company.com, so we can find your company's setup.")
  .refine((e) => !isDisposableEmail(e), DISPOSABLE_EMAIL_MESSAGE);

const companyField = plainTextSchema({
  min: 2,
  max: LEAD_LIMITS.company,
  tooShort: "Enter your company name.",
  tooLong: `Keep the company name under ${LEAD_LIMITS.company} characters.`,
  noLinks: "Enter the company name without links. Your work email tells us the domain.",
});

const linkAndSpamChecks = (s: z.ZodString, fallbackEmail: string) =>
  s
    .refine((m) => countLinks(m) <= MAX_LINKS, `Include at most ${MAX_LINKS} links. Remove some and send again.`)
    .refine((m) => !hasSpamMarkers(m), `Our spam filter flagged this message. Remove promotional wording, or email ${fallbackEmail}.`);

/** Required free text with a minimum length, the link cap and the spam-marker check. */
const requiredMessage = (empty: string, min = 20) =>
  linkAndSpamChecks(
    z
      .string()
      .trim()
      .min(1, empty)
      .min(min, `Add a little more detail (at least ${min} characters).`)
      .max(LEAD_LIMITS.message, `Keep the message under ${LEAD_LIMITS.message.toLocaleString("en")} characters.`),
    "hello@theplaintheory.in",
  );

/** An optional bare domain: blank becomes undefined; anything else must look like example.com. */
const optionalDomain = z
  .string()
  .trim()
  .max(253, "Enter a domain like example.com, without https://")
  .transform((v) => (v ? v : undefined))
  .pipe(z.union([z.undefined(), domainSchema]));

const regionsField = (empty: string) =>
  z
    .array(z.enum(REGION_OPTIONS, { message: "Choose regions from the list." }), { message: empty })
    .min(1, empty)
    .max(REGION_OPTIONS.length, "Choose regions from the list.")
    .transform((r) => [...new Set(r)]);

/* ---------- sales (/contact-sales) ---------- */

export const leadSchema = z.object({
  name: nameField,
  email: workEmailField,
  company: companyField,
  sites: z.enum(SITE_BANDS, { message: "Choose how many websites you run." }),
  pageviews: z.enum(PAGEVIEW_BANDS, { message: "Choose your monthly pageviews." }),
  regions: regionsField("Choose at least one region your visitors come from."),
  message: linkAndSpamChecks(
    z.string().trim().max(LEAD_LIMITS.message, `Keep the message under ${LEAD_LIMITS.message.toLocaleString("en")} characters.`),
    "sales@theplaintheory.in",
  ).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

/* ---------- support (/contact/support) ---------- */

export const supportSchema = z.object({
  name: nameField,
  email: anyEmailField,
  siteDomain: optionalDomain,
  category: z.enum(valuesOf(SUPPORT_CATEGORIES), { message: "Choose what the problem is about." }),
  severity: z.enum(valuesOf(SUPPORT_SEVERITIES), { message: "Choose how much this affects you." }),
  subject: plainTextSchema({
    min: 4,
    max: LEAD_LIMITS.subject,
    tooShort: "Add a short subject, for example: Banner doesn't show on checkout pages.",
    tooLong: `Keep the subject under ${LEAD_LIMITS.subject} characters.`,
    noLinks: "Leave links out of the subject. Put them in the description.",
  }),
  message: requiredMessage("Describe what happened, what you expected, and the page where you saw it."),
});
export type SupportInput = z.infer<typeof supportSchema>;

/* ---------- partners (/contact/partners) ---------- */

export const partnerSchema = z.object({
  name: nameField,
  email: workEmailField,
  company: companyField,
  website: optionalDomain,
  partnershipType: z.enum(valuesOf(PARTNERSHIP_TYPES), { message: "Choose your partnership type." }),
  queryType: z.enum(valuesOf(PARTNER_QUERY_TYPES), { message: "Choose what your query is about." }),
  message: requiredMessage("Tell us what you need help with."),
});
export type PartnerInput = z.infer<typeof partnerSchema>;

/* ---------- enterprise (/contact/enterprise) ---------- */

export const enterpriseSchema = z.object({
  name: nameField,
  email: workEmailField,
  company: companyField,
  companySize: z.enum(valuesOf(COMPANY_SIZES), { message: "Choose your company size." }),
  requestType: z.enum(valuesOf(ENTERPRISE_REQUEST_TYPES), { message: "Choose the type of request." }),
  regions: regionsField("Choose at least one region where your visitors or data are."),
  message: requiredMessage("Tell us what you need, and any deadline."),
});
export type EnterpriseInput = z.infer<typeof enterpriseSchema>;

/* ---------- topic routing ---------- */

/** A topic with its parsed input. */
export type TopicInput =
  | { topic: "sales"; input: LeadInput }
  | { topic: "support"; input: SupportInput }
  | { topic: "partner"; input: PartnerInput }
  | { topic: "enterprise"; input: EnterpriseInput };

/** Each topic's schema, so a caller can parse by topic. */
export const TOPIC_SCHEMAS = { sales: leadSchema, support: supportSchema, partner: partnerSchema, enterprise: enterpriseSchema } as const;

const compact = (d: Record<string, string | undefined>) => {
  const out = Object.fromEntries(Object.entries(d).filter((e): e is [string, string] => Boolean(e[1])));
  return Object.keys(out).length ? out : undefined;
};

/**
 * The stored fields for a topic's input (everything except id, ipHash and createdAt). Sales keeps
 * its original shape; other topics put their main choice in `category` and extras in `details`.
 */
export function leadFields(t: TopicInput): Omit<Lead, "id" | "ipHash" | "createdAt"> {
  switch (t.topic) {
    case "sales":
      return { topic: "sales", status: "new", ...t.input, message: t.input.message || undefined };
    case "support":
      return {
        topic: "support",
        status: "new",
        name: t.input.name,
        email: t.input.email,
        subject: t.input.subject,
        category: t.input.category,
        severity: t.input.severity,
        message: t.input.message,
        details: compact({ siteDomain: t.input.siteDomain }),
      };
    case "partner":
      return {
        topic: "partner",
        status: "new",
        name: t.input.name,
        email: t.input.email,
        company: t.input.company,
        category: t.input.queryType,
        message: t.input.message,
        details: compact({ website: t.input.website, partnershipType: t.input.partnershipType }),
      };
    case "enterprise":
      return {
        topic: "enterprise",
        status: "new",
        name: t.input.name,
        email: t.input.email,
        company: t.input.company,
        category: t.input.requestType,
        regions: t.input.regions,
        message: t.input.message,
        details: compact({ companySize: t.input.companySize }),
      };
  }
}

/** Where to write instead when a form refuses a request. */
export const TOPIC_EMAIL: Record<LeadTopic, string> = {
  sales: "sales@theplaintheory.in",
  support: "hello@theplaintheory.in",
  partner: "hello@theplaintheory.in",
  enterprise: "sales@theplaintheory.in",
};

const WINDOW_MS = 60 * 60 * 1000;
/** Requests per network per hour, counted across every contact form. */
export const MAX_PER_WINDOW = 5;

export type SubmitResult = { ok: true; id: string; reference: string } | { ok: false; error: string };

/**
 * Store a contact request and notify the team. Abuse limits use the salted IP hash; the raw IP is
 * never stored. Notification is best-effort: a failed webhook never loses the lead.
 */
export async function submitContact(t: TopicInput, ip: string | null): Promise<SubmitResult> {
  const store = await getStore();
  const ipHash = anonymizeIp(ip);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  if ((await store.countRecentLeads(ipHash, since)) >= MAX_PER_WINDOW) {
    return { ok: false, error: `We've received several requests from your network in the last hour. Email ${TOPIC_EMAIL[t.topic]} instead.` };
  }

  const lead: Lead = { id: id("lead"), ...leadFields(t), ipHash, createdAt: new Date().toISOString() };
  await store.createLead(lead);
  await notify(lead).catch((e) => console.error("[leads] notification failed", e));
  return { ok: true, id: lead.id, reference: leadReference(lead.id) };
}

/** The sales entry point used by /contact-sales. */
export const submitLead = (input: LeadInput, ip: string | null) => submitContact({ topic: "sales", input }, ip);

/** The webhook text for a lead. It starts with the topic, so a shared channel can be scanned or filtered. */
export function notificationText(l: Lead) {
  const topic = l.topic ?? "sales";
  const ref = leadReference(l.id);
  const who = `${l.name} (${l.email})${l.company ? ` at ${l.company}` : ""}`;
  const lines: (string | null)[] =
    topic === "sales"
      ? [`[${TOPIC_LABEL.sales}] New sales enquiry ${ref} from ${who}`, `Sites: ${l.sites}. Pageviews: ${l.pageviews}. Regions: ${(l.regions ?? []).join(", ").toUpperCase()}.`]
      : [
          `[${TOPIC_LABEL[topic]}] New ${topic} request ${ref} from ${who}`,
          [
            l.category ? categoryLabel(topic, l.category) : null,
            l.severity ? `Severity: ${l.severity}` : null,
            l.regions?.length ? `Regions: ${l.regions.join(", ").toUpperCase()}` : null,
            ...Object.entries(l.details ?? {}).map(([k, v]) => `${k}: ${v}`),
          ]
            .filter(Boolean)
            .join(". ") || null,
          l.subject ? `Subject: ${l.subject}` : null,
        ];
  lines.push(l.message ? `"${l.message.slice(0, 500)}"` : null);
  return lines.filter(Boolean).join("\n");
}

/** SALES_WEBHOOK_URL accepts a Slack-compatible incoming webhook (also works with most chat tools). */
async function notify(l: Lead) {
  const url = process.env.SALES_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: notificationText(l), topic: l.topic ?? "sales", reference: leadReference(l.id) }),
    signal: AbortSignal.timeout(5000),
  });
}
