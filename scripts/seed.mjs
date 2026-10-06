// Seeds the local file store with a demo workspace: `npm run seed`.
// Reuses the app's own hashing and defaults (Node 24 runs the .ts modules directly), so the
// generated consent chain verifies exactly like production receipts.
import { promises as fs } from "node:fs";
import path from "node:path";
import { GENESIS_HASH, anonymizeIp, hashPassword, hashReceipt, id } from "../src/lib/crypto.ts";
import { KNOWN_TRACKERS, defaultConfig } from "../src/lib/defaults.ts";
import { NOTICE_DRAFTS } from "../src/lib/i18n/notice-drafts.ts";
import { AUDIT_GENESIS, hashAudit } from "../src/lib/audit-chain.ts";
import { generateRecoveryCodes } from "../src/lib/auth/totp.ts";
import { seal } from "../src/lib/auth/secret-box.ts";

const DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
const DAYS = 75;
// Signal fields (gpc, automated, language) shipped 20 days ago; older receipts don't have them.
const SIGNAL_DAYS = 20;
const DEMO = { email: "demo@theplaintheory.com", password: "plain-demo-2026", name: "Asha Menon" };
// Dev-only TOTP secret for the seeded admin, so the two-factor sign-in can be tried locally.
const ADMIN_TOTP_SECRET = "PLAINTHEORYDEMOADMINTWOFACTOR234";

// Deterministic PRNG so every seed produces the same charts.
let state = 20261006;
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (weights) => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
  return Object.keys(weights)[0];
};

const COUNTRIES = { IN: 38, DE: 9, FR: 6, GB: 8, NL: 3, ES: 3, US: 16, SG: 4, AE: 4, AU: 5, CA: 4 };
const DEVICES = { mobile: 58, desktop: 36, tablet: 6 };
const BROWSERS = { Chrome: 61, Safari: 23, Edge: 7, Firefox: 6, Other: 3 };
const EEA = new Set("DE FR GB NL ES".split(" "));
// Base outcome odds per notice; opt-in drifts up over time as the copy is improved.
const ODDS = {
  gdpr: { accept_all: 0.46, custom: 0.21, reject_all: 0.33 },
  dpdpa: { accept_all: 0.55, custom: 0.24, reject_all: 0.21 },
  ccpa: { accept_all: 0.81, custom: 0.05, reject_all: 0.14 },
  generic: { accept_all: 0.69, custom: 0.11, reject_all: 0.2 },
};

const frameworkFor = (country, region) => (EEA.has(country) ? "gdpr" : country === "IN" ? "dpdpa" : country === "US" && region === "CA" ? "ccpa" : "generic");

function categoriesFor(action) {
  if (action === "accept_all") return { essential: true, functional: true, analytics: true, marketing: true };
  if (action === "reject_all" || action === "revoke") return { essential: true, functional: false, analytics: false, marketing: false };
  return { essential: true, functional: rand() < 0.7, analytics: rand() < 0.75, marketing: rand() < 0.2 };
}

