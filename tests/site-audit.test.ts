import { describe, expect, it } from "vitest";
import { hasReadableNotice, isJsRendered, periodDays, runChecks, trackersInHtml, cookieNames, type AuditInput, type AuditPage } from "@/lib/site-audit/checks";
import { pickCandidates, registrableDomain, sameSite } from "@/lib/site-audit/crawl";
import { decodeEntities, extractLinks, extractScripts, hreflangs, htmlLang, htmlToText, quoteAround } from "@/lib/site-audit/html";
import { parseRobots, robotsAllows } from "@/lib/site-audit/robots";
import type { SiteCheck, SiteCheckId } from "@/lib/site-audit/types";
import { defaultConfig } from "@/lib/defaults";
import { dpdpReadiness } from "@/lib/readiness";
import { planById } from "@/lib/plans";

/* ---------------- fixtures ---------------- */

const HOME = `<!doctype html><html lang="en-IN"><head><title>Acme</title>
<script>window.dataLayer=[];</script>
<script src="https://cdn.theplaintheory.in/sdk/v1/plain-consent.js" data-site-key="pk_1"></script>
<style>.x{color:red}</style></head>
<body><header><nav><a href="/">Home</a> <a href="/shop">Shop</a></nav></header>
<main><h1>Acme sells kettles across India</h1><p>Prices from &#8377;999. Free delivery on every order, returns within 30 days of purchase.</p>
<p>We make the quietest kettles in Pune and ship them anywhere in the country with tracking and support.</p></main>
<footer><a href="/privacy-policy">Privacy policy</a> · <a href="/terms">Terms</a> · <a href="/contact-us">Contact</a> · <a href="https://other.example/privacy">Partner privacy</a>
<a href="/hi/" hreflang="hi">हिन्दी</a></footer></body></html>`;

const PRIVACY = `<html><body><main><h1>Privacy notice</h1>
<p>This notice explains how Acme Kettles Private Limited processes your personal data under the Digital Personal Data Protection Act, 2023.</p>
<h2>Your rights</h2>
<p>You have the right to access a summary of your personal data, the right to correction and erasure of your personal data, and the right to nominate another individual to exercise your rights in the event of death or incapacity.</p>
<p>You may withdraw your consent at any time using the Privacy choices button on every page.</p>
<h2>Grievance redressal</h2>
<p>Grievance Officer: Priya Sharma, Head of Legal. Email: grievance@acme.in. We will respond to your grievance within 30 days of receiving it.</p>
<p>If you are not satisfied, you may complain to the Data Protection Board of India.</p>
<h2>Children</h2><p>We do not knowingly process the personal data of children without verifiable parental consent.</p>
${"<p>We keep records as long as the law requires and protect them with reasonable security safeguards.</p>".repeat(5)}
</main></body></html>`;

const THIN_PRIVACY = `<html><body><main><h1>Privacy</h1><p>We respect your privacy. We use cookies to improve the site and to understand how it is used.
We may share data with service providers who help us run our business. Contact us with any questions about this page. ${"We take care of the information you share with us. ".repeat(10)}</p></main></body></html>`;

