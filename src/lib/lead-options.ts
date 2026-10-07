import type { LeadStatus, LeadTopic } from "./types";

/**
 * Choices offered by the public contact forms, with their labels. Client-safe (no server imports):
 * the forms render these and lib/leads.ts validates against the same values.
 */

export const LEAD_TOPICS = ["sales", "support", "partner", "enterprise"] as const satisfies readonly LeadTopic[];
export const LEAD_STATUSES = ["new", "open", "closed"] as const satisfies readonly LeadStatus[];

export const TOPIC_LABEL: Record<LeadTopic, string> = {
  sales: "Sales",
  support: "Support",
  partner: "Partner",
  enterprise: "Enterprise",
};

export const STATUS_LABEL: Record<LeadStatus, string> = { new: "New", open: "Open", closed: "Closed" };

type Option = { value: string; label: string; hint?: string };
const opts = <const T extends readonly Option[]>(o: T) => o;
/** The option values as a non-empty tuple, for z.enum. */
export const valuesOf = <T extends readonly Option[]>(o: T) => o.map((x) => x.value) as [T[number]["value"], ...T[number]["value"][]];
export const labelOf = (o: readonly Option[], v: string | undefined) => o.find((x) => x.value === v)?.label ?? v ?? "";

export const SUPPORT_CATEGORIES = opts([
  { value: "banner", label: "Banner and setup" },
  { value: "blocking", label: "Tracker blocking" },
  { value: "consent-log", label: "Consent log and exports" },
  { value: "billing", label: "Billing" },
  { value: "account", label: "Account and sign-in" },
  { value: "other", label: "Other" },
]);

export const SUPPORT_SEVERITIES = opts([
  { value: "low", label: "Low", hint: "A question, or something minor" },
  { value: "normal", label: "Normal", hint: "Something isn't working, with a workaround" },
  { value: "high", label: "High", hint: "A key feature is broken for your visitors" },
  { value: "urgent", label: "Urgent", hint: "Production is down: the banner or your site doesn't load" },
]);

export const PARTNERSHIP_TYPES = opts([
  { value: "agency", label: "Agency" },
  { value: "affiliate", label: "Affiliate" },
  { value: "technology", label: "Technology integration" },
  { value: "strategic", label: "Strategic" },
]);

export const PARTNER_QUERY_TYPES = opts([
  { value: "account", label: "Account" },
  { value: "campaign", label: "Campaign" },
  { value: "program", label: "Program" },
  { value: "payouts", label: "Payouts" },
  { value: "other", label: "Other" },
]);

export const COMPANY_SIZES = opts([
  { value: "1-49", label: "1 to 49 people" },
  { value: "50-249", label: "50 to 249" },
  { value: "250-999", label: "250 to 999" },
  { value: "1000-4999", label: "1,000 to 4,999" },
  { value: "5000+", label: "5,000 or more" },
]);

export const ENTERPRISE_REQUEST_TYPES = opts([
  { value: "dpa", label: "DPA request" },
  { value: "residency", label: "Data residency" },
  { value: "audit", label: "Audit trail and evidence" },
  { value: "terms", label: "Custom terms or MSA" },
  { value: "questionnaire", label: "Security questionnaire" },
  { value: "procurement", label: "Procurement and vendor onboarding" },
  { value: "other", label: "Other" },
]);

export const REGION_CHOICES = opts([
  { value: "eu", label: "Europe and UK" },
  { value: "us", label: "United States" },
  { value: "in", label: "India" },
  { value: "other", label: "Elsewhere" },
]);

/** Labels for the `details` keys each form stores, for the staff inbox. */
export const DETAIL_LABEL: Record<string, string> = {
  siteDomain: "Site domain",
  website: "Website",
  partnershipType: "Partnership type",
  companySize: "Company size",
  sites: "Websites",
  pageviews: "Monthly pageviews",
};

/** Label for a lead's `category` given its topic. */
export function categoryLabel(topic: LeadTopic, category: string | undefined) {
  if (!category) return "";
  if (topic === "support") return labelOf(SUPPORT_CATEGORIES, category);
  if (topic === "partner") return labelOf(PARTNER_QUERY_TYPES, category);
  if (topic === "enterprise") return labelOf(ENTERPRISE_REQUEST_TYPES, category);
  return category;
}

/** Label for a stored `details` value. */
export function detailValueLabel(key: string, value: string) {
  if (key === "partnershipType") return labelOf(PARTNERSHIP_TYPES, value);
  if (key === "companySize") return labelOf(COMPANY_SIZES, value);
  return value;
}

/**
 * The short reference shown to the sender and searchable in the inbox: the first 8 characters of the
 * random part of the lead id. Ids are case-sensitive base64url, so case is kept: lead_Ab3x9QzK1mPw
 * becomes "PT-Ab3x9QzK".
 */
export const leadReference = (id: string) => `PT-${id.replace(/^lead_/, "").slice(0, 8)}`;

/** Whether `ref` (as a person might type it) matches the lead id. */
export const matchesReference = (id: string, ref: string) => {
  const r = ref.trim().replace(/^PT-/i, "");
  return r.length >= 4 && id.replace(/^lead_/, "").startsWith(r);
};

/** When each team aims to reply, stated plainly on the contact pages. */
export const RESPONSE_TIMES: Record<LeadTopic, string> = {
  support: "Support replies within one business day. Urgent production issues are prioritised.",
  sales: "Sales replies within one business day.",
  partner: "The partnerships team replies within one business day.",
  enterprise: "Enterprise and compliance requests get a reply within one business day, from a named contact.",
};