function buildReceipts(propertyId, perDay, configVersion, days = DAYS) {
  const out = [];
  const now = Date.now();
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(now - d * 864e5);
    dayStart.setUTCHours(0, 0, 0, 0);
    const weekend = [0, 6].includes(dayStart.getUTCDay());
    const n = Math.round(perDay * (weekend ? 0.7 : 1) * (0.8 + rand() * 0.4));
    const lift = Math.max(0, (DAYS - d) / DAYS) * 0.08;
    for (let i = 0; i < n; i++) {
      const country = pick(COUNTRIES);
      const region = country === "US" ? (rand() < 0.45 ? "CA" : "NY") : "";
      const framework = frameworkFor(country, region);
      const o = ODDS[framework];
      let action = pick({ accept_all: o.accept_all + lift, custom: o.custom, reject_all: Math.max(0.05, o.reject_all - lift) });
      if (rand() < 0.008) action = "revoke";
      const ts = new Date(dayStart.getTime() + Math.floor(rand() * 864e5));
      if (ts.getTime() > now) continue;
      const signals =
        d < SIGNAL_DAYS
          ? {
              // CCPA opt-outs often arrive via Global Privacy Control
              gpc: framework === "ccpa" && action === "reject_all" ? rand() < 0.6 : false,
              automated: rand() < 0.012,
              language: framework === "dpdpa" ? (rand() < 0.31 ? "hi" : rand() < 0.08 ? "ta" : "en") : "en",
            }
          : {};
      out.push({
        propertyId,
        visitorId: `v_${Math.floor(rand() * 2 ** 48).toString(36)}`,
        action,
        framework,
        categories: categoriesFor(action),
        country,
        device: pick(DEVICES),
        browser: pick(BROWSERS),
        ipHash: anonymizeIp(`${10 + Math.floor(rand() * 200)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`),
        configVersion,
        ...signals,
        timestamp: ts.toISOString(),
      });
    }
  }
  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let prev = GENESIS_HASH;
  return out.map((draft, i) => {
    const unsigned = { ...draft, id: id("rcpt"), seq: i + 1, prevHash: prev };
    const receipt = { ...unsigned, hash: hashReceipt(unsigned) };
    prev = receipt.hash;
    return receipt;
  });
}

const LEAK_SOURCES = [
  // Meta Pixel is a listed tracker: these fire because a tag manager loads it before plain-consent.js
  { url: "connect.facebook.net/en_US/fbevents.js", category: "marketing", pages: { "/checkout": 6, "/cart": 3 }, weight: 14 },
  // Not on the tracker list at all
  { url: "analytics.tiktok.com/i18n/pixel/events.js", category: "marketing", pages: { "/": 5, "/products/darjeeling": 2 }, weight: 11 },
  { url: "bat.bing.com/bat.js", category: "marketing", pages: { "/": 3 }, weight: 6 },
  { url: "cdn.segment.com/analytics.js/v1/k3x/analytics.min.js", category: "analytics", pages: { "/products/darjeeling": 2, "/journal": 1 }, weight: 7 },
];

