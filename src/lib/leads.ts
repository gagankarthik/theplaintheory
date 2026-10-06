import "server-only";
import { z } from "zod";
import { anonymizeIp, id } from "./crypto";
import { DISPOSABLE_EMAIL_MESSAGE, MAX_LINKS, countLinks, hasSpamMarkers, isDisposableEmail } from "./spam";
import { getStore } from "./store";
import type { Lead } from "./types";
import { emailSchema, plainTextSchema } from "./validation";

export const SITE_BANDS = ["1", "2-10", "11-50", "50+"] as const;
export const PAGEVIEW_BANDS = ["<100k", "100k-1m", "1m-10m", "10m+"] as const;
export const REGION_OPTIONS = ["eu", "us", "in", "other"] as const;

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|icloud|proton|protonmail|aol|live|msn|gmx|zoho|rediffmail)\./i;

export const LEAD_LIMITS = { name: 120, company: 160, message: 2000 } as const;

export const leadSchema = z.object({
  name: plainTextSchema({
    min: 2,
    max: LEAD_LIMITS.name,
    tooShort: "Enter your full name.",
    tooLong: `Keep your name under ${LEAD_LIMITS.name} characters.`,
    noLinks: "Enter your name without links.",
  }),
  email: emailSchema("Enter a work email like name@company.com.")
    .refine((e) => !FREE_MAIL.test(e), "Use your work email, like name@company.com, so we can find your company's setup.")
    .refine((e) => !isDisposableEmail(e), DISPOSABLE_EMAIL_MESSAGE),
  company: plainTextSchema({
    min: 2,
    max: LEAD_LIMITS.company,
    tooShort: "Enter your company name.",
    tooLong: `Keep the company name under ${LEAD_LIMITS.company} characters.`,
    noLinks: "Enter the company name without links. Your work email tells us the domain.",
  }),
  sites: z.enum(SITE_BANDS, { message: "Choose how many websites you run." }),
  pageviews: z.enum(PAGEVIEW_BANDS, { message: "Choose your monthly pageviews." }),
  regions: z
    .array(z.enum(REGION_OPTIONS, { message: "Choose regions from the list." }), { message: "Choose at least one region your visitors come from." })
    .min(1, "Choose at least one region your visitors come from.")
    .max(REGION_OPTIONS.length, "Choose regions from the list.")
    .transform((r) => [...new Set(r)]),
  message: z
    .string()
    .trim()
    .max(LEAD_LIMITS.message, `Keep the message under ${LEAD_LIMITS.message.toLocaleString("en")} characters.`)
    .refine((m) => countLinks(m) <= MAX_LINKS, `Include at most ${MAX_LINKS} links. Remove some and send again.`)
    .refine((m) => !hasSpamMarkers(m), "Our spam filter flagged this message. Remove promotional wording, or email sales@theplaintheory.com.")
    .optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/**
 * Store a sales enquiry and notify the team. Abuse limits use the salted IP hash; the raw IP is
 * never stored. Notification is best-effort: a failed webhook never loses the lead.
 */
export async function submitLead(input: LeadInput, ip: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = await getStore();
  const ipHash = anonymizeIp(ip);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  if ((await store.countRecentLeads(ipHash, since)) >= MAX_PER_WINDOW) {
    return { ok: false, error: "We've received several requests from your network in the last hour. Email sales@theplaintheory.com instead." };
  }

  const lead: Lead = { id: id("lead"), ...input, message: input.message || undefined, ipHash, createdAt: new Date().toISOString() };
  await store.createLead(lead);
  await notify(lead).catch((e) => console.error("[leads] notification failed", e));
  return { ok: true };
}

/** SALES_WEBHOOK_URL accepts a Slack-compatible incoming webhook (also works with most chat tools). */
async function notify(l: Lead) {
  const url = process.env.SALES_WEBHOOK_URL;
  if (!url) return;
  const text = [
    `New sales enquiry from ${l.name} (${l.email}) at ${l.company}`,
    `Sites: ${l.sites}. Pageviews: ${l.pageviews}. Regions: ${l.regions.join(", ").toUpperCase()}.`,
    l.message ? `"${l.message.slice(0, 500)}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5000),
  });
}
