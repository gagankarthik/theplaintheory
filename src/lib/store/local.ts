import { promises as fs } from "node:fs";
import path from "node:path";
import { GENESIS_HASH, hashReceipt, id } from "../crypto";
import { AUDIT_GENESIS, hashAudit } from "../audit-chain";
import type {
  AuditEvent,
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
} from "../types";
import type { AuditDraft, AuditQuery, ReceiptDraft, ReceiptQuery, Store } from "./types";

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
}

const DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_FILE = path.join(DIR, "db.json");
const RECEIPTS_DIR = path.join(DIR, "receipts");
const AUDIT_DIR = path.join(DIR, "audit");

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
  // Reload when something else rewrote the file (e.g. `npm run seed` while the dev server runs),
  // and drop cached chain heads with it so new receipts never link to a stale head.
  const mtime = await mtimeOf();
  if (state.cache && mtime === state.cacheMtime) return state.cache;
  try {
    state.cache = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db;
  } catch {
    state.cache = { users: [], orgs: [], memberships: [], invites: [], properties: [], counters: [] };
  }
  state.cacheMtime = mtime;
  heads.clear();
  return state.cache;
}

async function save() {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
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
  async updateOrg(oid, patch) {
    return mutate((db) => {
      const o = db.orgs.find((x) => x.id === oid);
      if (!o) throw new Error("Organization not found");
      Object.assign(o, patch, { id: o.id });
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

  async createLead(l) {
    return mutate((db) => {
      (db.leads ??= []).push(l);
      return l;
    });
  },
  async countRecentLeads(ipHash, sinceIso) {
    return ((await load()).leads ?? []).filter((l) => l.ipHash === ipHash && l.createdAt >= sinceIso).length;
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
};