const SPA = `<!doctype html><html lang="en"><head><title>App</title><script type="module" src="/assets/index-abc.js"></script></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

const page = (url: string, kind: AuditPage["kind"], html: string): AuditPage => ({ url, kind, html, text: htmlToText(html) });

function input(over: Partial<AuditInput> & { homeHtml?: string; setCookies?: string[]; hsts?: string | null; homeUrl?: string } = {}): AuditInput {
  const homeUrl = over.homeUrl ?? "https://acme.in/";
  const homeHtml = over.homeHtml ?? HOME;
  return {
    domain: over.domain ?? "acme.in",
    home: over.home === null ? null : { ...page(homeUrl, "home", homeHtml), setCookies: over.setCookies ?? [], hsts: over.hsts === undefined ? "max-age=31536000" : over.hsts },
    pages: over.pages ?? [page("https://acme.in/privacy-policy", "privacy", PRIVACY)],
    visits: over.visits ?? [{ url: "https://acme.in/privacy-policy", kind: "privacy", status: 200 }],
  };
}

const check = (checks: SiteCheck[], id: SiteCheckId) => checks.find((c) => c.id === id)!;

/* ---------------- HTML ---------------- */

describe("html to text", () => {
  it("drops scripts, styles, head and comments, keeps visible text on lines", () => {
    const text = htmlToText(`<html><head><title>T</title><style>a{}</style></head><body><!-- hidden --><script>var secret = 1;</script><p>Hello <b>world</b></p><div>Second&nbsp;line &amp; more</div></body></html>`);
    expect(text).toBe("Hello world\nSecond line & more");
  });

  it("decodes named and numeric entities", () => {
    expect(decodeEntities("&#8377;5 &#x20B9;6 &rsquo; &unknown;")).toBe("₹5 ₹6 ’ &unknown;");
  });

  it("extracts absolute links with text, aria-label fallback and no fragments", () => {
    const links = extractLinks(`<a href="/privacy#top">Privacy <span>policy</span></a><a href='terms' aria-label="Terms of use"><svg></svg></a><a>no href</a>`, "https://acme.in/en/");
    expect(links).toEqual([
      { href: "https://acme.in/privacy", text: "Privacy policy", hreflang: undefined },
      { href: "https://acme.in/en/terms", text: "Terms of use", hreflang: undefined },
    ]);
  });

  it("reads scripts, lang and hreflang", () => {
    expect(extractScripts(HOME).map((s) => s.src).filter(Boolean)).toEqual(["https://cdn.theplaintheory.in/sdk/v1/plain-consent.js"]);
    expect(htmlLang(HOME)).toBe("en-in");
    expect(hreflangs(`<link rel="alternate" hreflang="ta-IN" href="/ta"><a hreflang="x-default" href="/">`)).toEqual(["ta-in", "x-default"]);
  });

  it("quotes at most 200 characters around a match", () => {
    const text = `${"lorem ipsum ".repeat(40)}Grievance Officer: Priya ${"dolor sit ".repeat(40)}`;
    const i = text.indexOf("Grievance");
    const q = quoteAround(text, i, i + 17);
    expect(q.length).toBeLessThanOrEqual(200);
    expect(q).toContain("Grievance Officer");
    expect(q.startsWith("…")).toBe(true);
  });
});

/* ---------------- robots, domains, candidates ---------------- */

describe("robots.txt", () => {
  const txt = `User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: Googlebot\nDisallow: /`;
  it("applies the * group with longest-match precedence", () => {
    const r = parseRobots(txt);
    expect(robotsAllows(r, "/privacy")).toBe(true);
    expect(robotsAllows(r, "/private/x")).toBe(false);
    expect(robotsAllows(r, "/private/ok/1")).toBe(true);
  });
  it("prefers a group that names our user agent", () => {
    const r = parseRobots(`User-agent: *\nAllow: /\n\nUser-agent: PlainTheoryScanner\nDisallow: /legal`);
    expect(robotsAllows(r, "/legal/privacy")).toBe(false);
    expect(robotsAllows(r, "/")).toBe(true);
  });
  it("supports * and $ patterns", () => {
    const r = parseRobots(`User-agent: *\nDisallow: /*.pdf$`);
    expect(robotsAllows(r, "/notice.pdf")).toBe(false);
    expect(robotsAllows(r, "/notice.pdf?x")).toBe(true);
  });
});

describe("same site", () => {
  it("knows common second-level public suffixes", () => {
    expect(registrableDomain("www.acme.co.in")).toBe("acme.co.in");
    expect(registrableDomain("shop.acme.in")).toBe("acme.in");
    expect(registrableDomain("acme.com")).toBe("acme.com");
    expect(sameSite("www.acme.in", "acme.in")).toBe(true);
    expect(sameSite("acme.in.evil.com", "acme.in")).toBe(false);
    expect(sameSite("notacme.in", "acme.in")).toBe(false);
  });

  it("picks same-site policy pages, privacy first, and skips other sites and PDFs", () => {
    const links = extractLinks(HOME + `<a href="/legal/privacy.pdf">Privacy notice (PDF)</a><a href="/grievance">Grievance redressal</a>`, "https://acme.in/");
    const { picked, pdfs } = pickCandidates(links, "acme.in", new Set());
    expect(picked.map((c) => [c.kind, new URL(c.url).pathname])).toEqual([
      ["privacy", "/privacy-policy"],
      ["grievance", "/grievance"],
      ["contact", "/contact-us"],
      ["terms", "/terms"],
    ]);
    expect(pdfs).toEqual(["https://acme.in/legal/privacy.pdf"]);
  });
});

/* ---------------- detectors ---------------- */

