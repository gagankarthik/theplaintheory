import { promises as fs } from "node:fs";
import path from "node:path";
import { GENESIS_HASH, hashReceipt, id } from "../crypto";
import type { ConsentReceipt, Invite, Membership, Organization, PageviewCounter, Property, User } from "../types";
import type { ReceiptDraft, ReceiptQuery, Store } from "./types";

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
}

const DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_FILE = path.join(DIR, "db.json");
const RECEIPTS_DIR = path.join(DIR, "receipts");

let cache: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Serialize all mutations so concurrent requests can't interleave writes. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function load(): Promise<Db> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db;
  } catch {
    cache = { users: [], orgs: [], memberships: [], invites: [], properties: [], counters: [] };
  }
  return cache;
}

async function save() {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
  await fs.rename(tmp, DB_FILE);
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

const heads = new Map<string, { seq: number; hash: string }>();

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

  async createOrg(o, owner) {
    return mutate((db) => {
      db.orgs.push(o);
      db.memberships.push({ orgId: o.id, userId: owner, role: "owner", createdAt: o.createdAt });
      return o;
    });
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
  async listReceipts(propertyId, q: ReceiptQuery = {}) {
    let rows = await readReceipts(propertyId);
    if (q.from) rows = rows.filter((r) => r.timestamp >= q.from!);
    if (q.to) rows = rows.filter((r) => r.timestamp <= q.to!);
    if (q.before) rows = rows.filter((r) => r.seq < q.before!);
    rows.reverse();
    return q.limit ? rows.slice(0, q.limit) : rows;
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
