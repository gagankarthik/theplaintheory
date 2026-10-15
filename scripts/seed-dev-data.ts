/**
 * Dev seed data for the local file store. Not run directly: scripts/seed-dev.mjs checks the
 * environment, bundles this file with esbuild and calls `seedDev()`. It writes through the real
 * local store (src/lib/store/local.ts), so receipt hash chains, rollups and audit chains are the
 * same as the app's own.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { localStore as store } from "@/lib/store/local";
import { hashPassword, id, verifyChain } from "@/lib/crypto";
import { buildProperty } from "@/lib/properties";
import { buildConfigVersion } from "@/lib/config-versions";
import { checkPassword } from "@/lib/auth/password-policy";
import { heldTrackers, type Finding, type ScanPage, type ScanReport } from "@/lib/trackers";
import type { AuditDraft } from "@/lib/store/types";
import type {
  AuditAction,
  BannerConfig,
  CategoryId,
  ConsentAction,
  Framework,
  Organization,
  Property,
  Tracker,
  User,
  Webhook,
  WebhookDelivery,
} from "@/lib/types";

export const DEMO_EMAIL = "demo@plaintheory.local";
const DEMO_NAME = "Dana Demo";
const ORG_NAME = "Northwind Demo";
const EDITOR_EMAIL = "ravi.editor@plaintheory.local";
const INVITE_EMAIL = "audit@northwind.example";

export interface SeedResult {
  status: "created" | "exists";
  email: string;
  /** set when a new password was made (fresh seed, or a reset because the credentials file was missing) */
  password?: string;
  summary: string[];
}

/* ---------------- helpers ---------------- */

const DAY = 86_400_000;
const NOW = Date.now();
const ago = (days: number, hours = 0) => new Date(NOW - days * DAY - hours * 3_600_000).toISOString();
const dayOf = (iso: string) => iso.slice(0, 10);

/** Deterministic PRNG (mulberry32) so every seed has the same shape. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of weighted) {
    r -= w;
    if (r <= 0) return v;
  }
  return weighted[weighted.length - 1][0];
}

const hex = (rand: () => number, len: number) => Array.from({ length: len }, () => Math.floor(rand() * 16).toString(16)).join("");

function makePassword(email: string): string {
  for (;;) {
    const pw = randomBytes(18).toString("base64url"); // 24 characters
    if (!checkPassword(pw, email) && !pw.toLowerCase().includes("demo")) return pw;
  }
}

function dataDir() {
  return process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/* ---------------- trackers ---------------- */

type T = Omit<Tracker, "id">;

const STORE_TRACKERS: T[] = [
  { name: "Google Analytics 4", category: "analytics", pattern: "googletagmanager.com/gtag/js", status: "approved", source: "scan", vendor: "Google", purpose: "Measures visits and how people use the store.", kind: "script", expiry: "2 years", party: "third" },
  { name: "_ga", category: "analytics", pattern: "_ga", status: "approved", source: "scan", vendor: "Google", purpose: "Google Analytics visitor id cookie.", kind: "cookie", expiry: "2 years", party: "first" },
  { name: "Meta Pixel", category: "marketing", pattern: "connect.facebook.net", status: "approved", source: "scan", vendor: "Meta", purpose: "Ad conversion tracking and retargeting.", kind: "script", expiry: "3 months", party: "third" },
  { name: "Hotjar", category: "analytics", pattern: "static.hotjar.com", status: "approved", source: "scan", vendor: "Hotjar", purpose: "Heatmaps and session recordings.", kind: "script", expiry: "1 year", party: "third" },
  { name: "Intercom", category: "functional", pattern: "widget.intercom.io", status: "approved", source: "manual", vendor: "Intercom", purpose: "Live chat support widget.", kind: "script", expiry: "9 months", party: "third" },
  { name: "Stripe", category: "essential", pattern: "js.stripe.com", status: "approved", source: "scan", vendor: "Stripe", purpose: "Checkout and fraud prevention.", kind: "script", expiry: "Session", party: "third" },
  { name: "TikTok Pixel", category: "marketing", pattern: "analytics.tiktok.com", status: "review", source: "scan", vendor: "TikTok", purpose: "Ad conversion tracking.", kind: "script", expiry: "13 months", party: "third" },
  { name: "cdn.segment.com", category: null, pattern: "cdn.segment.com", status: "review", source: "scan", kind: "script", party: "third" },
  { name: "Google Fonts", category: "functional", pattern: "fonts.googleapis.com", status: "ignored", source: "scan", vendor: "Google", purpose: "Web fonts.", kind: "script", party: "third" },
];

