import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLES, dynamo } from "../aws";
import { AUDIT_GENESIS, hashAudit } from "../audit-chain";
import { WINDOW_MS as LOCKOUT_WINDOW_MS } from "../auth/lockout";
import { GENESIS_HASH, hashReceipt, id } from "../crypto";
import { PLATFORM_AUDIT_GENESIS, hashPlatformAudit } from "../platform/audit-chain";
import type { PlatformAuditEvent } from "../platform/types";
import { configVersionKey } from "../config-versions";
import type {
  AuditEvent,
  ConfigVersion,
  ConsentReceipt,
  Invite,
  Lead,
  LeadStatus,
  LeakReport,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  SessionRecord,
  User,
  WebhookDelivery,
} from "../types";
import type { SiteAuditReport } from "../site-audit/types";
import { SCAN_KEEP, type ScanReport } from "../trackers";
import { SITE_AUDIT_KEEP, type AuditDraft, type ReceiptDraft, type Store } from "./types";

/**
 * DynamoDB store across the six tables of docs/architecture/platform-architecture.md §6.
 * Every table has string PK/SK and a numeric TTL attribute `expiresAt` (epoch seconds).
 *
 * core (users, orgs, memberships, invites, sites with their config and webhook endpoints, chain heads of the audit trails)
 *   USER#<id>        PROFILE            GSI1 EMAIL#<email> · USER          GSI2 TYPE#USER · <createdAt>#<id>
 *   ORG#<id>         PROFILE                                               GSI2 TYPE#ORG  · <createdAt>#<id>
 *   ORG#<id>         MEMBER#<userId>    GSI1 USER#<userId> · ORG#<id>
 *   ORG#<id>         INVITE#<id>        GSI1 EMAIL#<email> · INVITE#<id>
 *   ORG#<id>         PROP#<id>          GSI1 SITEKEY#<key> · PROP          (the site: config, trackers, webhooks)
 *   PROP#<id>        PROFILE            { orgId }                          (pointer: site by id)
 *   PROP#<id>        SITEAUDIT#<iso>#<id>                                  (live site check report; newest 10 kept) TTL 180 days
 *   PROP#<id>        SCAN#<iso>#<id>                                       (tracker scan report; newest 20 kept) TTL 180 days
 *   PROP#<id>        CFGVER#<version:12>                                   (published config snapshot; write-once, no TTL)
 *   ORG#<id>         AUDIT#HEAD         { seq, hash }                      (org audit chain head)
 *   PLATFORM         AUDIT#HEAD         { seq, hash, firstMonth, lastMonth } (staff audit chain head)
 *
 * receipts
 *   PROP#<id>        RCPT#<seq:12>      GSI1 PROP#<id>#V#<visitorId> · RCPT#<seq:12>
 *   PROP#<id>        CHAIN#HEAD         { seq, hash }
 *
 * telemetry
 *   PROP#<id>        DAY#<yyyy-mm-dd>   atomic ADD views/bounces            TTL 25 months
 *   PROP#<id>        LEAK#<ts>#<id>                                         TTL 90 days
 *   PROP#<id>        WHD#<ts>#<id>                                          TTL 30 days
 *
 * audit (append-only: PutItem with attribute_not_exists only, never updated or deleted; no TTL, so chains stay verifiable)
 *   ORG#<id>         TS#<iso>#<id>      GSI1 ACTOR#<userId> · TS#<iso>#<id>
 *   PLATFORM#<yyyy-mm> TS#<iso>#<id>    GSI1 ACTOR#<userId> · TS#<iso>#<id>
 *
 * leads
 *   LEAD#<id>        PROFILE            GSI1 STATUS#<status> · <createdAt>#<id>   GSI2 EMAIL#<email> · <createdAt>   TTL 24 months
 *                    (topic: sales | support | partner | enterprise; a status change rewrites GSI1PK)
 *
 * ephemeral
 *   SESSION#<id>     SESSION            TTL = session end
 *   USERSESS#<uid>   SESSION#<id>       (index of a user's sessions)        TTL = session end
 *                    (staff console sessions use uid "staff:<cognito sub>" and carry kind + staff)
 *   LOCK#<userId>    LOCK               sign-in failures / lock              TTL = end of window or lock
 *   RATE#<name>#<key>#<window> RATE     atomic ADD (see rate-limit-dynamo)  TTL = window end + one window
 *   STRIPE#<eventId> STRIPE             webhook idempotency                  TTL 30 days
 *   LEADIP#<ipHash>  <createdAt>#<id>   contact-form abuse window            TTL 1 day
 */

type Item = Record<string, unknown>;
type Key = { PK: string; SK: string };
const db = () => dynamo();

