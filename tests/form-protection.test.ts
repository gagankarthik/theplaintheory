import { describe, expect, it } from "vitest";
import { MAX_AGE_MS, MIN_AGE_MS, checkFormGuard, issueFormToken, verifyFormToken } from "@/lib/form-guard";
import { FORM_TOKEN_FIELD, HONEYPOT_FIELD } from "@/lib/form-guard-fields";
import { leadSchema } from "@/lib/leads";
import { createMemoryRateLimiter, rateLimiter, retryAfterText } from "@/lib/rate-limit";
import { countLinks, hasSpamMarkers, isDisposableEmail } from "@/lib/spam";

const t0 = Date.parse("2026-10-06T10:00:00Z");

describe("sliding window rate limiter", () => {
  it("allows up to the limit, then blocks with a retry time", async () => {
    const rl = createMemoryRateLimiter({ limit: 3, windowMs: 60_000 });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rl.consume("ip-a", t0 + i * 1000));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    // oldest hit at t0 leaves the window at t0 + 60s; we asked at t0 + 3s
    expect(results[3].retryAfterMs).toBe(57_000);
  });

  it("slides: hits leave the window one by one instead of resetting together", async () => {
    const rl = createMemoryRateLimiter({ limit: 2, windowMs: 10_000 });
    await rl.consume("k", t0);
    await rl.consume("k", t0 + 5_000);
    expect((await rl.consume("k", t0 + 9_999)).ok).toBe(false);
    expect((await rl.consume("k", t0 + 10_000)).ok).toBe(true); // first hit expired
    expect((await rl.consume("k", t0 + 12_000)).ok).toBe(false); // second still inside
  });

  it("does not record blocked attempts, so hammering doesn't extend the block", async () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 10_000 });
    await rl.consume("k", t0);
    for (let i = 1; i < 50; i++) await rl.consume("k", t0 + i * 100);
    expect((await rl.consume("k", t0 + 10_000)).ok).toBe(true);
  });

  it("keeps keys independent, and peek and reset work", async () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 10_000 });
    await rl.consume("a", t0);
    expect((await rl.peek("a", t0)).ok).toBe(false);
    expect((await rl.consume("b", t0)).ok).toBe(true);
    await rl.reset("a");
    expect((await rl.peek("a", t0)).ok).toBe(true);
  });

  it("bounds memory by evicting stale keys", async () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 10 });
    for (let i = 0; i < 100; i++) await rl.consume(`k${i}`, t0 + i);
    // the most recent key is still tracked
    expect((await rl.consume("k99", t0 + 100)).ok).toBe(false);
  });

  it("names limiters for each form and formats retry times", async () => {
    expect(rateLimiter("contactSales")).toBe(rateLimiter("contactSales"));
    const contact = rateLimiter("contactSales");
    for (let i = 0; i < 5; i++) expect((await contact.consume("test-net", t0)).ok).toBe(true);
    expect((await contact.consume("test-net", t0)).ok).toBe(false);
    expect(retryAfterText(10)).toBe("about 1 minute");
    expect(retryAfterText(42 * 60_000)).toBe("about 42 minutes");
  });

  it("rejects nonsense options", () => {
    expect(() => createMemoryRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
  });
});