const DOCS_TRACKERS: T[] = [
  { name: "Google Analytics 4", category: "analytics", pattern: "googletagmanager.com/gtag/js", status: "approved", source: "scan", vendor: "Google", purpose: "Measures which docs pages are read.", kind: "script", expiry: "2 years", party: "third" },
  { name: "Algolia DocSearch", category: "functional", pattern: "algolia.net", status: "approved", source: "scan", vendor: "Algolia", purpose: "Search across the documentation.", kind: "script", expiry: "Session", party: "third" },
  { name: "Intercom", category: "functional", pattern: "widget.intercom.io", status: "approved", source: "manual", vendor: "Intercom", purpose: "Live chat support widget.", kind: "script", expiry: "9 months", party: "third" },
  { name: "LinkedIn Insight Tag", category: "marketing", pattern: "snap.licdn.com", status: "approved", source: "scan", vendor: "LinkedIn", purpose: "B2B ad conversion tracking.", kind: "script", expiry: "6 months", party: "third" },
  { name: "PostHog", category: "analytics", pattern: "us.i.posthog.com", status: "review", source: "scan", vendor: "PostHog", purpose: "Product analytics.", kind: "script", expiry: "1 year", party: "third" },
];

const STORE_PAGES = ["/", "/products", "/products/wool-throw", "/products/oak-side-table", "/cart", "/checkout", "/about", "/privacy", "/journal", "/journal/spring-edit"];
const DOCS_PAGES = ["/", "/getting-started", "/guides/install", "/guides/api", "/reference/sdk", "/changelog", "/search"];

function withInventory(list: T[], domain: string, pages: string[], seenAt: string): Tracker[] {
  return list.map((t, i) => {
    const found = pages.filter((_, j) => (j + i) % 3 !== 1).map((p) => `https://${domain}${p}`);
    return { id: id("trk"), ...t, ...(t.status === "ignored" ? {} : { foundOn: found.slice(0, 5), pageCount: found.length, seenAt }) };
  });
}

function findingsFor(trackers: Tracker[], domain: string): Finding[] {
  return trackers
    .filter((t) => t.source === "scan")
    .map((t) => ({
      kind: t.kind ?? "script",
      name: t.name,
      host: t.kind === "cookie" ? domain : t.pattern.split("/")[0],
      party: t.party ?? "third",
      category: t.category,
      vendor: t.vendor,
      purpose: t.purpose,
      expiry: t.expiry,
      pages: (t.foundOn ?? [`https://${domain}/`]).slice(0, 10),
      pattern: t.pattern,
      sample: t.kind === "cookie" ? t.pattern : `https://${t.pattern}`,
    }));
}

function scanReport(propertyId: string, domain: string, pages: string[], trackers: Tracker[], daysAgo: number, runBy: string, preConsent?: string[]): ScanReport {
  const startedAt = ago(daysAgo, 3);
  const finishedAt = new Date(Date.parse(startedAt) + 94_000).toISOString();
  const scanPages: ScanPage[] = pages.map((p, i) => ({ url: `https://${domain}${p}`, status: i === pages.length - 1 && daysAgo > 20 ? 404 : 200 }));
  const findings = findingsFor(trackers, domain);
  return {
    id: id("scan"),
    propertyId,
    startedAt,
    finishedAt,
    status: "ok",
    engine: "headless",
    progress: { pagesScanned: scanPages.length, pagesQueued: 0, findings: findings.length },
    limits: { maxPages: 50, maxDepth: 3 },
    preConsent: preConsent ?? [],
    workerId: "local-dev-seed",
    homeUrl: `https://${domain}/`,
    pages: scanPages,
    findings,
    runBy,
    log: [
      { at: startedAt, level: "info", message: `Started a headless crawl of ${domain}` },
      { at: new Date(Date.parse(startedAt) + 40_000).toISOString(), level: "info", message: `Scanned ${scanPages.length} pages` },
      { at: finishedAt, level: "info", message: `Finished with ${findings.length} findings` },
    ],
  };
}