const DAY_S = 86_400;
const KEY_ATTRS = new Set(["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "expiresAt"]);

/** Drop the table's key and TTL attributes, leaving the domain object. */
function strip<T>(item: Item | undefined | null): T | null {
  if (!item) return null;
  return Object.fromEntries(Object.entries(item).filter(([k]) => !KEY_ATTRS.has(k))) as T;
}
const epochS = (iso: string | number) => Math.floor((typeof iso === "number" ? iso : Date.parse(iso)) / 1000);
const nowS = () => Math.floor(Date.now() / 1000);
const pad = (n: number) => String(n).padStart(12, "0");
const rcptKey = (n: number) => `RCPT#${pad(n)}`;
const tsKey = (createdAt: string, eventId: string) => `TS#${createdAt}#${eventId}`;
const monthOf = (iso: string) => iso.slice(0, 7);
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}
const isConditionFailure = (e: unknown) => e instanceof ConditionalCheckFailedException || (e as { name?: string })?.name === "ConditionalCheckFailedException";
/** A transaction cancelled because one of its conditions failed (not a conflict or a throttle). */
const isTransactionConditionFailure = (e: unknown) =>
  (e as { name?: string })?.name === "TransactionCanceledException" &&
  Boolean((e as { CancellationReasons?: { Code?: string }[] }).CancellationReasons?.some((r) => r.Code === "ConditionalCheckFailed"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Query every page (optionally stopping once `max` items have been collected). */
async function query(input: QueryCommandInput, max?: number): Promise<Item[]> {
  const out: Item[] = [];
  let ExclusiveStartKey: Item | undefined;
  do {
    const r = await db().send(new QueryCommand({ ...input, ExclusiveStartKey }));
    out.push(...((r.Items as Item[]) ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey && (max === undefined || out.length < max));
  return max === undefined ? out : out.slice(0, max);
}

/** BatchGetItem in chunks of 100, retrying unprocessed keys. Missing items are simply absent. */
async function batchGet(table: string, keys: Key[], consistent = false): Promise<Item[]> {
  const out: Item[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    let pending: Key[] = keys.slice(i, i + 100);
    for (let attempt = 0; pending.length; attempt++) {
      if (attempt > 0) await sleep(Math.min(1000, 50 * 2 ** attempt));
      const r = await db().send(new BatchGetCommand({ RequestItems: { [table]: { Keys: pending, ConsistentRead: consistent } } }));
      out.push(...((r.Responses?.[table] as Item[]) ?? []));
      pending = (r.UnprocessedKeys?.[table]?.Keys as Key[]) ?? [];
      if (attempt > 8 && pending.length) throw new Error(`BatchGet on ${table} kept returning unprocessed keys`);
    }
  }
  return out;
}

/** BatchWriteItem deletes in chunks of 25, retrying unprocessed items. */
async function batchDelete(table: string, keys: Key[]): Promise<number> {
  for (let i = 0; i < keys.length; i += 25) {
    let pending = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; pending.length; attempt++) {
      if (attempt > 0) await sleep(Math.min(1000, 50 * 2 ** attempt));
      const r = await db().send(new BatchWriteCommand({ RequestItems: { [table]: pending } }));
      pending = (r.UnprocessedItems?.[table] as typeof pending) ?? [];
      if (attempt > 8 && pending.length) throw new Error(`BatchWrite on ${table} kept returning unprocessed items`);
    }
  }
  return keys.length;
}

const keysOf = (items: Item[]) => items.map((i) => ({ PK: i.PK as string, SK: i.SK as string }));

/**
 * SET/REMOVE expression from a patch. An undefined value means "remove this field", matching the
 * local store. Attribute names are always placeholders, so reserved words are safe.
 */
function updateExpression(fields: Item) {
  const names: Record<string, string> = {};
  const values: Item = {};
  const set: string[] = [];
  const remove: string[] = [];
  Object.entries(fields).forEach(([k, v], i) => {
    names[`#a${i}`] = k;
    if (v === undefined) remove.push(`#a${i}`);
    else {
      values[`:v${i}`] = v;
      set.push(`#a${i} = :v${i}`);
    }
  });
  const UpdateExpression = [set.length ? `SET ${set.join(", ")}` : "", remove.length ? `REMOVE ${remove.join(", ")}` : ""].filter(Boolean).join(" ");
  return { UpdateExpression, ExpressionAttributeNames: names, ExpressionAttributeValues: set.length ? values : undefined, empty: !UpdateExpression };
}

/** UpdateItem on an existing item from a patch; throws `notFound` when the item doesn't exist. */
async function patchItem(table: string, key: Key, fields: Item, notFound: string): Promise<Item> {
  const expr = updateExpression(fields);
  if (expr.empty) {
    const r = await db().send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }));
    if (!r.Item) throw new Error(notFound);
    return r.Item;
  }
  try {
    const r = await db().send(
      new UpdateCommand({
        TableName: table,
        Key: key,
        UpdateExpression: expr.UpdateExpression,
        ExpressionAttributeNames: expr.ExpressionAttributeNames,
        ExpressionAttributeValues: expr.ExpressionAttributeValues,
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return r.Attributes as Item;
  } catch (e) {
    if (isConditionFailure(e)) throw new Error(notFound);
    throw e;
  }
}

/** Remove keys from an object (copy). */
function omit<T extends object>(obj: T, keys: readonly string[]): Item {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}

/* ----------------------------------------------------------------------------------------------
 * Hash-chained append: write the new item and advance its chain head in one conditional
 * transaction. The head update only succeeds if nobody advanced it since we read it, and the item
 * put only succeeds if its key is new, so concurrent writers can never fork a chain; the loser
 * re-reads the head and tries again.
 * -------------------------------------------------------------------------------------------- */
async function appendChained<E extends { seq: number; hash: string }>(opts: {
  label: string;
  headTable: string;
  headKey: Key;
  genesis: string;
  build: (head: { seq: number; hash: string } & Item) => E;
  itemTable: string;
  item: (e: E) => Item;
  /** extra attributes to keep on the head (e.g. the platform trail's month range) */
  headExtra?: (head: Item | undefined, e: E) => Item;
}): Promise<E> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await sleep(Math.floor(Math.random() * 25 * 2 ** Math.min(attempt, 5)));
    const headRes = await db().send(new GetCommand({ TableName: opts.headTable, Key: opts.headKey, ConsistentRead: true }));
    const stored = headRes.Item as ({ seq: number; hash: string } & Item) | undefined;
    const head = stored ?? { seq: 0, hash: opts.genesis };
    const event = opts.build(head);
    const extra = opts.headExtra?.(stored, event) ?? {};
    const sets = ["seq = :n", "#h = :h", ...Object.keys(extra).map((k, i) => `#x${i} = :x${i}`)];
    const names: Record<string, string> = { "#h": "hash" };
    const values: Item = { ":n": event.seq, ":h": event.hash };
    Object.entries(extra).forEach(([k, v], i) => {
      names[`#x${i}`] = k;
      values[`:x${i}`] = v;
    });
    if (stored) values[":s"] = head.seq;
    try {
      await db().send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: opts.itemTable, Item: opts.item(event), ConditionExpression: "attribute_not_exists(PK)" } },
            {
              Update: {
                TableName: opts.headTable,
                Key: opts.headKey,
                UpdateExpression: `SET ${sets.join(", ")}`,
                ConditionExpression: stored ? "seq = :s" : "attribute_not_exists(PK)",
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values,
              },
            },
          ],
        }),
      );
      return event;
    } catch (e) {
      if (e instanceof TransactionCanceledException || (e as { name?: string })?.name === "TransactionCanceledException") continue;
      throw e;
    }
  }
  throw new Error(`Could not append ${opts.label}: chain head contention`);
}

/* ---------------- users and sign-in lockout ---------------- */

const LOCK_FIELDS = ["loginFailures", "lockedUntil"] as const;
type LockState = Pick<User, "loginFailures" | "lockedUntil">;

