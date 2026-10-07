import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkFormGuard, issueFormToken } from "@/lib/form-guard";
import { FORM_TOKEN_FIELD, HONEYPOT_FIELD } from "@/lib/form-guard-fields";
import { categoryLabel, leadReference, matchesReference } from "@/lib/lead-options";
import { enterpriseSchema, leadFields, leadSchema, notificationText, partnerSchema, supportSchema, TOPIC_SCHEMAS } from "@/lib/leads";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { Store } from "@/lib/store/types";
import type { Lead } from "@/lib/types";

const errorsFor = (schema: { safeParse: (i: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown) => {
  const r = schema.safeParse(input);
  // The form shows the first message for each field, so keep the first one per path.
  const out: Record<string, string> = {};
  if (!r.success) for (const i of r.error!.issues) out[i.path.join(".")] ??= i.message;
  return out;
};

describe("supportSchema", () => {
  const valid = {
    name: "Ravi Kumar",
    email: "ravi@gmail.com",
    siteDomain: "",
    category: "banner",
    severity: "urgent",
    subject: "Banner doesn't load on checkout",
    message: "Since this morning the banner never appears on /checkout. Other pages are fine.",
  };

  it("accepts personal email (customers may sign in with one) and an empty optional domain", () => {
    const r = supportSchema.parse(valid);
    expect(r.email).toBe("ravi@gmail.com");
    expect(r.siteDomain).toBeUndefined();
  });

  it("normalises the site domain", () => {
    expect(supportSchema.parse({ ...valid, siteDomain: " https://Shop.Example.com/checkout " }).siteDomain).toBe("shop.example.com");
    expect(errorsFor(supportSchema, { ...valid, siteDomain: "not a domain" }).siteDomain).toMatch(/domain like example.com/);
  });

  it("refuses disposable email, unknown categories and severities, and short descriptions", () => {
    const e = errorsFor(supportSchema, { ...valid, email: "x@mailinator.com", category: "hacking", severity: "critical", message: "broken" });
    expect(e.email).toMatch(/permanent email/);
    expect(e.category).toBeDefined();
    expect(e.severity).toBeDefined();
    expect(e.message).toMatch(/at least 20/);
  });

  it("requires a subject without links and a description", () => {
    const e = errorsFor(supportSchema, { ...valid, subject: "see https://spam.example", message: "" });
    expect(e.subject).toMatch(/links/);
    expect(e.message).toMatch(/Describe what happened/);
  });

  it("applies the link cap and spam markers to the description", () => {
    const links = Array.from({ length: 4 }, (_, i) => `https://x${i}.example`).join(" ");
    expect(errorsFor(supportSchema, { ...valid, message: `Look at these pages please: ${links}` }).message).toMatch(/at most 3 links/);
    expect(errorsFor(supportSchema, { ...valid, message: "We offer SEO services packages for your site, guaranteed." }).message).toMatch(/spam filter/);
  });
});

describe("partnerSchema", () => {
  const valid = {
    name: "Meera Shah",
    email: "meera@agency.example",
    company: "North Agency",
    website: "",
    partnershipType: "agency",
    queryType: "payouts",
    message: "Our March payout hasn't arrived. Partner ID NA-1042.",
  };

  it("accepts a complete request", () => {
    expect(partnerSchema.safeParse(valid).success).toBe(true);
  });

  it("needs a work email and known types", () => {
    const e = errorsFor(partnerSchema, { ...valid, email: "meera@yahoo.com", partnershipType: "reseller", queryType: "" });
    expect(e.email).toMatch(/work email/);
    expect(e.partnershipType).toBeDefined();
    expect(e.queryType).toBeDefined();
  });
});

describe("enterpriseSchema", () => {
  const valid = {
    name: "Asha Menon",
    email: "asha@acme.example",
    company: "Acme Retail",
    companySize: "1000-4999",
    requestType: "dpa",
    regions: ["in", "eu", "in"],
    message: "We need your DPA and sub-processor list before 30 November.",
  };

  it("accepts a complete request and de-duplicates regions", () => {
    expect(enterpriseSchema.parse(valid).regions).toEqual(["in", "eu"]);
  });

  it("blocks free-mail and disposable domains, like the sales form", () => {
    expect(errorsFor(enterpriseSchema, { ...valid, email: "asha@gmail.com" }).email).toMatch(/work email/);
    expect(errorsFor(enterpriseSchema, { ...valid, email: "asha@yopmail.com" }).email).toMatch(/permanent email/);
  });

  it("needs at least one region, a size band and a request type", () => {
    const e = errorsFor(enterpriseSchema, { ...valid, regions: [], companySize: "huge", requestType: "" });
    expect(e.regions).toBeDefined();
    expect(e.companySize).toBeDefined();
    expect(e.requestType).toBeDefined();
  });
});

describe("topic routing", () => {
  it("has a schema per topic", () => {
    expect(Object.keys(TOPIC_SCHEMAS).sort()).toEqual(["enterprise", "partner", "sales", "support"]);
  });

  it("keeps the sales shape and tags it", () => {
    const input = leadSchema.parse({ name: "Asha Menon", email: "asha@acme.example", company: "Acme", sites: "2-10", pageviews: "<100k", regions: ["in"], message: "" });
    const f = leadFields({ topic: "sales", input });
    expect(f).toMatchObject({ topic: "sales", status: "new", company: "Acme", sites: "2-10", pageviews: "<100k", regions: ["in"] });
    expect(f.message).toBeUndefined();
  });

  it("maps support fields to subject, category, severity and details", () => {
    const input = supportSchema.parse({ name: "Ravi Kumar", email: "ravi@shop.example", siteDomain: "shop.example", category: "blocking", severity: "high", subject: "GA fires after decline", message: "Google Analytics still loads after I click decline." });
    const f = leadFields({ topic: "support", input });
    expect(f).toMatchObject({ topic: "support", status: "new", subject: "GA fires after decline", category: "blocking", severity: "high", details: { siteDomain: "shop.example" } });
    expect(f.sites).toBeUndefined();
  });

  it("omits empty details", () => {
    const input = supportSchema.parse({ name: "Ravi Kumar", email: "ravi@shop.example", siteDomain: "", category: "other", severity: "low", subject: "A question", message: "How do I change the banner colour for one site?" });
    expect(leadFields({ topic: "support", input }).details).toBeUndefined();
  });

  it("maps partner and enterprise choices to category and details", () => {
    const p = partnerSchema.parse({ name: "Meera Shah", email: "meera@agency.example", company: "North", website: "north.example", partnershipType: "affiliate", queryType: "campaign", message: "Need new tracking links for the Q4 campaign." });
    expect(leadFields({ topic: "partner", input: p })).toMatchObject({ topic: "partner", category: "campaign", company: "North", details: { website: "north.example", partnershipType: "affiliate" } });
    const e = enterpriseSchema.parse({ name: "Asha Menon", email: "asha@acme.example", company: "Acme", companySize: "5000+", requestType: "residency", regions: ["eu"], message: "Can consent records stay in Frankfurt only?" });
    expect(leadFields({ topic: "enterprise", input: e })).toMatchObject({ topic: "enterprise", category: "residency", regions: ["eu"], details: { companySize: "5000+" } });
  });

  it("puts the topic and reference first in the notification", () => {
    const lead: Lead = { id: "lead_Ab3x9QzK1mPw", topic: "support", name: "Ravi", email: "ravi@shop.example", subject: "Down", category: "banner", severity: "urgent", message: "Banner missing", ipHash: "h", createdAt: "2026-10-07T00:00:00Z" };
    const text = notificationText(lead);
    expect(text.split("\n")[0]).toBe("[Support] New support request PT-Ab3x9QzK from Ravi (ravi@shop.example)");
    expect(text).toContain("Banner and setup");
    expect(text).toContain("Severity: urgent");
    const legacy: Lead = { id: "lead_old", name: "A", email: "a@b.example", company: "B", sites: "1", pageviews: "<100k", regions: ["in"], ipHash: "h", createdAt: "2026-01-01T00:00:00Z" };
    expect(notificationText(legacy).startsWith("[Sales] New sales enquiry")).toBe(true);
  });

  it("references are short, prefixed and searchable", () => {
    expect(leadReference("lead_Ab3x9QzK1mPw")).toBe("PT-Ab3x9QzK");
    expect(matchesReference("lead_Ab3x9QzK1mPw", "PT-Ab3x9QzK")).toBe(true);
    expect(matchesReference("lead_Ab3x9QzK1mPw", "pt-Ab3x")).toBe(true);
    expect(matchesReference("lead_Ab3x9QzK1mPw", "Ab")).toBe(false);
    expect(categoryLabel("enterprise", "terms")).toBe("Custom terms or MSA");
  });
});

describe("contact form spam layers", () => {
  it("each new form has its own signed token that can't be replayed on another", () => {
    const t0 = Date.parse("2026-10-07T10:00:00Z");
    const token = issueFormToken("contact-support", t0);
    const form = new FormData();
    form.set(FORM_TOKEN_FIELD, token);
    expect(checkFormGuard(form, "contact-support", t0 + 5_000).status).toBe("ok");
    expect(checkFormGuard(form, "contact-enterprise", t0 + 5_000).status).toBe("retry");
    expect(checkFormGuard(form, "contact-partners", t0 + 500).status).toBe("retry");
    form.set(HONEYPOT_FIELD, "x");
    expect(checkFormGuard(form, "contact-support", t0 + 5_000).status).toBe("bot");
  });

  it("has a shared contact rate limit", () => {
    expect(RATE_LIMITS.contact).toEqual({ limit: 5, windowMs: 60 * 60 * 1000 });
  });
});

describe("local store: lead inbox", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-leads-"));
  let store: Store;
  const lead = (n: number, extra: Partial<Lead> = {}): Lead => ({
    id: `lead_test${n}`,
    name: `Person ${n}`,
    email: `p${n}@acme.example`,
    ipHash: "ip",
    createdAt: new Date(Date.UTC(2026, 9, 7, 10, n)).toISOString(),
    ...extra,
  });

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    store = (await import("@/lib/store/local")).localStore;
    await store.createLead(lead(1, { company: "Acme", sites: "1", pageviews: "<100k", regions: ["in"] })); // legacy sales: no topic or status
    await store.createLead(lead(2, { topic: "support", status: "new", subject: "Help" }));
    await store.createLead(lead(3, { topic: "enterprise", status: "new" }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("lists newest first and treats missing topic as sales and missing status as new", async () => {
    expect((await store.listLeads()).map((l) => l.id)).toEqual(["lead_test3", "lead_test2", "lead_test1"]);
    expect((await store.listLeads({ topic: "sales" })).map((l) => l.id)).toEqual(["lead_test1"]);
    expect((await store.listLeads({ status: "new" })).length).toBe(3);
    expect((await store.listLeads({ limit: 1 })).map((l) => l.id)).toEqual(["lead_test3"]);
  });

  it("moves a lead through statuses", async () => {
    const updated = await store.updateLeadStatus("lead_test2", "open");
    expect(updated?.status).toBe("open");
    expect(updated?.updatedAt).toBeDefined();
    expect((await store.listLeads({ status: "open" })).map((l) => l.id)).toEqual(["lead_test2"]);
    expect((await store.listLeads({ status: "new", topic: "support" })).length).toBe(0);
    expect((await store.getLead("lead_test2"))?.status).toBe("open");
    expect(await store.updateLeadStatus("lead_missing", "closed")).toBeNull();
  });
});