/* ---------------- receipts ---------------- */

const COUNTRIES: [string, number][] = [["IN", 35], ["US", 22], ["DE", 15], ["GB", 12], ["FR", 10], ["NL", 6]];
const frameworkFor = (country: string): Framework => (country === "IN" ? "dpdpa" : country === "US" ? "ccpa" : "gdpr");

async function seedReceipts(p: Property, perDay: number, seed: number, v2PublishedAt: string | null) {
  const rand = rng(seed);
  const drafts: Parameters<typeof store.appendReceipt>[0][] = [];
  const seen: { visitorId: string; framework: Framework; country: string }[] = [];
  const counters: { day: string; decisions: number }[] = [];
  for (let d = 29; d >= 0; d--) {
    const dayStart = Date.UTC(new Date(NOW - d * DAY).getUTCFullYear(), new Date(NOW - d * DAY).getUTCMonth(), new Date(NOW - d * DAY).getUTCDate());
    const weekday = new Date(dayStart).getUTCDay();
    const n = Math.max(1, Math.round(perDay * (weekday === 0 || weekday === 6 ? 0.7 : 1.1) * (0.75 + rand() * 0.5)));
    let decisions = 0;
    const end = Math.min(dayStart + DAY, NOW - 60_000);
    for (let i = 0; i < n; i++) {
      const ts = new Date(dayStart + rand() * Math.max(1, end - dayStart)).toISOString();
      const revoke = seen.length > 10 && rand() < 0.05;
      const prior = revoke ? seen[Math.floor(rand() * seen.length)] : null;
      const country = prior?.country ?? pick(rand, COUNTRIES);
      const framework = prior?.framework ?? frameworkFor(country);
      const gpc = !revoke && (framework === "ccpa" ? rand() < 0.18 : rand() < 0.02);
      let action: ConsentAction;
      if (revoke) action = "revoke";
      else if (gpc) action = "custom";
      else if (framework === "ccpa") action = pick(rand, [["accept_all", 72], ["reject_all", 12], ["custom", 16]]);
      else if (framework === "dpdpa") action = pick(rand, [["accept_all", 58], ["reject_all", 22], ["custom", 20]]);
      else action = pick(rand, [["accept_all", 48], ["reject_all", 34], ["custom", 18]]);
      const all = action === "accept_all";
      const none = action === "reject_all" || action === "revoke";
      const categories: Record<CategoryId, boolean> = {
        essential: true,
        functional: all || (!none && rand() < 0.8),
        analytics: all || (!none && rand() < 0.55),
        marketing: all || (!none && !gpc && rand() < 0.25),
      };
      const visitorId = prior?.visitorId ?? `v_${hex(rand, 22)}`;
      if (!prior) seen.push({ visitorId, framework, country });
      if (action !== "revoke") decisions++;
      drafts.push({
        propertyId: p.id,
        visitorId,
        action,
        framework,
        categories,
        country,
        device: pick(rand, [["desktop", 55], ["mobile", 40], ["tablet", 5]]),
        browser: pick(rand, [["Chrome", 58], ["Safari", 22], ["Edge", 10], ["Firefox", 8], ["Samsung Internet", 2]]),
        ipHash: hex(rand, 32),
        configVersion: v2PublishedAt && ts >= v2PublishedAt ? 2 : 1,
        ...(gpc ? { gpc: true } : {}),
        ...(rand() < 0.01 ? { automated: true } : {}),
        language: "en",
        timestamp: ts,
      });
    }
    counters.push({ day: dayOf(new Date(dayStart).toISOString()), decisions });
  }
  drafts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const dr of drafts) await store.appendReceipt(dr);

  // Pageview counters: the banner is shown more often than people decide.
  for (const c of counters) {
    const views = Math.max(c.decisions + 1, Math.round(c.decisions / (0.6 + rand() * 0.15)));
    const bounces = Math.round((views - c.decisions) * 0.7);
    for (let i = 0; i < views; i++) await store.recordPageview(p.id, c.day, "view");
    for (let i = 0; i < bounces; i++) await store.recordPageview(p.id, c.day, "bounce");
  }
  return drafts.length;
}

