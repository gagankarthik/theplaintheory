import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { GENESIS_HASH, hashReceipt, id } from "../crypto";
import { addFlat, emptyRollup, rollupIncrement } from "../rollups";
import { AUDIT_GENESIS, hashAudit } from "../audit-chain";
import { PLATFORM_AUDIT_GENESIS, hashPlatformAudit } from "../platform/audit-chain";
import type { PlatformAuditEvent } from "../platform/types";
import type {
  AuditEvent,
  ConfigVersion,
  ConsentReceipt,
  Invite,
  Lead,
  LeakReport,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  SessionRecord,
  User,
  WebhookDelivery,
  WebhookRetry,
} from "../types";
import { selectDue } from "../scan-schedule";
import type { SiteAuditReport } from "../site-audit/types";
import { withLogAfter } from "../scan-poll";
import { SCAN_KEEP, type ScanReport } from "../trackers";
import { SITE_AUDIT_KEEP, type AuditDraft, type AuditQuery, type LeadQuery, type ReceiptDraft, type ReceiptQuery, type Store } from "./types";

/**
 * File-backed store for local development and single-node demos.
 * Metadata lives in .data/db.json; receipts are append-only JSONL per property.
 */
interface Db {
  users: User[];
  orgs: Organization[];
  memberships: Membership[];
  invites: Invite[];
  properties: Property[];
  counters: PageviewCounter[];
  leads?: Lead[];
  leaks?: LeakReport[];
  deliveries?: WebhookDelivery[];
  sessions?: SessionRecord[];
  /** live site check reports, the newest SITE_AUDIT_KEEP per site */
  siteAudits?: SiteAuditReport[];
  /** immutable published-config snapshots, one per site and version */
  configVersions?: ConfigVersion[];
  /** tracker scan reports, the newest SCAN_KEEP per site, oldest first */
  scans?: ScanReport[];
  /** Stripe webhook event ids already handled, with when they were claimed */
  stripeEvents?: { id: string; at: string }[];
  /** daily decision rollups: flat counters per site and day (lib/rollups.ts) */
  rollups?: { propertyId: string; day: string; counts: Record<string, number>; anchor?: { seq: number; hash: string } }[];
  /** webhook deliveries waiting for their next attempt */
  webhookRetries?: WebhookRetry[];
  /** per site: the first receipt seq counted in rollups */
  rollupFrom?: Record<string, number>;
  /** IP-hash salts, one per UTC day; days older than yesterday are dropped */
  dailySalts?: { day: string; salt: string }[];
  /** contact-form abuse window: keyed IP hash per lead, kept one day */
  leadAbuse?: { key: string; at: string }[];
}

const DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_FILE = path.join(DIR, "db.json");
const RECEIPTS_DIR = path.join(DIR, "receipts");
const AUDIT_DIR = path.join(DIR, "audit");
const PLATFORM_AUDIT_FILE = path.join(DIR, "platform-audit.jsonl");

/**
 * Process-wide state. Next bundles route handlers, server actions and pages separately, so this
 * module can be instantiated more than once in one process; keeping the cache, write queue and
 * chain heads on globalThis gives every instance the same lock. Without it two instances could
 * each append "the next" event to a chain and fork it.
 */
interface LocalState {
  cache: Db | null;
  /** mtime of db.json when it was last read or written by this process */
  cacheMtime: number;
  heads: Map<string, { seq: number; hash: string }>;
  queue: Promise<unknown>;
  /** bumped on every write by this process, so a read that overlapped a write never replaces the newer cache */
  writes?: number;
  /** fixed-window rate-limit counters; one process, so memory is shared by every request */
  windows?: Map<string, { count: number; expires: number }>;
}
const STATE_KEY = Symbol.for("plain-theory.local-store");
const g = globalThis as typeof globalThis & { [STATE_KEY]?: LocalState };
const state: LocalState = (g[STATE_KEY] ??= { cache: null, cacheMtime: 0, heads: new Map(), queue: Promise.resolve() });
const { heads } = state;