function buildLeaks(propertyId, total, maxAgeDays = 26) {
  const out = [];
  const now = Date.now();
  const weights = Object.fromEntries(LEAK_SOURCES.map((l, i) => [i, l.weight]));
  for (let i = 0; i < total; i++) {
    const src = LEAK_SOURCES[Number(pick(weights))];
    const page = pick(src.pages);
    const country = pick({ IN: 5, DE: 3, FR: 2, GB: 2, US: 1 });
    const framework = country === "IN" ? "dpdpa" : country === "US" ? "ccpa" : "gdpr";
    out.push({
      id: id("leak"),
      propertyId,
      url: src.url,
      category: src.category,
      page,
      framework,
      country,
      createdAt: new Date(now - Math.floor(rand() * maxAgeDays * 864e5)).toISOString(),
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function countersFrom(propertyId, receipts) {
  const byDay = new Map();
  for (const r of receipts) {
    if (r.action === "revoke") continue;
    const day = r.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay].map(([day, decisions]) => {
    const bounceRate = 0.17 + rand() * 0.08;
    const views = Math.round(decisions / (1 - bounceRate));
    return { propertyId, day, views, bounces: views - decisions };
  });
}

function property(orgId, name, domain, published, siteKey) {
  const now = new Date().toISOString();
  const config = defaultConfig(domain);
  const trackers = KNOWN_TRACKERS.filter((t) => ["Google Analytics", "Meta Pixel", "Hotjar", "Microsoft Clarity"].includes(t.name)).map((t) => ({ id: id("trk", 6), ...t }));
  return {
    id: id("prop"),
    orgId,
    name,
    domain,
    siteKey: siteKey ?? `pk_${id("k", 12).slice(2)}`,
    config: { ...config, version: published ? 3 : 2 },
    trackers,
    publishedVersion: published ? 3 : 0,
    publishedAt: published ? new Date(Date.now() - 6 * 864e5).toISOString() : undefined,
    published: published ? { config: { ...config, version: 3 }, trackers } : undefined,
    createdAt: new Date(Date.now() - DAYS * 864e5).toISOString(),
    updatedAt: now,
  };
}

/** A server-side session record (12-hour absolute lifetime, as the app issues them). */
function session(u, userAgent, startedMinsAgo, lastSeenMinsAgo, mfaVerified) {
  const createdAt = new Date(Date.now() - startedMinsAgo * 60_000);
  return {
    id: id("ses", 24),
    userId: u.id,
    createdAt: createdAt.toISOString(),
    lastSeenAt: new Date(Date.now() - lastSeenMinsAgo * 60_000).toISOString(),
    expiresAt: new Date(createdAt.getTime() + 12 * 3_600_000).toISOString(),
    ipHash: anonymizeIp(`49.205.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`),
    userAgent,
    mfaVerified,
  };
}

/** A believable, hash-chained audit trail for each organization, built with the app's own hashing. */
function buildAudit({ org, agencyOrg, user, teammate, auditor, store, blog, agencySite, created }) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const ip = anonymizeIp("49.205.12.34");
  const at = (daysAgo, mins = 0) => new Date(Date.now() - daysAgo * 864e5 - mins * 60_000).toISOString();
  const by = (u) => ({ actorUserId: u.id, actorEmail: u.email });
  const site = (p) => ({ type: "property", id: p.id, label: p.domain });
  const person = (u) => ({ type: "user", id: u.id, label: u.email });
  const chain = (orgId, rows) => {
    let prev = AUDIT_GENESIS;
    return rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r, i) => {
        const unsigned = { id: id("aud"), orgId, seq: i + 1, ...r, ipHash: r.ipHash ?? ip, userAgent: r.userAgent ?? UA, prevHash: prev };
        const event = { ...unsigned, hash: hashAudit(unsigned) };
        prev = event.hash;
        return event;
      });
  };
  const ev = (createdAt, actor, action, target, metadata) => ({ createdAt, ...actor, action, target, ...(metadata ? { metadata } : {}) });

  const acme = chain(org.id, [
    ev(created, by(user), "org.created", { type: "org", id: org.id, label: org.name }, { dataRegion: org.dataRegion }),
    ev(at(74, -5), by(user), "property.created", site(store)),
    ev(at(74, -10), by(user), "member.invited", person(teammate), { role: "admin", existingAccount: "no" }),
    ev(at(74, -12), by(user), "member.invited", person(auditor), { role: "viewer", existingAccount: "no" }),
    ev(at(73), by(teammate), "member.joined", person(teammate), { role: "admin" }),
    ev(at(73, -40), by(auditor), "member.joined", person(auditor), { role: "viewer" }),
    ev(at(72), by(user), "banner.updated", site(store), { version: 2 }),
    ev(at(72, -20), by(user), "property.published", site(store), { version: 2, fairnessScore: 100 }),
    ev(at(70), by(user), "org.settings_updated", { type: "org", id: org.id, label: org.name }, { changed: "dpo" }),
    ev(at(60), by(teammate), "auth.mfa_enabled", person(teammate)),
    ev(at(55), by(user), "property.created", site(blog)),
    ev(at(40), by(user), "webhook.created", site(store), { url: "https://crm.acme.example/hooks/plain-theory", events: "consent.withdrawn" }),
    ev(at(33), by(teammate), "tracker.scan_run", site(store), { ok: true }),
    ev(at(33, -3), by(teammate), "tracker.added", site(store), { fromScan: true, added: 2 }),
    ev(at(31), by(user), "property.published", site(store), { version: 3, fairnessScore: 100 }),
    ev(at(30), by(teammate), "webhook.updated", site(store), { active: false }),
    ev(at(21), by(user), "access_review.exported", { type: "org", id: org.id, label: org.name }, { members: 3, invites: 0, withoutMfa: 2 }),
    ev(at(14), { actorUserId: null, actorEmail: "system:stripe" }, "billing.plan_changed", { type: "org", id: org.id, label: org.name }, { from: "growth", to: "business", event: "customer.subscription.updated" }),
    ev(at(12), by(user), "webhook.created", site(store), { url: "http://localhost:9/hooks/consent", events: "consent.withdrawn leak.detected" }),
    ev(at(10), by(user), "language.added", site(store), { framework: "dpdpa", language: "hi", version: 4 }),
    ev(at(10, -30), by(user), "language.added", site(store), { framework: "dpdpa", language: "ta", version: 5 }),
    ev(at(9), by(user), "language.reviewed", site(store), { framework: "dpdpa", language: "hi", reviewer: "Priya Nair", version: 6 }),
    ev(at(9, -50), by(auditor), "auth.login", person(auditor), { mfa: false }),
    ev(at(9, -55), by(auditor), "logs.exported", site(store), { rows: 2840, from: null, to: null, chainOk: true }),
    ev(at(9, -58), by(auditor), "evidence.exported", site(store), { download: true, chainOk: true }),
    ev(at(1, 60 * 2), by(teammate), "auth.login_failed", person(teammate), { reason: "invalid" }),
    ev(at(1, 60 * 2 - 1), by(teammate), "auth.login", person(teammate), { mfa: true, method: "totp" }),
    ev(at(1, 60 * 2 - 6), by(teammate), "regions.updated", site(store), { version: 7 }),
    ev(at(1, 60 * 2 - 9), by(teammate), "logs.chain_verified", site(store), { ok: true, checked: 2840 }),
    ev(at(0, 95), by(user), "auth.login", person(user), { mfa: false }),
    ev(at(0, 30), by(teammate), "member.invited", { type: "invite", id: "inv_seed", label: "marketing@acme.example" }, { role: "viewer" }),
  ]);
  const northwind = chain(agencyOrg.id, [
    ev(created, by(user), "org.created", { type: "org", id: agencyOrg.id, label: agencyOrg.name }, { dataRegion: agencyOrg.dataRegion }),
    ev(at(74, -3), by(user), "property.created", site(agencySite)),
    ev(at(74, -9), by(user), "property.published", site(agencySite), { version: 3, fairnessScore: 100 }),
    ev(at(0, 95), by(user), "auth.login", person(user), { mfa: false }),
  ]);
  return { [org.id]: acme, [agencyOrg.id]: northwind };
}

async function main() {
  await fs.rm(DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(DIR, "receipts"), { recursive: true });

  const created = new Date(Date.now() - DAYS * 864e5).toISOString();
  const user = { id: id("usr"), email: DEMO.email, name: DEMO.name, passwordHash: await hashPassword(DEMO.password), createdAt: created };
  const teammate = { id: id("usr"), email: "rohan@acme.example", name: "Rohan Iyer", passwordHash: await hashPassword(DEMO.password), createdAt: created };
  const auditor = { id: id("usr"), email: "dpo@acme.example", name: "Meera Shah", passwordHash: await hashPassword(DEMO.password), createdAt: created };
  const ago = (mins) => new Date(Date.now() - mins * 60_000).toISOString();
  for (const u of [user, teammate, auditor]) u.passwordChangedAt = created;
  user.lastActiveAt = ago(12);
  teammate.lastActiveAt = ago(60 * 26);
  auditor.lastActiveAt = ago(60 * 24 * 9);
  const adminRecovery = generateRecoveryCodes();
  teammate.mfa = { secretEnc: seal(ADMIN_TOTP_SECRET), enabledAt: ago(60 * 24 * 60), recoveryCodes: adminRecovery.hashes };

  const org = {
    id: id("org"),
    name: "Acme Retail",
    plan: "business",
    dataRegion: "ap-south-1",
    dpo: { name: "Meera Shah", email: "dpo@acme.example", address: "Level 4, 12 MG Road, Bengaluru 560001" },
    createdAt: created,
  };
  const agencyOrg = { id: id("org"), name: "Northwind Studio (client)", plan: "free", dataRegion: "ap-south-1", dpo: { name: "Anil Kapoor", email: "privacy@northwind.example" }, createdAt: created };

  const store = property(org.id, "Acme storefront", "shop.acme.example", true);
  {
    const hi = NOTICE_DRAFTS.hi;
    const ta = NOTICE_DRAFTS.ta;
    const reviewedAt = new Date(Date.now() - 9 * 864e5).toISOString();
    const translations = {
      hi: { copy: { ...hi.copy }, categories: structuredClone(hi.categories), status: "reviewed", reviewedBy: "Priya Nair (recorded by demo@theplaintheory.com)", reviewedAt },
      ta: { copy: { ...ta.copy }, categories: structuredClone(ta.categories), status: "draft" },
    };
    const rights = { rightsUrl: "https://shop.acme.example/privacy#your-rights", grievanceEmail: "grievance@acme.example", boardComplaintUrl: undefined };
    for (const cfg of [store.config, store.published.config]) {
      cfg.regions.dpdpa.translations = structuredClone(translations);
      cfg.rights = { ...rights };
    }
    const hook = (url, events, active, daysAgo) => ({ id: id("whk", 6), url, secret: `whsec_${id("s", 24).slice(2)}`, events, active, createdAt: new Date(Date.now() - daysAgo * 864e5).toISOString() });
    store.webhooks = [
      // Nothing listens on port 9, so this one shows failed deliveries and retries.
      hook("http://localhost:9/hooks/consent", ["consent.withdrawn", "leak.detected"], true, 12),
      hook("https://crm.acme.example/hooks/plain-theory", ["consent.withdrawn"], false, 40),
    ];
  }
  const blog = property(org.id, "Acme journal", "journal.acme.example", false);
  // Backs the /demo store page: it runs on this app's own origin, so the domain is localhost.
  const agencySite = property(agencyOrg.id, "Northwind demo store", "localhost", true, "pk_demo_store");

  // Our own marketing site runs the product too (dogfooding). It sets no analytics or advertising
  // cookies, so the notice only offers the functional category and says so plainly.
  const plainOrg = { id: id("org"), name: "The Plain Theory", plan: "business", dataRegion: "ap-south-1", createdAt: created };
  const plainSite = property(plainOrg.id, "theplaintheory.com", "localhost", true, "pk_plaintheory_web");
  {
    const honest = "We only use cookies this site needs to work, plus one that remembers your preferences. No analytics or advertising cookies.";
    for (const cfg of [plainSite.config, plainSite.published.config]) {
      cfg.categories = cfg.categories.filter((c) => c.id === "essential" || c.id === "functional");
      cfg.theme = { ...cfg.theme, layout: "toast", position: "bottom-right", text: "#0B1020", radius: 16, fabSide: "right" };
      cfg.policyUrl = "/legal/cookies";
      cfg.rights = { rightsUrl: "/legal/privacy#your-rights", grievanceEmail: "privacy@theplaintheory.com", boardComplaintUrl: undefined };
      cfg.leakDetection = false;
      for (const rule of Object.values(cfg.regions)) {
        rule.copy = { ...rule.copy, body: honest, policyLabel: "Cookie policy" };
      }
      cfg.regions.ccpa.copy = { ...cfg.regions.ccpa.copy, title: "Your privacy choices", acceptAll: "Okay", rejectAll: "Essential only" };
    }
    plainSite.trackers = [];
    plainSite.published.trackers = [];
  }

  const receipts = {
    [store.id]: buildReceipts(store.id, 38, 3),
    [blog.id]: buildReceipts(blog.id, 9, 2),
    // 120 days on a 90-day plan: `npm run retention` has receipts to expire.
    [agencySite.id]: buildReceipts(agencySite.id, 6, 3, 120),
  };
  const counters = Object.entries(receipts).flatMap(([pid, rows]) => countersFrom(pid, rows));
  // plus a few reports past the 90-day leak retention
  const leaks = [...buildLeaks(store.id, 42), ...buildLeaks(blog.id, 6)];
  for (const l of buildLeaks(store.id, 4, 20)) leaks.unshift({ ...l, createdAt: new Date(Date.parse(l.createdAt) - 100 * 864e5).toISOString() });
  const deliveries = [];
  {
    const [failing, paused] = store.webhooks;
    const at = (minsAgo) => new Date(Date.now() - minsAgo * 60_000).toISOString();
    const d = (hook, event, status, httpStatus, attempt, durationMs, minsAgo) => ({ id: `${id("dlv")}_${attempt}`, propertyId: store.id, webhookId: hook.id, event, status, httpStatus, attempt, durationMs, createdAt: at(minsAgo) });
    deliveries.push(
      // older than the 30-day delivery-log retention
      d(paused, "consent.withdrawn", "delivered", 200, 1, 175, 60 * 24 * 38),
      d(paused, "consent.withdrawn", "delivered", 200, 1, 162, 60 * 24 * 34),
      d(paused, "consent.withdrawn", "delivered", 200, 1, 182, 60 * 24 * 21),
      d(paused, "consent.withdrawn", "delivered", 204, 1, 141, 60 * 24 * 19),
      d(paused, "consent.withdrawn", "failed", 503, 1, 2010, 60 * 24 * 15),
      d(paused, "consent.withdrawn", "delivered", 200, 2, 233, 60 * 24 * 15 - 1),
      d(failing, "leak.detected", "failed", undefined, 1, 3, 95),
      d(failing, "leak.detected", "failed", undefined, 2, 2, 94),
      d(failing, "leak.detected", "failed", undefined, 3, 2, 90),
      d(failing, "consent.withdrawn", "failed", undefined, 1, 2, 31),
      d(failing, "consent.withdrawn", "failed", undefined, 2, 3, 30),
      d(failing, "consent.withdrawn", "failed", undefined, 3, 2, 26),
    );
    deliveries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const db = {
    users: [user, teammate, auditor],
    orgs: [org, agencyOrg, plainOrg],
    memberships: [
      { orgId: org.id, userId: user.id, role: "owner", createdAt: created },
      { orgId: org.id, userId: teammate.id, role: "admin", invitedBy: DEMO.email, createdAt: created },
      { orgId: org.id, userId: auditor.id, role: "viewer", invitedBy: DEMO.email, createdAt: created },
      { orgId: agencyOrg.id, userId: user.id, role: "admin", createdAt: created },
    ],
    invites: [{ id: id("inv"), orgId: org.id, email: "marketing@acme.example", role: "viewer", invitedBy: "rohan@acme.example", createdAt: new Date().toISOString() }],
    properties: [store, blog, agencySite, plainSite],
    counters,
    leaks,
    deliveries,
    sessions: [
      session(user, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1", 95, 14, false),
      session(teammate, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", 60 * 26 + 30, 60 * 26, true),
    ],
  };

  await fs.mkdir(path.join(DIR, "audit"), { recursive: true });
  const audits = buildAudit({ org, agencyOrg, user, teammate, auditor, store, blog, agencySite, created });
  for (const [orgId, events] of Object.entries(audits)) {
    await fs.writeFile(path.join(DIR, "audit", `${orgId}.jsonl`), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }

  await fs.writeFile(path.join(DIR, "db.json"), JSON.stringify(db, null, 2));
  for (const [pid, rows] of Object.entries(receipts)) {
    await fs.writeFile(path.join(DIR, "receipts", `${pid}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }

  const total = Object.values(receipts).reduce((s, r) => s + r.length, 0);
  console.log(`Reset local data in ${path.relative(process.cwd(), DIR) || DIR}/`);
  console.log(`  ${db.orgs.length} organizations, ${db.properties.length} sites, ${total.toLocaleString()} chained receipts over ${DAYS} days`);
  console.log(`  ${leaks.length} leak reports, ${deliveries.length} webhook deliveries, Hindi (reviewed) and Tamil (draft) on the storefront`);
  console.log(`  Sign in at /login as ${DEMO.email} / ${DEMO.password}`);
  console.log(`  Other roles: rohan@acme.example (admin, two-factor on), dpo@acme.example (viewer), same password`);
  console.log(`  rohan's dev-only TOTP secret: ${ADMIN_TOTP_SECRET} (add it to any authenticator app)`);
  console.log(`  ${Object.values(audits).reduce((s, a) => s + a.length, 0)} audit events, ${db.sessions.length} other sessions`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