/* ---------------- reset ---------------- */

interface RawDb {
  users: User[];
  orgs: Organization[];
  memberships: { orgId: string; userId: string }[];
  invites: { orgId: string }[];
  properties: Property[];
  counters: { propertyId: string }[];
  leaks?: { propertyId: string }[];
  deliveries?: { propertyId: string }[];
  sessions?: { userId: string }[];
  rollups?: { propertyId: string }[];
  rollupFrom?: Record<string, number>;
  siteAudits?: { propertyId: string }[];
  configVersions?: { propertyId: string }[];
  scans?: { propertyId: string }[];
}

async function demoOrgIds(userId: string) {
  const ids: string[] = [];
  for (const m of await store.listMemberships(userId)) {
    const org = await store.getOrg(m.orgId);
    if (m.role === "owner" && org?.name === ORG_NAME) ids.push(org.id);
  }
  return ids;
}

/** Remove only the demo organization's data, the demo users and their sessions. */
async function resetDemo(): Promise<string[]> {
  const user = await store.getUserByEmail(DEMO_EMAIL);
  if (!user) return ["Nothing to reset."];
  const orgIds = await demoOrgIds(user.id);
  const propIds: string[] = [];
  for (const orgId of orgIds) {
    for (const p of await store.listProperties(orgId)) {
      propIds.push(p.id);
      await store.deleteProperty(p.id);
    }
  }
  const editor = await store.getUserByEmail(EDITOR_EMAIL);
  const userIds = new Set([user.id, ...(editor ? [editor.id] : [])]);
  const props = new Set(propIds);
  const orgs = new Set(orgIds);
  const file = path.join(dataDir(), "db.json");
  const db = JSON.parse(await fs.readFile(file, "utf8")) as RawDb;
  db.users = db.users.filter((u) => !userIds.has(u.id));
  db.orgs = db.orgs.filter((o) => !orgs.has(o.id));
  db.memberships = db.memberships.filter((m) => !orgs.has(m.orgId) && !userIds.has(m.userId));
  db.invites = db.invites.filter((i) => !orgs.has(i.orgId));
  db.counters = db.counters.filter((c) => !props.has(c.propertyId));
  for (const k of ["leaks", "deliveries", "rollups", "siteAudits", "configVersions", "scans"] as const) {
    const list = db[k];
    if (list) db[k] = list.filter((x) => !props.has(x.propertyId));
  }
  if (db.sessions) db.sessions = db.sessions.filter((s) => !userIds.has(s.userId));
  if (db.rollupFrom) for (const pid of props) delete db.rollupFrom[pid];
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, file);
  for (const orgId of orgIds) await fs.rm(path.join(dataDir(), "audit", `${orgId.replace(/[^\w-]/g, "")}.jsonl`), { force: true });
  return [`Removed ${orgIds.length} demo organization(s), ${propIds.length} site(s) and ${userIds.size} user(s).`];
}

/* ---------------- summary ---------------- */

async function summarize(userId: string): Promise<string[]> {
  const out: string[] = [];
  for (const orgId of await demoOrgIds(userId)) {
    const org = await store.getOrg(orgId);
    const members = await store.listMembers(orgId);
    const invites = await store.listInvites(orgId);
    out.push(`Organization: ${org?.name} (${orgId}), plan ${org?.plan}, ${members.length} members, ${invites.length} pending invite(s), ${(await store.listAudit(orgId)).length} audit events`);
    for (const p of await store.listProperties(orgId)) {
      const receipts = await store.listReceipts(p.id);
      const chain = verifyChain(receipts, p.retentionCheckpoint);
      const scans = await store.listScans(p.id, 50);
      const leaks = await store.listLeaks(p.id, ago(30));
      const deliveries = await store.listWebhookDeliveries(p.id, 100);
      const state = p.publishedVersion === 0 ? "unpublished" : p.config.version !== p.publishedVersion ? `live v${p.publishedVersion}, draft v${p.config.version} unpublished` : `live v${p.publishedVersion}`;
      out.push(
        `  Site: ${p.name} (${p.domain}) ${state}; ${p.trackers.length} trackers, ${scans.length} scans, ${receipts.length} receipts (chain ${chain.ok ? "valid" : `BROKEN at ${chain.brokenAt}`}), ${leaks.length} leaks, ${p.webhooks?.length ?? 0} webhooks, ${deliveries.length} deliveries`,
      );
    }
  }
  return out;
}