describe("time trap token", () => {
  it("accepts a token sent after a human pause", () => {
    const token = issueFormToken("contact-sales", t0);
    expect(verifyFormToken(token, "contact-sales", t0 + 8_000)).toEqual({ ok: true, ageMs: 8_000 });
  });

  it("rejects a submission faster than a person could fill the form", () => {
    const token = issueFormToken("signup", t0);
    expect(verifyFormToken(token, "signup", t0 + MIN_AGE_MS - 1)).toEqual({ ok: false, reason: "too_fast" });
    expect(verifyFormToken(token, "signup", t0 + MIN_AGE_MS).ok).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = issueFormToken("signup", t0);
    expect(verifyFormToken(token, "signup", t0 + MAX_AGE_MS).ok).toBe(true);
    expect(verifyFormToken(token, "signup", t0 + MAX_AGE_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tampered tokens", () => {
    const token = issueFormToken("signup", t0);
    const [, nonce, sig] = token.split(".");
    // backdating the timestamp to skip the wait breaks the signature
    const backdated = `${(t0 - 60_000).toString(36)}.${nonce}.${sig}`;
    expect(verifyFormToken(backdated, "signup", t0 + 1_000)).toEqual({ ok: false, reason: "invalid" });
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyFormToken(flipped, "signup", t0 + 5_000)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyFormToken("1.2.3", "signup", t0)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyFormToken("x".repeat(500), "signup", t0)).toEqual({ ok: false, reason: "invalid" });
  });

  it("can't be replayed on a different form", () => {
    const token = issueFormToken("signup", t0);
    expect(verifyFormToken(token, "contact-sales", t0 + 5_000)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects missing tokens and tokens dated in the future", () => {
    expect(verifyFormToken(null, "signup", t0)).toEqual({ ok: false, reason: "missing" });
    expect(verifyFormToken("", "signup", t0)).toEqual({ ok: false, reason: "missing" });
    const future = issueFormToken("signup", t0 + 10 * 60_000);
    expect(verifyFormToken(future, "signup", t0)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("form guard", () => {
  const formWith = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  it("passes a person's submission", () => {
    const f = formWith({ [FORM_TOKEN_FIELD]: issueFormToken("signup", t0), [HONEYPOT_FIELD]: "" });
    expect(checkFormGuard(f, "signup", t0 + 5_000)).toEqual({ status: "ok" });
  });

  it("flags a filled honeypot as a bot, before checking the token", () => {
    const f = formWith({ [HONEYPOT_FIELD]: "https://spam.example" });
    expect(checkFormGuard(f, "signup", t0)).toEqual({ status: "bot" });
  });

  it("asks to retry with a usable token when the trap fails", () => {
    const tooFast = issueFormToken("signup", t0);
    const r1 = checkFormGuard(formWith({ [FORM_TOKEN_FIELD]: tooFast }), "signup", t0 + 500);
    expect(r1.status).toBe("retry");
    if (r1.status === "retry") {
      expect(r1.error).toMatch(/wait a few seconds/i);
      expect(r1.formToken).toBe(tooFast); // will be old enough on the next try
    }
    const r2 = checkFormGuard(formWith({}), "signup", t0);
    expect(r2.status).toBe("retry");
    if (r2.status === "retry") expect(verifyFormToken(r2.formToken, "signup", t0 + 5_000).ok).toBe(true);
  });
});

describe("leadSchema", () => {
  const valid = {
    name: "Asha Menon",
    email: "asha@acme.example",
    company: "Acme Retail",
    sites: "2-10",
    pageviews: "100k-1m",
    regions: ["in", "eu"],
    message: "DPDPA rollout across 12 sites.",
  };
  const errorsFor = (input: unknown) => {
    const r = leadSchema.safeParse(input);
    return r.success ? {} : (Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])) as Record<string, string>);
  };

  it("accepts a complete enquiry and normalises it", () => {
    const r = leadSchema.parse({ ...valid, name: "  Asha Menon ", email: "  Asha@ACME.Example ", regions: ["in", "in", "eu"] });
    expect(r.name).toBe("Asha Menon");
    expect(r.email).toBe("asha@acme.example");
    expect(r.regions).toEqual(["in", "eu"]);
  });

  it("allows an empty message", () => {
    expect(leadSchema.safeParse({ ...valid, message: "" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...valid, message: undefined }).success).toBe(true);
  });

  it("explains what to fix for a bad email", () => {
    expect(errorsFor({ ...valid, email: "asha" }).email).toBe("Enter a work email like name@company.com.");
    expect(errorsFor({ ...valid, email: "" }).email).toBe("Enter a work email like name@company.com.");
    expect(errorsFor({ ...valid, email: `${"a".repeat(250)}@acme.example` }).email).toMatch(/under 254 characters/);
  });

  it("asks for a work email instead of free mail", () => {
    expect(errorsFor({ ...valid, email: "asha@gmail.com" }).email).toMatch(/work email/);
  });

  it("rejects disposable inboxes, including subdomains", () => {
    expect(errorsFor({ ...valid, email: "x@mailinator.com" }).email).toMatch(/temporary inboxes/);
    expect(errorsFor({ ...valid, email: "x@team.yopmail.com" }).email).toMatch(/temporary inboxes/);
  });

  it("trims before checking length, and caps every text field", () => {
    expect(errorsFor({ ...valid, name: "  A  " }).name).toBe("Enter your full name.");
    expect(errorsFor({ ...valid, name: "A".repeat(121) }).name).toMatch(/under 120/);
    expect(errorsFor({ ...valid, company: "C".repeat(161) }).company).toMatch(/under 160/);
    expect(errorsFor({ ...valid, message: "m".repeat(2001) }).message).toMatch(/under 2,000/);
  });

  it("rejects links in name and company", () => {
    expect(errorsFor({ ...valid, name: "Buy now https://spam.example" }).name).toMatch(/without links/);
    expect(errorsFor({ ...valid, company: "www.spam.example" }).company).toMatch(/without links/);
  });

  it("allows up to 3 links in the message, not more", () => {
    const links = (n: number) => Array.from({ length: n }, (_, i) => `https://acme.example/${i}`).join(" ");
    expect(leadSchema.safeParse({ ...valid, message: links(3) }).success).toBe(true);
    expect(errorsFor({ ...valid, message: links(4) }).message).toMatch(/at most 3 links/);
  });

  it("flags common spam phrasing", () => {
    expect(errorsFor({ ...valid, message: "We offer SEO services to get you on the first page of Google" }).message).toMatch(/spam filter/);
    expect(leadSchema.safeParse({ ...valid, message: "We need SEO-friendly consent banners for 40 sites." }).success).toBe(true);
  });

  it("checks enum fields against the allowed values", () => {
    const e = errorsFor({ ...valid, sites: "1000", pageviews: "", regions: ["mars"] });
    expect(e.sites).toBe("Choose how many websites you run.");
    expect(e.pageviews).toBe("Choose your monthly pageviews.");
    expect(e["regions.0"]).toBe("Choose regions from the list.");
    expect(errorsFor({ ...valid, regions: [] }).regions).toMatch(/at least one region/);
  });
});

describe("spam helpers", () => {
  it("counts links in several forms", () => {
    expect(countLinks("see http://a.example and https://b.example, www.c.example, [url=x] and <a href=y>")).toBe(5);
    expect(countLinks("plain text")).toBe(0);
  });
  it("doesn't flag ordinary business text", () => {
    expect(hasSpamMarkers("We run 12 storefronts and need DPDPA consent with data in Mumbai.")).toBe(false);
    expect(isDisposableEmail("ops@acme.example")).toBe(false);
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });
});