describe("live site checks on a good site", () => {
  const { checks, notices } = runChecks(input());

  it("passes every policy check with evidence", () => {
    for (const id of ["privacy-notice", "grievance-contact", "grievance-timeline", "rights", "board-complaint", "consent-withdrawal", "children"] as const) {
      expect(check(checks, id).status, id).toBe("pass");
    }
    const g = check(checks, "grievance-contact");
    expect(g.evidence?.url).toBe("https://acme.in/privacy-policy");
    expect(g.evidence?.quote).toContain("Grievance Officer");
    expect(g.evidence!.quote!.length).toBeLessThanOrEqual(200);
    expect(check(checks, "grievance-timeline").finding).toContain("30 days");
  });

  it("finds our consent tool, no trackers, HTTPS with HSTS and an Eighth Schedule language", () => {
    expect(check(checks, "cmp-present")).toMatchObject({ status: "pass", finding: "Plain Theory found." });
    expect(check(checks, "pre-consent-trackers").status).toBe("pass");
    expect(check(checks, "cookies-on-load").status).toBe("pass");
    expect(check(checks, "https").status).toBe("pass");
    expect(check(checks, "languages")).toMatchObject({ status: "pass", items: ["Hindi"] });
  });

  it("has no notices", () => {
    expect(notices).toEqual([]);
  });
});