/** Serialize all mutations so concurrent requests can't interleave writes. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = state.queue.then(fn, fn);
  state.queue = next.catch(() => undefined);
  return next;
}

const mtimeOf = async () => {
  try {
    return (await fs.stat(DB_FILE)).mtimeMs;
  } catch {
    return 0;
  }
};

async function load(): Promise<Db> {
  // Reload when something else rewrote the file (e.g. another process editing it while the dev server runs),
  // and drop cached chain heads with it so new receipts never link to a stale head.
  const writes = state.writes ?? 0;
  const mtime = await mtimeOf();
  if (state.cache && mtime === state.cacheMtime) return state.cache;
  let read: Db;
  try {
    read = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db;
  } catch {
    read = { users: [], orgs: [], memberships: [], invites: [], properties: [], counters: [] };
  }
  // This process wrote while we were reading: what we read may be the older file, and on file systems
  // with coarse timestamps it can even carry the same mtime, so it would be trusted. Keep the newer
  // in-memory copy instead.
  if ((state.writes ?? 0) !== writes && state.cache) return state.cache;
  state.cache = read;
  state.cacheMtime = mtime;
  heads.clear();
  return state.cache;
}

async function save() {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  state.writes = (state.writes ?? 0) + 1;
  await fs.writeFile(tmp, JSON.stringify(state.cache, null, 2));
  await fs.rename(tmp, DB_FILE);
  state.cacheMtime = await mtimeOf();
}

function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  return locked(async () => {
    const db = await load();
    const out = await fn(db);
    await save();
    return out;
  });
}

const receiptFile = (propertyId: string) => path.join(RECEIPTS_DIR, `${propertyId.replace(/[^\w-]/g, "")}.jsonl`);

async function readReceipts(propertyId: string): Promise<ConsentReceipt[]> {
  try {
    const raw = await fs.readFile(receiptFile(propertyId), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ConsentReceipt);
  } catch {
    return [];
  }
}


const auditFile = (orgId: string) => path.join(AUDIT_DIR, `${orgId.replace(/[^\w-]/g, "")}.jsonl`);

async function readAudit(orgId: string): Promise<AuditEvent[]> {
  try {
    const raw = await fs.readFile(auditFile(orgId), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as AuditEvent);
  } catch {
    return [];
  }
}

async function readPlatformAudit(): Promise<PlatformAuditEvent[]> {
  try {
    const raw = await fs.readFile(PLATFORM_AUDIT_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as PlatformAuditEvent);
  } catch {
    return [];
  }
}

export const localStore: Store = {
  async createUser(u) {
    return mutate((db) => {
      db.users.push(u);
      return u;
    });
  },
  async getUser(uid) {
    return (await load()).users.find((u) => u.id === uid) ?? null;
  },
  async getUserByEmail(email) {
    const e = email.toLowerCase();
    return (await load()).users.find((u) => u.email.toLowerCase() === e) ?? null;
  },
  async updateUser(uid, patch) {
    return mutate((db) => {
      const u = db.users.find((x) => x.id === uid);
      if (!u) throw new Error("User not found");
      Object.assign(u, patch, { id: u.id });
      // undefined in a patch means "remove this field"
      for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (u as unknown as Record<string, unknown>)[k];
      return u;
    });
  },
  async listUsers() {
    return [...(await load()).users];
  },

  async createSessionRecord(rec) {
    return mutate((db) => {
      (db.sessions ??= []).push(rec);
      // drop sessions that ended more than 30 days ago
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
      db.sessions = db.sessions.filter((x) => x.expiresAt > cutoff);
      return rec;
    });
  },
  async getSessionRecord(sid) {
    return ((await load()).sessions ?? []).find((x) => x.id === sid) ?? null;
  },
  async touchSession(sid, lastSeenAt) {
    await mutate((db) => {
      const rec = (db.sessions ?? []).find((x) => x.id === sid);
      if (rec) rec.lastSeenAt = lastSeenAt;
    });
  },
  async revokeSession(sid, at) {
    await mutate((db) => {
      const rec = (db.sessions ?? []).find((x) => x.id === sid);
      if (rec && !rec.revokedAt) rec.revokedAt = at;
    });
  },
  async revokeUserSessions(userId, at, exceptId) {
    return mutate((db) => {
      let n = 0;
      for (const rec of db.sessions ?? []) {
        if (rec.userId === userId && rec.id !== exceptId && !rec.revokedAt) {
          rec.revokedAt = at;
          n += 1;
        }
      }
      return n;
    });
  },
  async listUserSessions(userId) {
    return ((await load()).sessions ?? []).filter((x) => x.userId === userId).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  },

  async appendAudit(draft: AuditDraft) {
    return locked(async () => {
      // Always chain from the file itself, never a cached head, so no writer can fork the trail.
      const all = await readAudit(draft.orgId);
      const last = all[all.length - 1];
      const head = last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: AUDIT_GENESIS };
      const unsigned = { ...draft, createdAt: draft.createdAt ?? new Date().toISOString(), id: id("aud"), seq: head.seq + 1, prevHash: head.hash };
      const event: AuditEvent = { ...unsigned, hash: hashAudit(unsigned) };
      await fs.mkdir(AUDIT_DIR, { recursive: true });
      await fs.appendFile(auditFile(draft.orgId), JSON.stringify(event) + "\n");
      return event;
    });
  },
  async listAudit(orgId, q: AuditQuery = {}) {
    let rows = await readAudit(orgId);
    if (q.before) rows = rows.filter((e) => e.seq < q.before!);
    if (q.action) rows = rows.filter((e) => e.action === q.action || e.action.startsWith(`${q.action}.`));
    if (q.actorUserId) rows = rows.filter((e) => e.actorUserId === q.actorUserId);
    rows.reverse();
    return q.limit ? rows.slice(0, q.limit) : rows;
  },

  async appendPlatformAudit(draft) {
    return locked(async () => {
      // Chain from the file itself, like the org trail, so concurrent writers can't fork it.
      const all = await readPlatformAudit();
      const last = all[all.length - 1];
      const head = last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: PLATFORM_AUDIT_GENESIS };
      const unsigned = { ...draft, createdAt: draft.createdAt ?? new Date().toISOString(), id: id("paud"), seq: head.seq + 1, prevHash: head.hash };
      const event: PlatformAuditEvent = { ...unsigned, hash: hashPlatformAudit(unsigned) };
      await fs.mkdir(DIR, { recursive: true });
      await fs.appendFile(PLATFORM_AUDIT_FILE, JSON.stringify(event) + "\n");
      return event;
    });
  },
  async listPlatformAudit(q = {}) {
    let rows = await readPlatformAudit();
    if (q.before) rows = rows.filter((e) => e.seq < q.before!);
    if (q.action) rows = rows.filter((e) => e.action === q.action || e.action.startsWith(`${q.action}.`));
    if (q.targetId) rows = rows.filter((e) => e.target.id === q.targetId);
    rows.reverse();
    return q.limit ? rows.slice(0, q.limit) : rows;
  },

  async createOrg(o, owner) {
    return mutate((db) => {
      db.orgs.push(o);
      db.memberships.push({ orgId: o.id, userId: owner, role: "owner", createdAt: o.createdAt });
      return o;
    });
  },
  async listOrgs() {
    return [...(await load()).orgs];
  },
  async getOrg(oid) {
    return (await load()).orgs.find((o) => o.id === oid) ?? null;
  },
  async getOrgs(ids) {
    const want = new Set(ids);
    return (await load()).orgs.filter((o) => want.has(o.id));
  },
  async updateOrg(oid, patch) {
    return mutate((db) => {
      const o = db.orgs.find((x) => x.id === oid);
      if (!o) throw new Error("Organization not found");
      Object.assign(o, patch, { id: o.id });
      // undefined in a patch means "remove this field" (e.g. lifting a suspension)
      for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (o as unknown as Record<string, unknown>)[k];
      return o;
    });
  },
  async listMemberships(userId) {
    return (await load()).memberships.filter((m) => m.userId === userId);
  },
  async getMembership(orgId, userId) {
    return (await load()).memberships.find((m) => m.orgId === orgId && m.userId === userId) ?? null;
  },
  async listMembers(orgId) {
    const db = await load();
    return db.memberships
      .filter((m) => m.orgId === orgId)
      .map((m) => ({ ...m, user: db.users.find((u) => u.id === m.userId) ?? null }));
  },
  async setRole(orgId, userId, role) {
    await mutate((db) => {
      const m = db.memberships.find((x) => x.orgId === orgId && x.userId === userId);
      if (m) m.role = role;
    });
  },
  async addMember(m) {
    await mutate((db) => {
      if (!db.memberships.some((x) => x.orgId === m.orgId && x.userId === m.userId)) db.memberships.push(m);
    });
  },
  async removeMember(orgId, userId) {
    await mutate((db) => {
      db.memberships = db.memberships.filter((x) => !(x.orgId === orgId && x.userId === userId));
    });
  },
  async createInvite(i) {
    return mutate((db) => {
      db.invites.push(i);
      return i;
    });
  },
  async listInvites(orgId) {
    return (await load()).invites.filter((i) => i.orgId === orgId);
  },
  async invitesForEmail(email) {
    const e = email.toLowerCase();
    return (await load()).invites.filter((i) => i.email.toLowerCase() === e);
  },
  async deleteInvite(orgId, inviteId) {
    await mutate((db) => {
      db.invites = db.invites.filter((i) => !(i.orgId === orgId && i.id === inviteId));
    });
  },

  async createProperty(p) {
    return mutate((db) => {
      db.properties.push(p);
      return p;
    });
  },
  async getProperty(pid) {
    return (await load()).properties.find((p) => p.id === pid) ?? null;
  },
  async getPropertyBySiteKey(siteKey) {
    return (await load()).properties.find((p) => p.siteKey === siteKey) ?? null;
  },
  async listProperties(orgId) {
    return (await load()).properties.filter((p) => p.orgId === orgId);
  },
  async listDueScanProperties(nowIso, limit) {
    // the file store is small: filtering every site is fine here
    return selectDue((await load()).properties, new Date(nowIso), limit).map((p) => structuredClone(p));
  },
  async updateProperty(pid, patch) {
    return mutate((db) => {
      const p = db.properties.find((x) => x.id === pid);
      if (!p) throw new Error("Property not found");
      Object.assign(p, patch, { id: p.id, orgId: p.orgId, updatedAt: new Date().toISOString() });
      return p;
    });
  },
  async deleteProperty(pid) {
    await mutate((db) => {
      db.properties = db.properties.filter((p) => p.id !== pid);
      db.counters = db.counters.filter((c) => c.propertyId !== pid);
      if (db.siteAudits) db.siteAudits = db.siteAudits.filter((a) => a.propertyId !== pid);
      if (db.configVersions) db.configVersions = db.configVersions.filter((v) => v.propertyId !== pid);
      if (db.scans) db.scans = db.scans.filter((s) => s.propertyId !== pid);
    });
    await fs.rm(receiptFile(pid), { force: true });
  },

  async appendReceipt(draft: ReceiptDraft) {
    return locked(async () => {
      let head = heads.get(draft.propertyId);
      if (!head) {
        const all = await readReceipts(draft.propertyId);
        const last = all[all.length - 1];
        head = last ? { seq: last.seq, hash: last.hash } : { seq: 0, hash: GENESIS_HASH };
      }
      const unsigned = { ...draft, id: id("rcpt"), seq: head.seq + 1, prevHash: head.hash };
      const receipt: ConsentReceipt = { ...unsigned, hash: hashReceipt(unsigned) };
      await fs.mkdir(RECEIPTS_DIR, { recursive: true });
      await fs.appendFile(receiptFile(draft.propertyId), JSON.stringify(receipt) + "\n");
      heads.set(draft.propertyId, { seq: receipt.seq, hash: receipt.hash });
      // Daily rollup, like the DynamoDB store: best effort, never fails the receipt.
      try {
        const db = await load();
        const { day, fields } = rollupIncrement(receipt);
        db.rollupFrom ??= {};
        db.rollupFrom[receipt.propertyId] ??= receipt.seq;
        const list = (db.rollups ??= []);
        let row = list.find((x) => x.propertyId === receipt.propertyId && x.day === day);
        if (!row) list.push((row = { propertyId: receipt.propertyId, day, counts: {} }));
        for (const [k, v] of Object.entries(fields)) row.counts[k] = (row.counts[k] ?? 0) + v;
        // the day's last receipt anchors its chain
        if (!row.anchor || receipt.seq > row.anchor.seq) row.anchor = { seq: receipt.seq, hash: receipt.hash };
        await save();
      } catch (e) {
        console.error("[store] rollup update failed", e);
      }
      return receipt;
    });
  },
  async deleteReceiptsThrough(propertyId, seq) {
    return locked(async () => {
      const all = await readReceipts(propertyId);
      const keep = all.filter((r) => r.seq > seq);
      const removed = all.length - keep.length;
      if (removed === 0) return 0;
      const file = receiptFile(propertyId);
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, keep.map((r) => JSON.stringify(r) + "\n").join(""));
      await fs.rename(tmp, file);
      return removed;
    });
  },
  async listReceipts(propertyId, q: ReceiptQuery = {}) {
    let rows = await readReceipts(propertyId);
    if (q.from) rows = rows.filter((r) => r.timestamp >= q.from!);
    if (q.to) rows = rows.filter((r) => r.timestamp <= q.to!);
    if (q.before) rows = rows.filter((r) => r.seq < q.before!);
    rows.reverse();
    return q.limit ? rows.slice(0, q.limit) : rows;
  },

  async pageReceipts(propertyId, afterSeq, limit) {
    return (await readReceipts(propertyId))
      .filter((r) => r.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit);
  },

  async listVisitorReceipts(propertyId, visitorId, q = {}) {
    const rows = (await readReceipts(propertyId)).filter((r) => r.visitorId === visitorId && (!q.before || r.seq < q.before)).reverse();
    return q.limit ? rows.slice(0, q.limit) : rows;
  },

  async bumpRollup(propertyId, day, fields) {
    await mutate((db) => {
      const list = (db.rollups ??= []);
      let row = list.find((x) => x.propertyId === propertyId && x.day === day);
      if (!row) list.push((row = { propertyId, day, counts: {} }));
      for (const [k, v] of Object.entries(fields)) row.counts[k] = (row.counts[k] ?? 0) + v;
    });
  },

  async listDecisionRollups(propertyId, fromDay, toDay) {
    const db = await load();
    const rollups = (db.rollups ?? [])
      .filter((r) => r.propertyId === propertyId && r.day >= fromDay && r.day <= toDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((r) => ({ ...addFlat(emptyRollup(r.day), r.counts), ...(r.anchor ? { anchor: r.anchor } : {}) }));
    return { rollups, fromSeq: db.rollupFrom?.[propertyId] ?? null };
  },

  async enqueueWebhookRetry(r) {
    await mutate((db) => {
      (db.webhookRetries ??= []).push(r);
    });
  },

  async claimDueWebhookRetries(nowIso, limit) {
    let claimed: WebhookRetry[] = [];
    await mutate((db) => {
      const due = (db.webhookRetries ?? []).filter((r) => r.dueAt <= nowIso).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, limit);
      const ids = new Set(due.map((r) => r.id));
      db.webhookRetries = (db.webhookRetries ?? []).filter((r) => !ids.has(r.id));
      claimed = due;
    });
    return claimed;
  },

  async recordLeak(l) {
    await mutate((db) => {
      (db.leaks ??= []).push(l);
      // keep the newest 5,000 per store; leak reports are signals, not records of consent
      if (db.leaks.length > 5000) db.leaks.splice(0, db.leaks.length - 5000);
    });
  },
  async listLeaks(propertyId, sinceIso) {
    return ((await load()).leaks ?? []).filter((l) => l.propertyId === propertyId && l.createdAt >= sinceIso).reverse();
  },
  async pruneLeaks(propertyId, beforeIso) {
    return mutate((db) => {
      const before = (db.leaks ?? []).length;
      db.leaks = (db.leaks ?? []).filter((l) => !(l.propertyId === propertyId && l.createdAt < beforeIso));
      return before - db.leaks.length;
    });
  },
  async recordWebhookDelivery(d) {
    await mutate((db) => {
      (db.deliveries ??= []).push(d);
      if (db.deliveries.length > 2000) db.deliveries.splice(0, db.deliveries.length - 2000);
    });
  },
  async listWebhookDeliveries(propertyId, limit) {
    return ((await load()).deliveries ?? []).filter((d) => d.propertyId === propertyId).reverse().slice(0, limit);
  },

  async pruneWebhookDeliveries(propertyId, beforeIso) {
    return mutate((db) => {
      const before = (db.deliveries ?? []).length;
      db.deliveries = (db.deliveries ?? []).filter((d) => !(d.propertyId === propertyId && d.createdAt < beforeIso));
      return before - db.deliveries.length;
    });
  },

  async createLead(l, abuseKey) {
    return mutate((db) => {
      (db.leads ??= []).push(l);
      // Without an abuse key the lead's own IP hash is the key (counted from the leads below).
      if (abuseKey) {
        const cutoff = new Date(Date.now() - 864e5).toISOString();
        db.leadAbuse = [...(db.leadAbuse ?? []).filter((x) => x.at >= cutoff), { key: abuseKey, at: l.createdAt }];
      }
      return l;
    });
  },
  async countRecentLeads(abuseKey, sinceIso) {
    const db = await load();
    // Leads stored before abuse keys existed are matched by their IP hash.
    const legacy = (db.leads ?? []).filter((l) => l.ipHash === abuseKey && l.createdAt >= sinceIso).length;
    return legacy + (db.leadAbuse ?? []).filter((x) => x.key === abuseKey && x.at >= sinceIso).length;
  },
  async listLeads({ status, topic, limit = 200 }: LeadQuery = {}) {
    return ((await load()).leads ?? [])
      .filter((l) => (!status || (l.status ?? "new") === status) && (!topic || (l.topic ?? "sales") === topic))
      .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, limit);
  },
  async getLead(leadId) {
    return ((await load()).leads ?? []).find((l) => l.id === leadId) ?? null;
  },
  async updateLeadStatus(leadId, status) {
    return mutate((db) => {
      const l = (db.leads ?? []).find((x) => x.id === leadId);
      if (!l) return null;
      l.status = status;
      l.updatedAt = new Date().toISOString();
      return l;
    });
  },

  async recordPageview(propertyId, day, kind) {
    await mutate((db) => {
      let c = db.counters.find((x) => x.propertyId === propertyId && x.day === day);
      if (!c) db.counters.push((c = { propertyId, day, views: 0, bounces: 0 }));
      if (kind === "view") c.views += 1;
      else c.bounces += 1;
    });
  },
  async listCounters(propertyId, fromDay, toDay) {
    return (await load()).counters
      .filter((c) => c.propertyId === propertyId && c.day >= fromDay && c.day <= toDay)
      .sort((a, b) => a.day.localeCompare(b.day));
  },

  async hitWindow(key, windowStart, windowMs) {
    const windows = (state.windows ??= new Map());
    const now = Date.now();
    if (windows.size > 50_000) for (const [k, w] of windows) if (w.expires <= now) windows.delete(k);
    const k = `${key}#${windowStart}`;
    const w = windows.get(k) ?? { count: 0, expires: windowStart + 2 * windowMs };
    w.count += 1;
    windows.set(k, w);
    return w.count;
  },

  async dailySalt(day) {
    const hit = ((await load()).dailySalts ?? []).find((x) => x.day === day);
    if (hit) return hit.salt;
    return mutate((db) => {
      const existing = (db.dailySalts ?? []).find((x) => x.day === day);
      if (existing) return existing.salt;
      const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
      const salt = randomBytes(32).toString("base64url");
      db.dailySalts = [...(db.dailySalts ?? []).filter((x) => x.day >= yesterday), { day, salt }];
      return salt;
    });
  },

  async claimStripeEvent(eventId) {
    return mutate((db) => {
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
      db.stripeEvents = (db.stripeEvents ?? []).filter((e) => e.at > cutoff);
      if (db.stripeEvents.some((e) => e.id === eventId)) return false;
      db.stripeEvents.push({ id: eventId, at: new Date().toISOString() });
      return true;
    });
  },
  async releaseStripeEvent(eventId) {
    await mutate((db) => {
      db.stripeEvents = (db.stripeEvents ?? []).filter((e) => e.id !== eventId);
    });
  },

  async saveSiteAudit(propertyId, report) {
    await mutate((db) => {
      const mine = (db.siteAudits ?? []).filter((a) => a.propertyId === propertyId);
      const drop = new Set(mine.slice(0, Math.max(0, mine.length + 1 - SITE_AUDIT_KEEP)).map((a) => a.id));
      db.siteAudits = [...(db.siteAudits ?? []).filter((a) => !drop.has(a.id)), { ...report, propertyId }];
    });
  },
  async listSiteAudits(propertyId, limit) {
    if (limit < 1) return [];
    return ((await load()).siteAudits ?? []).filter((a) => a.propertyId === propertyId).reverse().slice(0, limit);
  },

  async saveConfigVersion(v) {
    return mutate((db) => {
      const list = (db.configVersions ??= []);
      // write once: an existing snapshot is never replaced
      if (list.some((x) => x.propertyId === v.propertyId && x.version === v.version)) return false;
      list.push(structuredClone(v));
      return true;
    });
  },
  async getConfigVersion(propertyId, version) {
    const hit = ((await load()).configVersions ?? []).find((x) => x.propertyId === propertyId && x.version === version);
    return hit ? structuredClone(hit) : null;
  },
  async listConfigVersions(propertyId, limit) {
    if (limit < 1) return [];
    return ((await load()).configVersions ?? [])
      .filter((x) => x.propertyId === propertyId)
      .sort((a, b) => b.version - a.version)
      .slice(0, limit)
      .map((x) => structuredClone(x));
  },
  async getReceipt(propertyId, seq) {
    return (await readReceipts(propertyId)).find((r) => r.seq === seq) ?? null;
  },

  async saveScan(report) {
    await mutate((db) => {
      const mine = (db.scans ?? []).filter((s) => s.propertyId === report.propertyId);
      const drop = new Set(mine.slice(0, Math.max(0, mine.length + 1 - SCAN_KEEP)).map((s) => s.id));
      db.scans = [...(db.scans ?? []).filter((s) => !drop.has(s.id)), structuredClone(report)];
    });
  },
  async getScan(propertyId, scanId) {
    const s = ((await load()).scans ?? []).find((x) => x.propertyId === propertyId && x.id === scanId);
    return s ? structuredClone(s) : null;
  },
  async pollScan(propertyId, scanId, logAfter) {
    const s = ((await load()).scans ?? []).find((x) => x.propertyId === propertyId && x.id === scanId);
    return s ? withLogAfter(structuredClone(s), logAfter) : null;
  },
  async updateScan(propertyId, scanId, patch, opts) {
    return mutate((db) => {
      const s = (db.scans ?? []).find((x) => x.propertyId === propertyId && x.id === scanId);
      if (!s) return null;
      if (opts?.ifStatus && !opts.ifStatus.includes(s.status)) return null;
      Object.assign(s, structuredClone(patch), { id: s.id, propertyId: s.propertyId, startedAt: s.startedAt });
      return structuredClone(s);
    });
  },
  async listQueuedScans(limit) {
    if (limit < 1) return [];
    return ((await load()).scans ?? [])
      .filter((s) => s.status === "queued")
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .slice(0, limit)
      .map((s) => structuredClone(s));
  },
  async listScans(propertyId, limit) {
    if (limit < 1) return [];
    return ((await load()).scans ?? [])
      .filter((s) => s.propertyId === propertyId)
      .reverse()
      .slice(0, limit)
      .map((s) => structuredClone(s));
  },
};