const userKey = (uid: string): Key => ({ PK: `USER#${uid}`, SK: "PROFILE" });
const lockKey = (uid: string): Key => ({ PK: `LOCK#${uid}`, SK: "LOCK" });

function userItem(u: User): Item {
  return {
    ...userKey(u.id),
    GSI1PK: `EMAIL#${u.email.toLowerCase()}`,
    GSI1SK: "USER",
    GSI2PK: "TYPE#USER",
    GSI2SK: `${u.createdAt}#${u.id}`,
    ...omit(u, LOCK_FIELDS),
  };
}

async function readLock(uid: string): Promise<LockState> {
  const r = await db().send(new GetCommand({ TableName: TABLES.ephemeral, Key: lockKey(uid), ConsistentRead: true }));
  return lockFromItem(r.Item);
}
function lockFromItem(item: Item | undefined): LockState {
  if (!item) return {};
  const out: LockState = {};
  if (item.loginFailures) out.loginFailures = item.loginFailures as LockState["loginFailures"];
  if (item.lockedUntil) out.lockedUntil = item.lockedUntil as string;
  return out;
}

/** Apply lockout fields from a user patch to the LOCK# item (undefined removes a field). */
async function writeLock(uid: string, patch: Partial<User>): Promise<LockState> {
  const next: LockState = await readLock(uid);
  for (const f of LOCK_FIELDS) {
    if (!(f in patch)) continue;
    if (patch[f] === undefined) delete next[f];
    else (next as Item)[f] = patch[f];
  }
  if (!next.loginFailures && !next.lockedUntil) {
    await db().send(new DeleteCommand({ TableName: TABLES.ephemeral, Key: lockKey(uid) }));
    return {};
  }
  // Keep the item until both the failure window and the lock are over; after that it means nothing.
  const ends = Math.max(next.lockedUntil ? Date.parse(next.lockedUntil) : 0, next.loginFailures ? Date.parse(next.loginFailures.windowStart) + LOCKOUT_WINDOW_MS : 0);
  await db().send(new PutCommand({ TableName: TABLES.ephemeral, Item: { ...lockKey(uid), userId: uid, ...next, expiresAt: epochS(ends) + 60 } }));
  return next;
}

const withLock = (u: User, lock: LockState): User => ({ ...u, ...lock });

/** Full user records (with lockout state) for a set of ids. */
async function loadUsers(ids: string[]): Promise<Map<string, User>> {
  const unique = [...new Set(ids)];
  const [profiles, locks] = await Promise.all([batchGet(TABLES.core, unique.map(userKey)), batchGet(TABLES.ephemeral, unique.map(lockKey))]);
  const lockBy = new Map(locks.map((l) => [String(l.PK).slice(5), lockFromItem(l)]));
  const out = new Map<string, User>();
  for (const p of profiles) {
    const u = strip<User>(p)!;
    out.set(u.id, withLock(u, lockBy.get(u.id) ?? {}));
  }
  return out;
}

/** Ids of every item of a type on core GSI2, newest first. */
async function listTypeKeys(type: "USER" | "ORG"): Promise<Key[]> {
  const items = await query({
    TableName: TABLES.core,
    IndexName: "GSI2",
    KeyConditionExpression: "GSI2PK = :t",
    ExpressionAttributeValues: { ":t": `TYPE#${type}` },
    ProjectionExpression: "PK, SK",
    ScanIndexForward: false,
  });
  return keysOf(items);
}

/* ---------------- sessions ---------------- */

const sessionKey = (sid: string): Key => ({ PK: `SESSION#${sid}`, SK: "SESSION" });
function sessionFromItem(item: Item): SessionRecord {
  const { sessionEndsAt, ...rest } = strip<Item>(item)!;
  return { ...(rest as unknown as SessionRecord), expiresAt: String(sessionEndsAt) };
}

/* ---------------- audit ---------------- */

function auditItem(pk: string, e: { id: string; createdAt: string; actorUserId: string | null }, body: object): Item {
  const sk = tsKey(e.createdAt, e.id);
  return { PK: pk, SK: sk, ...(e.actorUserId ? { GSI1PK: `ACTOR#${e.actorUserId}`, GSI1SK: sk } : {}), ...body };
}

/** Filter expression pieces shared by both audit listings. */
function auditFilters(q: { before?: number; action?: string }) {
  const parts: string[] = [];
  const names: Record<string, string> = {};
  const values: Item = {};
  if (q.before) {
    parts.push("seq < :before");
    values[":before"] = q.before;
  }
  if (q.action) {
    parts.push("(#act = :act OR begins_with(#act, :actp))");
    names["#act"] = "action";
    values[":act"] = q.action;
    values[":actp"] = `${q.action}.`;
  }
  return { parts, names, values };
}

const bySeqDesc = <T extends { seq: number }>(rows: T[]) => rows.sort((a, b) => b.seq - a.seq);

/* ---------------- properties ---------------- */

const propPointerKey = (pid: string): Key => ({ PK: `PROP#${pid}`, SK: "PROFILE" });
const propKey = (orgId: string, pid: string): Key => ({ PK: `ORG#${orgId}`, SK: `PROP#${pid}` });
const propItem = (p: Property): Item => ({ ...propKey(p.orgId, p.id), GSI1PK: `SITEKEY#${p.siteKey}`, GSI1SK: "PROP", ...p });

async function propertyOrg(pid: string): Promise<string | null> {
  const r = await db().send(new GetCommand({ TableName: TABLES.core, Key: propPointerKey(pid) }));
  return (r.Item?.orgId as string | undefined) ?? null;
}

/* ---------------- telemetry ---------------- */

const COUNTER_TTL_S = 25 * 31 * DAY_S;
const LEAK_TTL_S = 90 * DAY_S;
const DELIVERY_TTL_S = 30 * DAY_S;
const LEAD_TTL_S = 730 * DAY_S;
const LEAD_IP_TTL_S = DAY_S;
const STRIPE_TTL_S = 30 * DAY_S;
const SITE_AUDIT_TTL_S = 180 * DAY_S;
const SCAN_TTL_S = 180 * DAY_S;