/* ---------------- seed ---------------- */

export async function seedDev(opts: { reset: boolean; credentialsExist: boolean }): Promise<SeedResult> {
  const summary: string[] = [];
  if (opts.reset) summary.push(...(await resetDemo()));

  const existing = await store.getUserByEmail(DEMO_EMAIL);
  if (existing) {
    let password: string | undefined;
    if (!opts.credentialsExist) {
      password = makePassword(DEMO_EMAIL);
      await store.updateUser(existing.id, { passwordHash: await hashPassword(password), passwordChangedAt: new Date().toISOString(), loginFailures: undefined, lockedUntil: undefined });
      summary.push("Credentials file was missing: the demo password was reset.");
    }
    summary.push(...(await summarize(existing.id)));
    return { status: "exists", email: DEMO_EMAIL, password, summary };
  }

  const password = makePassword(DEMO_EMAIL);
  const created = ago(45);
  const owner = await store.createUser({ id: id("usr"), email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: await hashPassword(password), passwordChangedAt: created, createdAt: created });
  const editor = await store.createUser({
    id: id("usr"),
    email: EDITOR_EMAIL,
    name: "Ravi Editor",
    // nobody knows this password; the account only fills the Team page
    passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
    passwordChangedAt: ago(30),
    createdAt: ago(30),
    lastActiveAt: ago(2),
  });

  const org = await store.createOrg(
    {
      id: id("org"),
      name: ORG_NAME,
      kind: "organization",
      teamSize: "11-50",
      plan: "growth",
      dataRegion: "ap-south-1",
      dpo: { name: "Priya Raman", email: "dpo@northwind.example", address: "4th Floor, 12 MG Road, Bengaluru 560001" },
      security: { requireMfa: false },
      createdAt: created,
    },
    owner.id,
  );
  await store.addMember({ orgId: org.id, userId: editor.id, role: "editor", invitedBy: owner.id, createdAt: ago(30) });
  await store.createInvite({ id: id("inv"), orgId: org.id, email: INVITE_EMAIL, role: "auditor", invitedBy: owner.id, createdAt: ago(3) });

  // --- Northwind Store: published twice, live and up to date ---
  const storeSite: Property = { ...buildProperty(org.id, "Northwind Store", "shop.northwind.example"), createdAt: ago(44) };
  await store.createProperty(storeSite);
  const storeTrackers = withInventory(STORE_TRACKERS, storeSite.domain, STORE_PAGES, ago(2, 3));
  const storeV1: BannerConfig = structuredClone(storeSite.config);
  const storeV1At = ago(40);
  const storeV2: BannerConfig = { ...structuredClone(storeV1), version: 2, theme: { ...storeV1.theme, layout: "modal", position: "center" } };
  const storeV2At = ago(12);
  const storeHeld = heldTrackers(storeTrackers);
  await store.saveConfigVersion(buildConfigVersion({ propertyId: storeSite.id, version: 1, config: storeV1, trackers: storeHeld, publishedAt: storeV1At, publishedBy: owner.id }));
  await store.saveConfigVersion(buildConfigVersion({ propertyId: storeSite.id, version: 2, config: storeV2, trackers: storeHeld, publishedAt: storeV2At, publishedBy: owner.id }));
  const storeHooks: Webhook[] = [
    { id: id("wh"), url: "https://hooks.northwind.example/consent", secret: `whsec_${randomBytes(24).toString("base64url")}`, events: ["consent.created", "consent.withdrawn"], active: true, createdAt: ago(20) },
    { id: id("wh"), url: "https://crm.northwind.example/webhooks/plain", secret: `whsec_${randomBytes(24).toString("base64url")}`, events: ["consent.withdrawn", "leak.detected"], active: false, createdAt: ago(18) },
  ];
  await store.updateProperty(storeSite.id, {
    config: storeV2,
    trackers: storeTrackers,
    publishedVersion: 2,
    publishedAt: storeV2At,
    published: { config: storeV2, trackers: storeHeld },
    webhooks: storeHooks,
    scanSchedule: { frequency: "weekly", nextDueAt: new Date(NOW + 5 * DAY).toISOString(), updatedAt: ago(28), lastRunAt: ago(2, 3) },
  });

  // --- Northwind Docs: published once, with a newer draft not yet published ---
  const docsSite: Property = { ...buildProperty(org.id, "Northwind Docs", "docs.northwind.example"), createdAt: ago(38) };
  await store.createProperty(docsSite);
  const docsTrackers = withInventory(DOCS_TRACKERS, docsSite.domain, DOCS_PAGES, ago(4, 5));
  const docsV1: BannerConfig = structuredClone(docsSite.config);
  const docsV1At = ago(35);
  const docsHeld = heldTrackers(docsTrackers);
  await store.saveConfigVersion(buildConfigVersion({ propertyId: docsSite.id, version: 1, config: docsV1, trackers: docsHeld, publishedAt: docsV1At, publishedBy: owner.id }));
  const docsDraft: BannerConfig = structuredClone(docsV1);
  docsDraft.version = 2;
  docsDraft.theme.radius = 16;
  docsDraft.regions.gdpr.copy = { ...docsDraft.regions.gdpr.copy, title: "Your privacy choices for Northwind Docs" };
  await store.updateProperty(docsSite.id, { config: docsDraft, trackers: docsTrackers, publishedVersion: 1, publishedAt: docsV1At, published: { config: docsV1, trackers: docsHeld } });

  // --- scans (oldest first) ---
  for (const [daysAgo, pre] of [[27, ["Meta Pixel"]], [13, []], [2, []]] as const) {
    await store.saveScan(scanReport(storeSite.id, storeSite.domain, STORE_PAGES, storeTrackers, daysAgo, owner.id, [...pre]));
  }
  for (const daysAgo of [24, 4]) await store.saveScan(scanReport(docsSite.id, docsSite.domain, DOCS_PAGES, docsTrackers, daysAgo, editor.id));

  // --- receipts and pageviews ---
  const storeReceipts = await seedReceipts({ ...storeSite }, 9, 1337, storeV2At);
  const docsReceipts = await seedReceipts({ ...docsSite }, 4, 4242, null);

  // --- leaks on the live store ---
  const leakRand = rng(7);
  const leakUrls: [string, CategoryId][] = [
    ["connect.facebook.net/en_US/fbevents.js", "marketing"],
    ["analytics.tiktok.com/i18n/pixel/events.js", "marketing"],
    ["www.google-analytics.com/g/collect", "analytics"],
    ["analytics.tiktok.com/api/v2/pixel", "marketing"],
    ["connect.facebook.net/signals/config/1234567890", "marketing"],
    ["static.hotjar.com/c/hotjar-3456789.js", "analytics"],
  ];
  const leakTimes = leakUrls.map((_, i) => ago(i, 2 + Math.floor(leakRand() * 8))).sort();
  for (let i = 0; i < leakUrls.length; i++) {
    const country = pick(leakRand, [["DE", 3], ["FR", 2], ["GB", 2], ["IN", 2]] as [string, number][]);
    await store.recordLeak({
      id: id("leak"),
      propertyId: storeSite.id,
      url: leakUrls[i][0],
      category: leakUrls[i][1],
      page: `https://${storeSite.domain}${STORE_PAGES[1 + (i % 4)]}`,
      framework: frameworkFor(country),
      country,
      createdAt: leakTimes[i],
    });
  }

  // --- webhook deliveries (oldest first) ---
  const deliveries: WebhookDelivery[] = [];
  for (let i = 0; i < 11; i++) {
    const failed = i === 3 || i === 8;
    deliveries.push({
      id: id("whd"),
      propertyId: storeSite.id,
      webhookId: storeHooks[0].id,
      event: i % 4 === 2 ? "consent.withdrawn" : "consent.created",
      status: failed ? "failed" : "delivered",
      httpStatus: failed ? (i === 3 ? 502 : 500) : 200,
      attempt: failed ? 3 : 1,
      durationMs: failed ? 10_000 : 80 + ((i * 37) % 260),
      createdAt: ago(10 - i, 4 + (i % 5)),
    });
  }
  deliveries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const d of deliveries) await store.recordWebhookDelivery(d);

  // --- audit trail (chronological) ---
  const ownerActor = { actorUserId: owner.id, actorEmail: owner.email };
  const ev = (createdAt: string, action: AuditAction, target: AuditDraft["target"], metadata?: AuditDraft["metadata"], actor = ownerActor): AuditDraft => ({
    orgId: org.id,
    ...actor,
    action,
    target,
    metadata,
    ipHash: hex(rng(Date.parse(createdAt)), 32),
    userAgent: UA,
    createdAt,
  });
  const editorActor = { actorUserId: editor.id, actorEmail: editor.email };
  const events: AuditDraft[] = [
    ev(created, "org.created", { type: "org", id: org.id, label: org.name }, { dataRegion: org.dataRegion, kind: "organization", plan: "growth" }),
    ev(ago(44), "property.created", { type: "property", id: storeSite.id, label: storeSite.domain }),
    ev(ago(40), "property.published", { type: "property", id: storeSite.id, label: storeSite.domain }, { version: 1 }),
    ev(ago(38), "property.created", { type: "property", id: docsSite.id, label: docsSite.domain }),
    ev(ago(35), "property.published", { type: "property", id: docsSite.id, label: docsSite.domain }, { version: 1 }),
    ev(ago(31), "member.invited", { type: "invite", id: editor.email, label: editor.email }, { role: "editor" }),
    ev(ago(30), "member.joined", { type: "user", id: editor.id, label: editor.email }, { role: "editor" }, editorActor),
    ev(ago(28), "tracker.scan_schedule_changed", { type: "property", id: storeSite.id, label: storeSite.domain }, { frequency: "weekly" }),
    ev(ago(27, 3), "tracker.scan_run", { type: "property", id: storeSite.id, label: storeSite.domain }, { engine: "headless" }),
    ev(ago(24, 5), "tracker.scan_run", { type: "property", id: docsSite.id, label: docsSite.domain }, { engine: "headless" }, editorActor),
    ev(ago(20), "webhook.created", { type: "webhook", id: storeHooks[0].id, label: storeHooks[0].url }),
    ev(ago(18), "webhook.created", { type: "webhook", id: storeHooks[1].id, label: storeHooks[1].url }),
    ev(ago(13, 3), "tracker.scan_run", { type: "property", id: storeSite.id, label: storeSite.domain }, { engine: "headless" }),
    ev(ago(12, 1), "banner.updated", { type: "property", id: storeSite.id, label: storeSite.domain }, { fields: "theme" }),
    ev(ago(12), "property.published", { type: "property", id: storeSite.id, label: storeSite.domain }, { version: 2 }),
    ev(ago(9), "webhook.updated", { type: "webhook", id: storeHooks[1].id, label: storeHooks[1].url }, { active: false }),
    ev(ago(4, 5), "tracker.scan_run", { type: "property", id: docsSite.id, label: docsSite.domain }, { engine: "headless" }, editorActor),
    ev(ago(3), "member.invited", { type: "invite", id: INVITE_EMAIL, label: INVITE_EMAIL }, { role: "auditor" }),
    ev(ago(2, 3), "tracker.scan_run", { type: "property", id: storeSite.id, label: storeSite.domain }, { engine: "headless" }),
    ev(ago(1), "notice.updated", { type: "property", id: docsSite.id, label: docsSite.domain }, { fields: "copy,theme" }, editorActor),
  ];
  events.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  for (const e of events) await store.appendAudit(e);

  summary.push(`Seeded ${storeReceipts + docsReceipts} consent receipts across 2 sites.`);
  summary.push(...(await summarize(owner.id)));
  return { status: "created", email: DEMO_EMAIL, password, summary };
}