describe("grievance contact", () => {
  it("fails when a readable notice has no officer or contact", () => {
    const c = check(runChecks(input({ pages: [page("https://acme.in/privacy", "privacy", THIN_PRIVACY)] })).checks, "grievance-contact");
    expect(c.status).toBe("fail");
    expect(c.action?.target).toBe("settings:dpo");
  });
  it("warns when an officer is named without an email or form", () => {
    const html = PRIVACY.replace("Email: grievance@acme.in.", "");
    expect(check(runChecks(input({ pages: [page("https://acme.in/privacy", "privacy", html)] })).checks, "grievance-contact").status).toBe("warn");
  });
  it("warns on a bare privacy@ address with no designation", () => {
    const html = THIN_PRIVACY.replace("Contact us", "Write to privacy@acme.in");
    const c = check(runChecks(input({ pages: [page("https://acme.in/privacy", "privacy", html)] })).checks, "grievance-contact");
    expect(c.status).toBe("warn");
    expect(c.finding).toContain("privacy@acme.in");
  });
  it("accepts a DPO with a form, and ignores lowercase 'dpo' in addresses", () => {
    const withForm = `<p>Our Data Protection Officer can be reached through the grievance form on this page.</p>`;
    expect(check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", THIN_PRIVACY + withForm)] })).checks, "grievance-contact").status).toBe("pass");
    const lower = THIN_PRIVACY.replace("Contact us", "Visit acme.in/dpo for more");
    expect(check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", lower)] })).checks, "grievance-contact").status).toBe("fail");
  });
  it("says couldn't check, not fail, when no notice was read", () => {
    expect(check(runChecks(input({ pages: [], visits: [] })).checks, "grievance-contact").status).toBe("unknown");
  });
});

describe("grievance timeline", () => {
  const run = (sentence: string) => check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", THIN_PRIVACY + `<p>${sentence}</p>`)] })).checks, "grievance-timeline");
  it("passes at or under 90 days, in words or numbers", () => {
    expect(run("Grievances will be resolved within ninety (90) days.").status).toBe("pass");
    expect(run("We respond to complaints within one month.").status).toBe("pass");
  });
  it("warns above 90 days, including working days that run longer", () => {
    expect(run("We address grievances within 120 days.").status).toBe("warn");
    expect(run("Complaints are resolved within 70 working days.").status).toBe("warn");
  });
  it("ignores periods that aren't about grievances or requests", () => {
    expect(run("Returns are accepted within 30 days of delivery.").status).toBe("warn");
    expect(run("Returns are accepted within 30 days of delivery.").finding).toContain("doesn't say");
  });
  it("converts periods to days", () => {
    const m = "within 2 weeks".match(/within (\d+)\s*()(weeks)/)!;
    expect(periodDays(m)).toBe(14);
  });
});

describe("rights, Board, withdrawal, children", () => {
  const thin = runChecks(input({ pages: [page("https://acme.in/privacy", "privacy", THIN_PRIVACY)] })).checks;
  it("fails or warns on a thin notice, never passes", () => {
    expect(check(thin, "rights").status).toBe("fail");
    expect(check(thin, "board-complaint").status).toBe("fail"); // .in site: targets India
    expect(check(thin, "consent-withdrawal").status).toBe("fail");
    expect(check(thin, "children").status).toBe("warn");
  });
  it("lists missing rights", () => {
    const html = THIN_PRIVACY + "<p>You can request a copy of your personal data or ask us to delete your personal data.</p>";
    const c = check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", html)] })).checks, "rights");
    expect(c.status).toBe("warn");
    expect(c.items).toEqual(["Missing: correction", "Missing: nomination"]);
  });
  it("reads rights written as a list of verbs", () => {
    const html = THIN_PRIVACY + "<p>You can ask for a summary of the personal data we hold, ask us to correct, complete, update or erase it, and nominate someone to act for you in the event of death.</p>";
    expect(check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", html)] })).checks, "rights").status).toBe("pass");
  });
  it("only warns about the Board for a site not aimed at India", () => {
    const home = HOME.replace('lang="en-IN"', 'lang="en-GB"').replace("&#8377;999", "£20").replace(/<a href="\/hi\/"[^>]*>[^<]*<\/a>/, "");
    const c = check(runChecks(input({ domain: "acme.co.uk", homeUrl: "https://acme.co.uk/", homeHtml: home, pages: [page("https://acme.co.uk/p", "privacy", THIN_PRIVACY)] })).checks, "board-complaint");
    expect(c.status).toBe("warn");
  });
  it("treats opt-out wording as needing review", () => {
    const c = check(runChecks(input({ pages: [page("https://acme.in/p", "privacy", THIN_PRIVACY + "<p>You can opt out of marketing emails.</p>")] })).checks, "consent-withdrawal");
    expect(c.status).toBe("warn");
  });
});

describe("privacy notice link", () => {
  it("fails when a normal homepage has no privacy link", () => {
    const home = HOME.replace('<a href="/privacy-policy">Privacy policy</a>', "").replace('<a href="https://other.example/privacy">Partner privacy</a>', "");
    expect(check(runChecks(input({ homeHtml: home, pages: [], visits: [] })).checks, "privacy-notice").status).toBe("fail");
  });
  it("ignores a 'Privacy choices' button as the notice link", () => {
    const home = HOME.replace('<a href="/privacy-policy">Privacy policy</a>', '<a href="#" >Privacy choices</a>').replace('<a href="https://other.example/privacy">Partner privacy</a>', "");
    expect(check(runChecks(input({ homeHtml: home, pages: [], visits: [] })).checks, "privacy-notice").status).toBe("fail");
  });
  it("warns when the linked page is broken", () => {
    const c = check(runChecks(input({ pages: [], visits: [{ url: "https://acme.in/privacy-policy", kind: "privacy", status: 404 }] })).checks, "privacy-notice");
    expect(c.status).toBe("warn");
  });
  it("warns when a notice exists at a common address but isn't linked", () => {
    const home = HOME.replace('<a href="/privacy-policy">Privacy policy</a>', "").replace('<a href="https://other.example/privacy">Partner privacy</a>', "");
    const guessed = { ...page("https://acme.in/privacy", "privacy", PRIVACY), via: "guess" as const };
    expect(check(runChecks(input({ homeHtml: home, pages: [guessed] })).checks, "privacy-notice").status).toBe("warn");
  });
});

describe("consent tool, trackers and cookies", () => {
  const bare = HOME.replace(/<script src="https:\/\/cdn\.theplaintheory[^>]*><\/script>/, "");
  it("recognises third-party CMPs and Google consent mode", () => {
    const one = bare.replace("</head>", '<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script></head>');
    expect(check(runChecks(input({ homeHtml: one })).checks, "cmp-present").finding).toBe("OneTrust found.");
    expect(check(runChecks(input({ homeHtml: one })).checks, "cmp-present").evidence?.quote).toBe('<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js">');
    const gcm = bare.replace("window.dataLayer=[];", "gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' });");
    expect(check(runChecks(input({ homeHtml: gcm })).checks, "cmp-present").status).toBe("pass");
  });
  it("fails with trackers and no CMP, is unsure when GTM may load one, warns otherwise", () => {
    const tracked = bare.replace("</head>", '<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script src="https://connect.facebook.net/en_US/fbevents.js"></script></head>');
    const { checks } = runChecks(input({ homeHtml: tracked }));
    expect(check(checks, "cmp-present").status).toBe("fail");
    const t = check(checks, "pre-consent-trackers");
    expect(t.status).toBe("warn");
    expect(t.items).toEqual(["Google Analytics", "Meta Pixel"]);
    const gtm = bare.replace("window.dataLayer=[];", "(function(w,d,s,l,i){j.src='https://www.googletagmanager.com/gtm.js?id='+i;})(window,document,'script','dataLayer','GTM-X');");
    expect(check(runChecks(input({ homeHtml: gtm })).checks, "cmp-present").status).toBe("unknown");
    expect(check(runChecks(input({ homeHtml: bare })).checks, "cmp-present").status).toBe("warn");
  });
  it("doesn't count trackers held back with type=text/plain", () => {
    expect(trackersInHtml(`<script type="text/plain" data-category="analytics" src="https://static.hotjar.com/c/hotjar.js"></script>`)).toEqual([]);
    expect(trackersInHtml(`<script src="https://static.hotjar.com/c/hotjar.js"></script>`).map((t) => t.name)).toEqual(["Hotjar"]);
  });
  it("flags tracking cookies set by the server, not essential ones", () => {
    expect(cookieNames(["_ga=GA1.1; Path=/", "session=abc; HttpOnly", "_fbp=fb.1; Path=/"])).toEqual(["_ga", "session", "_fbp"]);
    const c = check(runChecks(input({ setCookies: ["_ga=GA1.1; Path=/", "session=abc; HttpOnly"] })).checks, "cookies-on-load");
    expect(c).toMatchObject({ status: "warn", items: ["_ga"] });
    expect(check(runChecks(input({ setCookies: ["session=abc; HttpOnly", "csrf=1"] })).checks, "cookies-on-load").status).toBe("pass");
  });
});

describe("HTTPS and languages", () => {
  it("warns without HSTS and fails over plain HTTP", () => {
    expect(check(runChecks(input({ hsts: null })).checks, "https").status).toBe("warn");
    expect(check(runChecks(input({ homeUrl: "http://acme.in/" })).checks, "https").status).toBe("fail");
  });
  it("warns about languages only for a site aimed at India", () => {
    const noHindi = HOME.replace(/<a href="\/hi\/"[^>]*>[^<]*<\/a>/, "");
    expect(check(runChecks(input({ homeHtml: noHindi })).checks, "languages").status).toBe("warn");
    const uk = noHindi.replace('lang="en-IN"', 'lang="en-GB"').replace("&#8377;999", "£20");
    expect(check(runChecks(input({ domain: "acme.co.uk", homeUrl: "https://acme.co.uk/", homeHtml: uk })).checks, "languages").status).toBe("pass");
  });
});

describe("JavaScript-rendered sites and missing pages", () => {
  it("detects an app shell and reports a notice instead of failing", () => {
    const text = htmlToText(SPA);
    expect(text).toBe("");
    expect(isJsRendered(SPA, text)).toBe(true);
    expect(isJsRendered(HOME, htmlToText(HOME))).toBe(false);

    const { checks, notices } = runChecks(input({ domain: "app.example", homeUrl: "https://app.example/", homeHtml: SPA, pages: [], visits: [] }));
    expect(notices.map((n) => n.id)).toContain("spa");
    expect(notices.find((n) => n.id === "spa")?.text).toBe("Your site renders with JavaScript; this check reads the HTML. A full browser check is coming.");
    expect(checks.filter((c) => c.status === "fail")).toEqual([]);
    for (const id of ["privacy-notice", "grievance-contact", "rights", "cmp-present", "pre-consent-trackers"] as const) expect(check(checks, id).status, id).toBe("unknown");
  });

  it("says couldn't check for everything when the homepage didn't load", () => {
    const { checks } = runChecks(input({ home: null, pages: [], visits: [] }));
    expect(checks.every((c) => c.status === "unknown")).toBe(true);
  });

  it("only trusts 'not found' after reading a real notice", () => {
    expect(hasReadableNotice(input())).toBe(true);
    expect(hasReadableNotice(input({ pages: [] }))).toBe(false);
  });
});

/* ---------------- readiness evidence ---------------- */

describe("readiness grievance item with a live site check", () => {
  const org = { id: "org_1", name: "Acme", plan: "free", dataRegion: "ap-south-1", createdAt: "2026-01-01T00:00:00Z", dpo: { name: "Priya", email: "dpo@acme.in" } } as never;
  const property = {
    id: "p1",
    orgId: "org_1",
    domain: "acme.in",
    publishedVersion: 0,
    config: defaultConfig("acme.in"),
    trackers: [],
  } as never;

  it("adds evidence without changing pass or fail", () => {
    const plan = planById("free" as never);
    const before = dpdpReadiness(property, org, plan).items.find((i) => i.id === "grievance")!;
    const { checks } = runChecks(input({ pages: [page("https://acme.in/privacy", "privacy", THIN_PRIVACY)] }));
    const liveSite = { id: "sad_1", propertyId: "p1", domain: "acme.in", homeUrl: "https://acme.in/", startedAt: "", finishedAt: "", durationMs: 0, pages: [{ url: "https://acme.in/privacy", kind: "privacy" as const, status: 200 }], notices: [], checks, summary: { pass: 0, warn: 0, fail: 0, unknown: 0 } };
    const after = dpdpReadiness(property, org, plan, { liveSite }).items.find((i) => i.id === "grievance")!;
    expect(after.severity).toBe(before.severity);
    expect(after.detail).toContain("Your Settings have a contact, but we couldn't find it on acme.in/privacy.");
  });
});