const orgKey = (oid: string): Key => ({ PK: `ORG#${oid}`, SK: "PROFILE" });
const orgItem = (o: Organization): Item => ({ ...orgKey(o.id), GSI2PK: "TYPE#ORG", GSI2SK: `${o.createdAt}#${o.id}`, ...o });
const memberItem = (m: Membership): Item => ({ PK: `ORG#${m.orgId}`, SK: `MEMBER#${m.userId}`, GSI1PK: `USER#${m.userId}`, GSI1SK: `ORG#${m.orgId}`, ...m });
/**
 * The same membership from the user's side, written in the same transaction as the org's copy. Listing a
 * user's memberships reads this with a strongly consistent query: GSI reads are only eventually
 * consistent, so right after onboarding the index could miss the new org and bounce them back to it.
 */
const userMemberItem = (m: Membership): Item => ({ PK: `USER#${m.userId}`, SK: `MEMBER#${m.orgId}`, ...m });
const userMemberKey = (orgId: string, userId: string) => ({ PK: `USER#${userId}`, SK: `MEMBER#${orgId}` });

export const dynamoStore: Store = {
  /* ---------- users ---------- */

  async createUser(u) {
    await db().send(new PutCommand({ TableName: TABLES.core, Item: userItem(u), ConditionExpression: "attribute_not_exists(PK)" }));
    if (u.loginFailures || u.lockedUntil) await writeLock(u.id, u);
    return u;
  },
  async getUser(uid) {
    const [r, lock] = await Promise.all([db().send(new GetCommand({ TableName: TABLES.core, Key: userKey(uid) })), readLock(uid)]);
    const u = strip<User>(r.Item);
    return u ? withLock(u, lock) : null;
  },
  async getUserByEmail(email) {
    const r = await db().send(
      new QueryCommand({
        TableName: TABLES.core,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :e AND GSI1SK = :s",
        ExpressionAttributeValues: { ":e": `EMAIL#${email.toLowerCase()}`, ":s": "USER" },
      }),
    );
    const u = strip<User>(r.Items?.[0]);
    return u ? withLock(u, await readLock(u.id)) : null;
  },
  async updateUser(uid, patch) {
    const fields = omit(patch, ["id", ...LOCK_FIELDS]);
    if (typeof fields.email === "string") fields.GSI1PK = `EMAIL#${fields.email.toLowerCase()}`;
    if (typeof fields.createdAt === "string") fields.GSI2SK = `${fields.createdAt}#${uid}`;
    const touchesLock = LOCK_FIELDS.some((f) => f in patch);
    const [item, lock] = await Promise.all([patchItem(TABLES.core, userKey(uid), fields, "User not found"), touchesLock ? null : readLock(uid)]);
    // Lockout state is written only once the user is known to exist.
    return withLock(strip<User>(item)!, lock ?? (await writeLock(uid, patch)));
  },
  async listUsers() {
    const keys = await listTypeKeys("USER");
    const users = await loadUsers(keys.map((k) => k.PK.slice(5)));
    return keys.map((k) => users.get(k.PK.slice(5))).filter((u): u is User => Boolean(u));
  },

  /* ---------- sessions (ephemeral) ---------- */

  async createSessionRecord(rec) {
    // The TTL attribute is the numeric `expiresAt`; the record's ISO end time travels as `sessionEndsAt`.
    const { expiresAt, ...rest } = rec;
    const ttl = epochS(expiresAt);
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLES.ephemeral, Item: { ...sessionKey(rec.id), ...rest, sessionEndsAt: expiresAt, expiresAt: ttl } } },
          { Put: { TableName: TABLES.ephemeral, Item: { PK: `USERSESS#${rec.userId}`, SK: `SESSION#${rec.id}`, sessionId: rec.id, createdAt: rec.createdAt, expiresAt: ttl } } },
        ],
      }),
    );
    return rec;
  },
  async getSessionRecord(sid) {
    const r = await db().send(new GetCommand({ TableName: TABLES.ephemeral, Key: sessionKey(sid), ConsistentRead: true }));
    return r.Item ? sessionFromItem(r.Item) : null;
  },
  async touchSession(sid, lastSeenAt) {
    await db()
      .send(
        new UpdateCommand({
          TableName: TABLES.ephemeral,
          Key: sessionKey(sid),
          UpdateExpression: "SET lastSeenAt = :t",
          ConditionExpression: "attribute_exists(PK)",
          ExpressionAttributeValues: { ":t": lastSeenAt },
        }),
      )
      .catch((e) => {
        if (!isConditionFailure(e)) throw e;
      });
  },
  async revokeSession(sid, at) {
    await db()
      .send(
        new UpdateCommand({
          TableName: TABLES.ephemeral,
          Key: sessionKey(sid),
          UpdateExpression: "SET revokedAt = if_not_exists(revokedAt, :t)",
          ConditionExpression: "attribute_exists(PK)",
          ExpressionAttributeValues: { ":t": at },
        }),
      )
      .catch((e) => {
        if (!isConditionFailure(e)) throw e;
      });
  },
  async revokeUserSessions(userId, at, exceptId) {
    const sessions = await this.listUserSessions(userId);
    const targets = sessions.filter((x) => x.id !== exceptId && !x.revokedAt);
    await Promise.all(targets.map((x) => this.revokeSession(x.id, at)));
    return targets.length;
  },
  async listUserSessions(userId) {
    const index = await query({
      TableName: TABLES.ephemeral,
      KeyConditionExpression: "PK = :u AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":u": `USERSESS#${userId}`, ":s": "SESSION#" },
    });
    const items = await batchGet(
      TABLES.ephemeral,
      index.map((i) => sessionKey(String(i.sessionId))),
      true,
    );
    return items.map(sessionFromItem).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  },

  /* ---------- org audit (audit table, append-only; head in core) ---------- */

  async appendAudit(draft: AuditDraft) {
    return appendChained<AuditEvent>({
      label: "audit event",
      headTable: TABLES.core,
      headKey: { PK: `ORG#${draft.orgId}`, SK: "AUDIT#HEAD" },
      genesis: AUDIT_GENESIS,
      build: (head) => {
        const unsigned = { ...draft, createdAt: draft.createdAt ?? new Date().toISOString(), id: id("aud"), seq: head.seq + 1, prevHash: head.hash };
        return { ...unsigned, hash: hashAudit(unsigned) };
      },
      itemTable: TABLES.audit,
      item: (e) => auditItem(`ORG#${e.orgId}`, e, e),
    });
  },
  async listAudit(orgId, q = {}) {
    const f = auditFilters(q);
    let input: QueryCommandInput;
    if (q.actorUserId) {
      // Everything one person did (GSI1), narrowed to this organization.
      f.parts.push("orgId = :org");
      f.values[":org"] = orgId;
      input = {
        TableName: TABLES.audit,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :ts)",
        ExpressionAttributeValues: { ":pk": `ACTOR#${q.actorUserId}`, ":ts": "TS#", ...f.values },
      };
    } else {
      input = {
        TableName: TABLES.audit,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :ts)",
        ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":ts": "TS#", ...f.values },
      };
    }
    if (f.parts.length) input.FilterExpression = f.parts.join(" AND ");
    if (Object.keys(f.names).length) input.ExpressionAttributeNames = f.names;
    if (q.limit && !f.parts.length) input.Limit = q.limit;
    input.ScanIndexForward = false;
    const items = await query(input, q.limit);
    return bySeqDesc(items.map((i) => strip<AuditEvent>(i)!));
  },

  /* ---------- platform audit (audit table, partitioned by month; head in core) ---------- */

  async appendPlatformAudit(draft) {
    return appendChained<PlatformAuditEvent>({
      label: "platform audit event",
      headTable: TABLES.core,
      headKey: { PK: "PLATFORM", SK: "AUDIT#HEAD" },
      genesis: PLATFORM_AUDIT_GENESIS,
      build: (head) => {
        const unsigned = { ...draft, createdAt: draft.createdAt ?? new Date().toISOString(), id: id("paud"), seq: head.seq + 1, prevHash: head.hash };
        return { ...unsigned, hash: hashPlatformAudit(unsigned) };
      },
      itemTable: TABLES.audit,
      item: (e) => auditItem(`PLATFORM#${monthOf(e.createdAt)}`, e, e),
      // The month range tells the listing which partitions exist, so it never probes empty months.
      headExtra: (head, e) => {
        const m = monthOf(e.createdAt);
        const first = head?.firstMonth as string | undefined;
        const last = head?.lastMonth as string | undefined;
        return { firstMonth: first && first < m ? first : m, lastMonth: last && last > m ? last : m };
      },
    });
  },
  async listPlatformAudit(q = {}) {
    const head = (await db().send(new GetCommand({ TableName: TABLES.core, Key: { PK: "PLATFORM", SK: "AUDIT#HEAD" } }))).Item;
    if (!head) return [];
    const f = auditFilters(q);
    if (q.targetId) {
      f.parts.push("#tg.#tid = :tid");
      f.names["#tg"] = "target";
      f.names["#tid"] = "id";
      f.values[":tid"] = q.targetId;
    }
    const rows: PlatformAuditEvent[] = [];
    const first = String(head.firstMonth);
    for (let m = String(head.lastMonth); m >= first; m = prevMonth(m)) {
      const want = q.limit ? q.limit - rows.length : undefined;
      const input: QueryCommandInput = {
        TableName: TABLES.audit,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :ts)",
        ExpressionAttributeValues: { ":pk": `PLATFORM#${m}`, ":ts": "TS#", ...f.values },
        ScanIndexForward: false,
      };
      if (f.parts.length) input.FilterExpression = f.parts.join(" AND ");
      if (Object.keys(f.names).length) input.ExpressionAttributeNames = f.names;
      if (want && !f.parts.length) input.Limit = want;
      rows.push(...bySeqDesc((await query(input, want)).map((i) => strip<PlatformAuditEvent>(i)!)));
      if (q.limit && rows.length >= q.limit) break;
    }
    return rows;
  },

  /* ---------- organizations and membership (core) ---------- */

  async createOrg(o, owner) {
    const m: Membership = { orgId: o.id, userId: owner, role: "owner", createdAt: o.createdAt };
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLES.core, Item: orgItem(o), ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: TABLES.core, Item: memberItem(m) } },
          { Put: { TableName: TABLES.core, Item: userMemberItem(m) } },
        ],
      }),
    );
    return o;
  },
  async getOrg(oid) {
    const r = await db().send(new GetCommand({ TableName: TABLES.core, Key: orgKey(oid) }));
    return strip<Organization>(r.Item);
  },
  async listOrgs() {
    const keys = await listTypeKeys("ORG");
    const items = await batchGet(TABLES.core, keys);
    const byPk = new Map(items.map((i) => [String(i.PK), strip<Organization>(i)!]));
    return keys.map((k) => byPk.get(k.PK)).filter((o): o is Organization => Boolean(o));
  },
  async updateOrg(oid, patch) {
    const fields = omit(patch, ["id"]);
    if (typeof fields.createdAt === "string") fields.GSI2SK = `${fields.createdAt}#${oid}`;
    return strip<Organization>(await patchItem(TABLES.core, orgKey(oid), fields, "Organization not found"))!;
  },
  async listMemberships(userId) {
    const items = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :u AND begins_with(SK, :m)",
      ExpressionAttributeValues: { ":u": `USER#${userId}`, ":m": "MEMBER#" },
      ConsistentRead: true,
    });
    return items.map((i) => strip<Membership>(i)!);
  },
  async getMembership(orgId, userId) {
    const r = await db().send(new GetCommand({ TableName: TABLES.core, Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` }, ConsistentRead: true }));
    return strip<Membership>(r.Item);
  },
  async listMembers(orgId) {
    const items = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :m)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":m": "MEMBER#" },
    });
    const members = items.map((i) => strip<Membership>(i)!);
    const users = await loadUsers(members.map((m) => m.userId));
    return members.map((m) => ({ ...m, user: users.get(m.userId) ?? null }));
  },
  async setRole(orgId, userId, role) {
    await db()
      .send(
        new UpdateCommand({
          TableName: TABLES.core,
          Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` },
          UpdateExpression: "SET #r = :r",
          ExpressionAttributeNames: { "#r": "role" },
          ExpressionAttributeValues: { ":r": role },
          ConditionExpression: "attribute_exists(PK)",
        }),
      )
      .then(() =>
        db().send(new UpdateCommand({ TableName: TABLES.core, Key: userMemberKey(orgId, userId), UpdateExpression: "SET #r = :r", ExpressionAttributeNames: { "#r": "role" }, ExpressionAttributeValues: { ":r": role } })),
      )
      .catch((e) => {
        if (!isConditionFailure(e)) throw e; // no membership: nothing to change, like the local store
      });
  },
  async addMember(m) {
    await db()
      .send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: TABLES.core, Item: memberItem(m), ConditionExpression: "attribute_not_exists(PK)" } },
            { Put: { TableName: TABLES.core, Item: userMemberItem(m) } },
          ],
        }),
      )
      .catch((e) => {
        if (!isTransactionConditionFailure(e)) throw e; // already a member: keep the existing role
      });
  },
  async removeMember(orgId, userId) {
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: TABLES.core, Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` } } },
          { Delete: { TableName: TABLES.core, Key: userMemberKey(orgId, userId) } },
        ],
      }),
    );
  },
  async createInvite(i) {
    await db().send(
      new PutCommand({
        TableName: TABLES.core,
        Item: { PK: `ORG#${i.orgId}`, SK: `INVITE#${i.id}`, GSI1PK: `EMAIL#${i.email.toLowerCase()}`, GSI1SK: `INVITE#${i.id}`, ...i },
      }),
    );
    return i;
  },
  async listInvites(orgId) {
    const items = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :i)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":i": "INVITE#" },
    });
    return items.map((i) => strip<Invite>(i)!);
  },
  async invitesForEmail(email) {
    const items = await query({
      TableName: TABLES.core,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :e AND begins_with(GSI1SK, :i)",
      ExpressionAttributeValues: { ":e": `EMAIL#${email.toLowerCase()}`, ":i": "INVITE#" },
    });
    return items.map((i) => strip<Invite>(i)!);
  },
  async deleteInvite(orgId, inviteId) {
    await db().send(new DeleteCommand({ TableName: TABLES.core, Key: { PK: `ORG#${orgId}`, SK: `INVITE#${inviteId}` } }));
  },

  /* ---------- sites (core) ---------- */

  async createProperty(p) {
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLES.core, Item: propItem(p), ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: TABLES.core, Item: { ...propPointerKey(p.id), orgId: p.orgId }, ConditionExpression: "attribute_not_exists(PK)" } },
        ],
      }),
    );
    return p;
  },
  async getProperty(pid) {
    const orgId = await propertyOrg(pid);
    if (!orgId) return null;
    const r = await db().send(new GetCommand({ TableName: TABLES.core, Key: propKey(orgId, pid) }));
    return strip<Property>(r.Item);
  },
  async getPropertyBySiteKey(siteKey) {
    // GSI1 projects the whole site, so the public config path is a single query.
    const r = await db().send(
      new QueryCommand({
        TableName: TABLES.core,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :k AND GSI1SK = :p",
        ExpressionAttributeValues: { ":k": `SITEKEY#${siteKey}`, ":p": "PROP" },
      }),
    );
    return strip<Property>(r.Items?.[0]);
  },
  async listProperties(orgId) {
    const items = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :p)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":p": "PROP#" },
    });
    return items.map((i) => strip<Property>(i)!);
  },
  async updateProperty(pid, patch) {
    const orgId = await propertyOrg(pid);
    if (!orgId) throw new Error("Property not found");
    const fields: Item = { ...omit(patch, ["id", "orgId"]), updatedAt: new Date().toISOString() };
    if (typeof fields.siteKey === "string") fields.GSI1PK = `SITEKEY#${fields.siteKey}`;
    return strip<Property>(await patchItem(TABLES.core, propKey(orgId, pid), fields, "Property not found"))!;
  },
  async deleteProperty(pid) {
    const orgId = await propertyOrg(pid);
    if (!orgId) return;
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: TABLES.core, Key: propKey(orgId, pid) } },
          { Delete: { TableName: TABLES.core, Key: propPointerKey(pid) } },
        ],
      }),
    );
    // Like the local store: the site's receipts (with its chain head) and its telemetry go with it.
    const keyOnly = (table: string) =>
      query({ TableName: table, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": `PROP#${pid}` }, ProjectionExpression: "PK, SK" });
    const audits = query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":p": `PROP#${pid}`, ":s": "SITEAUDIT#" },
      ProjectionExpression: "PK, SK",
    });
    const cfgVersions = query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":p": `PROP#${pid}`, ":s": "CFGVER#" },
      ProjectionExpression: "PK, SK",
    });
    const trackerScans = query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":p": `PROP#${pid}`, ":s": "SCAN#" },
      ProjectionExpression: "PK, SK",
    });
    const [receipts, telemetry, siteAudits, versions, scans] = await Promise.all([keyOnly(TABLES.receipts), keyOnly(TABLES.telemetry), audits, cfgVersions, trackerScans]);
    await Promise.all([
      batchDelete(TABLES.receipts, keysOf(receipts)),
      batchDelete(TABLES.telemetry, keysOf(telemetry)),
      batchDelete(TABLES.core, keysOf(siteAudits)),
      batchDelete(TABLES.core, keysOf(versions)),
      batchDelete(TABLES.core, keysOf(scans)),
    ]);
  },

  /* ---------- consent receipts (receipts) ---------- */

  async appendReceipt(draft: ReceiptDraft) {
    return appendChained<ConsentReceipt>({
      label: "receipt",
      headTable: TABLES.receipts,
      headKey: { PK: `PROP#${draft.propertyId}`, SK: "CHAIN#HEAD" },
      genesis: GENESIS_HASH,
      build: (head) => {
        const unsigned = { ...draft, id: id("rcpt"), seq: head.seq + 1, prevHash: head.hash };
        return { ...unsigned, hash: hashReceipt(unsigned) };
      },
      itemTable: TABLES.receipts,
      item: (r) => ({
        PK: `PROP#${r.propertyId}`,
        SK: rcptKey(r.seq),
        GSI1PK: `PROP#${r.propertyId}#V#${r.visitorId}`,
        GSI1SK: rcptKey(r.seq),
        ...r,
      }),
      headExtra: (_head, r) => ({ updatedAt: r.timestamp }),
    });
  },
  async listReceipts(propertyId, q = {}) {
    const upper = q.before ? rcptKey(q.before - 1) : "RCPT#~";
    if (q.before !== undefined && q.before <= 1) return [];
    const rows: ConsentReceipt[] = [];
    let ExclusiveStartKey: Item | undefined;
    do {
      const r = await db().send(
        new QueryCommand({
          TableName: TABLES.receipts,
          KeyConditionExpression: "PK = :p AND SK BETWEEN :lo AND :hi",
          ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":lo": "RCPT#", ":hi": upper },
          ScanIndexForward: false,
          ExclusiveStartKey,
        }),
      );
      for (const item of r.Items ?? []) {
        const rec = strip<ConsentReceipt>(item)!;
        if (q.to && rec.timestamp > q.to) continue;
        if (q.from && rec.timestamp < q.from) return rows; // newest first: everything after is older
        rows.push(rec);
        if (q.limit && rows.length >= q.limit) return rows;
      }
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return rows;
  },
  async deleteReceiptsThrough(propertyId, seq) {
    if (seq < 1) return 0;
    const items = await query({
      TableName: TABLES.receipts,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :lo AND :hi",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":lo": rcptKey(1), ":hi": rcptKey(seq) },
      ProjectionExpression: "PK, SK",
    });
    return batchDelete(TABLES.receipts, keysOf(items));
  },

  /* ---------- telemetry ---------- */

  async recordLeak(l) {
    await db().send(
      new PutCommand({ TableName: TABLES.telemetry, Item: { PK: `PROP#${l.propertyId}`, SK: `LEAK#${l.createdAt}#${l.id}`, ...l, expiresAt: epochS(l.createdAt) + LEAK_TTL_S } }),
    );
  },
  async listLeaks(propertyId, sinceIso) {
    const items = await query({
      TableName: TABLES.telemetry,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": `LEAK#${sinceIso}`, ":b": "LEAK#~" },
      ScanIndexForward: false,
    });
    return items.map((i) => strip<LeakReport>(i)!);
  },
  async pruneLeaks(propertyId, beforeIso) {
    const items = await query({
      TableName: TABLES.telemetry,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": "LEAK#", ":b": `LEAK#${beforeIso}` },
      ProjectionExpression: "PK, SK",
    });
    return batchDelete(TABLES.telemetry, keysOf(items));
  },
  async recordWebhookDelivery(d) {
    await db().send(
      new PutCommand({ TableName: TABLES.telemetry, Item: { PK: `PROP#${d.propertyId}`, SK: `WHD#${d.createdAt}#${d.id}`, ...d, expiresAt: epochS(d.createdAt) + DELIVERY_TTL_S } }),
    );
  },
  async listWebhookDeliveries(propertyId, limit) {
    if (limit < 1) return [];
    const items = await query(
      {
        TableName: TABLES.telemetry,
        KeyConditionExpression: "PK = :p AND begins_with(SK, :h)",
        ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":h": "WHD#" },
        ScanIndexForward: false,
        Limit: limit,
      },
      limit,
    );
    return items.map((i) => strip<WebhookDelivery>(i)!);
  },
  async pruneWebhookDeliveries(propertyId, beforeIso) {
    const items = await query({
      TableName: TABLES.telemetry,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": "WHD#", ":b": `WHD#${beforeIso}` },
      ProjectionExpression: "PK, SK",
    });
    return batchDelete(TABLES.telemetry, keysOf(items));
  },

  /* ---------- leads ---------- */

  async createLead(l) {
    const email = l.email.toLowerCase();
    await Promise.all([
      db().send(
        new PutCommand({
          TableName: TABLES.leads,
          Item: {
            PK: `LEAD#${l.id}`,
            SK: "PROFILE",
            GSI1PK: "STATUS#new",
            GSI1SK: `${l.createdAt}#${l.id}`,
            GSI2PK: `EMAIL#${email}`,
            GSI2SK: l.createdAt,
            ...l,
            status: "new",
            expiresAt: epochS(l.createdAt) + LEAD_TTL_S,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      ),
      // Abuse window per network, so countRecentLeads is a key query instead of a scan of the inbox
      // (the public endpoint may not read leads at all).
      db().send(
        new PutCommand({
          TableName: TABLES.ephemeral,
          Item: { PK: `LEADIP#${l.ipHash}`, SK: `${l.createdAt}#${l.id}`, createdAt: l.createdAt, expiresAt: epochS(l.createdAt) + LEAD_IP_TTL_S },
        }),
      ),
    ]);
    return l;
  },
  async countRecentLeads(ipHash, sinceIso) {
    let count = 0;
    let ExclusiveStartKey: Item | undefined;
    do {
      const r = await db().send(
        new QueryCommand({
          TableName: TABLES.ephemeral,
          KeyConditionExpression: "PK = :k AND SK >= :s",
          ExpressionAttributeValues: { ":k": `LEADIP#${ipHash}`, ":s": sinceIso },
          Select: "COUNT",
          ExclusiveStartKey,
        }),
      );
      count += r.Count ?? 0;
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return count;
  },
  /**
   * The staff inbox reads GSI1 (STATUS#<status> · <createdAt>#<id>, ALL projection) newest first: one
   * query for a status, or one per status merged by date when unfiltered. Never a scan. The topic is a
   * filter on top; leads stored before topics existed have none and count as sales.
   */
  async listLeads({ status, topic, limit = 200 } = {}) {
    if (limit < 1) return [];
    const filter =
      topic === undefined
        ? {}
        : topic === "sales"
          ? { FilterExpression: "topic = :t OR attribute_not_exists(topic)", ExpressionAttributeValues: { ":t": topic } }
          : { FilterExpression: "topic = :t", ExpressionAttributeValues: { ":t": topic } };
    const statuses: LeadStatus[] = status ? [status] : ["new", "open", "closed"];
    const pages = await Promise.all(
      statuses.map((s) =>
        query(
          {
            TableName: TABLES.leads,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :s",
            ...filter,
            ExpressionAttributeValues: { ":s": `STATUS#${s}`, ...filter.ExpressionAttributeValues },
            ScanIndexForward: false,
          },
          limit,
        ),
      ),
    );
    return pages
      .flat()
      .map((i) => strip<Lead>(i)!)
      .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, limit);
  },
  async getLead(leadId) {
    const r = await db().send(new GetCommand({ TableName: TABLES.leads, Key: { PK: `LEAD#${leadId}`, SK: "PROFILE" } }));
    return strip<Lead>(r.Item);
  },
  async updateLeadStatus(leadId, status) {
    // The status lives in the item and in GSI1PK; both change in one UpdateItem. GSI1SK is rewritten
    // from the stored createdAt (read first) so the item always sorts by when it arrived.
    const Key = { PK: `LEAD#${leadId}`, SK: "PROFILE" };
    const cur = await db().send(new GetCommand({ TableName: TABLES.leads, Key, ProjectionExpression: "createdAt", ConsistentRead: true }));
    const createdAt = cur.Item?.createdAt as string | undefined;
    if (!createdAt) return null;
    try {
      const r = await db().send(
        new UpdateCommand({
          TableName: TABLES.leads,
          Key,
          UpdateExpression: "SET #s = :s, GSI1PK = :pk, GSI1SK = :sk, updatedAt = :u",
          ConditionExpression: "attribute_exists(PK) AND createdAt = :c",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": status, ":pk": `STATUS#${status}`, ":sk": `${createdAt}#${leadId}`, ":u": new Date().toISOString(), ":c": createdAt },
          ReturnValues: "ALL_NEW",
        }),
      );
      return strip<Lead>(r.Attributes);
    } catch (e) {
      if (isConditionFailure(e)) return null;
      throw e;
    }
  },

  /* ---------- pageview counters (telemetry) ---------- */

  async recordPageview(propertyId, day, kind) {
    await db().send(
      new UpdateCommand({
        TableName: TABLES.telemetry,
        Key: { PK: `PROP#${propertyId}`, SK: `DAY#${day}` },
        UpdateExpression: "ADD #f :one SET propertyId = :p, #d = :d, expiresAt = if_not_exists(expiresAt, :ttl)",
        ExpressionAttributeNames: { "#f": kind === "view" ? "views" : "bounces", "#d": "day" },
        ExpressionAttributeValues: { ":one": 1, ":p": propertyId, ":d": day, ":ttl": epochS(`${day}T00:00:00Z`) + COUNTER_TTL_S },
      }),
    );
  },
  async listCounters(propertyId, fromDay, toDay) {
    const items = await query({
      TableName: TABLES.telemetry,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": `DAY#${fromDay}`, ":b": `DAY#${toDay}` },
    });
    return items.map((i) => {
      const c = strip<PageviewCounter>(i)!;
      return { ...c, views: c.views ?? 0, bounces: c.bounces ?? 0 };
    });
  },

  /* ---------- Stripe webhook idempotency (ephemeral) ---------- */

  async claimStripeEvent(eventId) {
    try {
      await db().send(
        new PutCommand({
          TableName: TABLES.ephemeral,
          Item: { PK: `STRIPE#${eventId}`, SK: "STRIPE", claimedAt: new Date().toISOString(), expiresAt: nowS() + STRIPE_TTL_S },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return true;
    } catch (e) {
      if (isConditionFailure(e)) return false;
      throw e;
    }
  },
  async releaseStripeEvent(eventId) {
    await db().send(new DeleteCommand({ TableName: TABLES.ephemeral, Key: { PK: `STRIPE#${eventId}`, SK: "STRIPE" } }));
  },

  /* ---------- live site checks (core) ---------- */

  async saveSiteAudit(propertyId, report) {
    const at = report.finishedAt || new Date().toISOString();
    await db().send(
      new PutCommand({
        TableName: TABLES.core,
        Item: { PK: `PROP#${propertyId}`, SK: `SITEAUDIT#${at}#${report.id}`, ...report, propertyId, expiresAt: epochS(at) + SITE_AUDIT_TTL_S },
      }),
    );
    // Keep the newest SITE_AUDIT_KEEP; older reports also expire by TTL.
    const keys = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":s": "SITEAUDIT#" },
      ScanIndexForward: false,
      ProjectionExpression: "PK, SK",
    });
    if (keys.length > SITE_AUDIT_KEEP) await batchDelete(TABLES.core, keysOf(keys.slice(SITE_AUDIT_KEEP)));
  },
  async listSiteAudits(propertyId, limit) {
    if (limit < 1) return [];
    const items = await query(
      {
        TableName: TABLES.core,
        KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
        ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":s": "SITEAUDIT#" },
        ScanIndexForward: false,
        Limit: limit,
      },
      limit,
    );
    return items.map((i) => strip<SiteAuditReport>(i)!);
  },

  /* ---------- published config snapshots (core) ---------- */

  async saveConfigVersion(v) {
    try {
      await db().send(
        new PutCommand({
          TableName: TABLES.core,
          Item: { PK: `PROP#${v.propertyId}`, SK: configVersionKey(v.version), ...v },
          // write once: a snapshot is evidence and is never replaced
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return true;
    } catch (e) {
      if (isConditionFailure(e)) return false;
      throw e;
    }
  },
  async getConfigVersion(propertyId, version) {
    const r = await db().send(new GetCommand({ TableName: TABLES.core, Key: { PK: `PROP#${propertyId}`, SK: configVersionKey(version) } }));
    return strip<ConfigVersion>(r.Item as Item | undefined);
  },
  async listConfigVersions(propertyId, limit) {
    if (limit < 1) return [];
    const items = await query(
      {
        TableName: TABLES.core,
        KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
        ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":s": "CFGVER#" },
        ScanIndexForward: false,
        Limit: limit,
      },
      limit,
    );
    return items.map((i) => strip<ConfigVersion>(i)!);
  },
  async getReceipt(propertyId, seq) {
    if (!Number.isInteger(seq) || seq < 1) return null;
    const r = await db().send(new GetCommand({ TableName: TABLES.receipts, Key: { PK: `PROP#${propertyId}`, SK: rcptKey(seq) } }));
    return strip<ConsentReceipt>(r.Item as Item | undefined);
  },

  /* ---------- tracker scans (core) ---------- */

  async saveScan(report) {
    const at = report.finishedAt || new Date().toISOString();
    await db().send(
      new PutCommand({
        TableName: TABLES.core,
        Item: { PK: `PROP#${report.propertyId}`, SK: `SCAN#${at}#${report.id}`, ...report, expiresAt: epochS(at) + SCAN_TTL_S },
      }),
    );
    // Keep the newest SCAN_KEEP; older reports also expire by TTL.
    const keys = await query({
      TableName: TABLES.core,
      KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
      ExpressionAttributeValues: { ":p": `PROP#${report.propertyId}`, ":s": "SCAN#" },
      ScanIndexForward: false,
      ProjectionExpression: "PK, SK",
    });
    if (keys.length > SCAN_KEEP) await batchDelete(TABLES.core, keysOf(keys.slice(SCAN_KEEP)));
  },
  async listScans(propertyId, limit) {
    if (limit < 1) return [];
    const items = await query(
      {
        TableName: TABLES.core,
        KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
        ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":s": "SCAN#" },
        ScanIndexForward: false,
        Limit: limit,
      },
      limit,
    );
    return items.map((i) => strip<ScanReport>(i)!);
  },
};
