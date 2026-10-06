import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_GENESIS, hashAudit } from "../audit-chain";
import { GENESIS_HASH, hashReceipt, id } from "../crypto";
import type {
  AuditEvent,
  ConsentReceipt,
  Invite,
  LeakReport,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  SessionRecord,
  User,
  WebhookDelivery,
} from "../types";
import type { AuditDraft, ReceiptDraft, Store } from "./types";

/**
 * Single-table layout (see infra/README.md):
 *
 *   PK              SK                      GSI1PK            GSI1SK
 *   USER#<id>       PROFILE                 EMAIL#<email>     USER
 *   ORG#<id>        PROFILE
 *   ORG#<id>        MEMBER#<userId>         USER#<userId>     ORG#<id>
 *   ORG#<id>        INVITE#<id>             EMAIL#<email>     INVITE#<id>
 *   ORG#<id>        PROP#<id>               PROP#<id>         PROFILE
 *   PROP#<id>       PROFILE (pointer)       SITEKEY#<key>     PROP
 *   PROP#<id>       CHAIN#HEAD
 *   PROP#<id>       RCPT#<seq, 12 digits>
 *   PROP#<id>       DAY#<yyyy-mm-dd>
 */
const TABLE = process.env.DYNAMO_TABLE ?? "plain-theory";
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "ap-south-1" }), {
  marshallOptions: { removeUndefinedValues: true },
});

const KEY_ATTRS = new Set(["PK", "SK", "GSI1PK", "GSI1SK", "type"]);

/** Drop the table's key attributes, leaving the domain object. */
const strip = <T>(item: Record<string, unknown> | undefined): T | null =>
  item ? (Object.fromEntries(Object.entries(item).filter(([k]) => !KEY_ATTRS.has(k))) as T) : null;
const seqKey = (n: number) => `RCPT#${String(n).padStart(12, "0")}`;
const auditKey = (n: number) => `AUDIT#${String(n).padStart(12, "0")}`;
const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const fromSessionItem = (item: Record<string, unknown>): SessionRecord => {
  const rec = strip<Record<string, unknown>>(item)!;
  const { sessionEndsAt, ...rest } = rec;
  return { ...(rest as unknown as SessionRecord), expiresAt: String(sessionEndsAt) };
};

async function queryAll(params: ConstructorParameters<typeof QueryCommand>[0]) {
  const out: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const r = await doc.send(new QueryCommand({ ...params, ExclusiveStartKey }));
    out.push(...((r.Items as Record<string, unknown>[]) ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function propertyPointer(pid: string) {
  const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `PROP#${pid}`, SK: "PROFILE" } }));
  return r.Item as { orgId: string } | undefined;
}

export const dynamoStore: Store = {
  async createUser(u) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `USER#${u.id}`, SK: "PROFILE", GSI1PK: `EMAIL#${u.email.toLowerCase()}`, GSI1SK: "USER", ...u },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return u;
  },
  async getUser(uid) {
    const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${uid}`, SK: "PROFILE" } }));
    return strip<User>(r.Item);
  },
  async getUserByEmail(email) {
    const r = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :e AND GSI1SK = :s",
        ExpressionAttributeValues: { ":e": `EMAIL#${email.toLowerCase()}`, ":s": "USER" },
      }),
    );
    return strip<User>(r.Items?.[0]);
  },

  async updateUser(uid, patch) {
    const current = await this.getUser(uid);
    if (!current) throw new Error("User not found");
    const next = { ...current, ...patch, id: uid } as User;
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (next as unknown as Record<string, unknown>)[k];
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `USER#${uid}`, SK: "PROFILE", GSI1PK: `EMAIL#${next.email.toLowerCase()}`, GSI1SK: "USER", ...next },
      }),
    );
    return next;
  },

  // Sessions: PK SESSION#id, listed per user via GSI1 (USERSESS#userId), expired by TTL 30 days after the absolute end.
  async createSessionRecord(rec) {
    // The table's TTL attribute is the numeric `expiresAt`; the record's ISO end time travels as `sessionEndsAt`.
    const { expiresAt, ...rest } = rec;
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `SESSION#${rec.id}`, SK: "SESSION", GSI1PK: `USERSESS#${rec.userId}`, GSI1SK: rec.createdAt, type: "session", ...rest, sessionEndsAt: expiresAt, expiresAt: epoch(expiresAt) + 30 * 86400 },
      }),
    );
    return rec;
  },
  async getSessionRecord(sid) {
    const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `SESSION#${sid}`, SK: "SESSION" }, ConsistentRead: true }));
    return r.Item ? fromSessionItem(r.Item) : null;
  },
  async touchSession(sid, lastSeenAt) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `SESSION#${sid}`, SK: "SESSION" },
        UpdateExpression: "SET lastSeenAt = :t",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":t": lastSeenAt },
      }),
    ).catch(() => undefined);
  },
  async revokeSession(sid, at) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `SESSION#${sid}`, SK: "SESSION" },
        UpdateExpression: "SET revokedAt = if_not_exists(revokedAt, :t)",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":t": at },
      }),
    ).catch(() => undefined);
  },
  async revokeUserSessions(userId, at, exceptId) {
    const sessions = await this.listUserSessions(userId);
    const targets = sessions.filter((x) => x.id !== exceptId && !x.revokedAt);
    await Promise.all(targets.map((x) => this.revokeSession(x.id, at)));
    return targets.length;
  },
  async listUserSessions(userId) {
    const items = await queryAll({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :u",
      ExpressionAttributeValues: { ":u": `USERSESS#${userId}` },
      ScanIndexForward: false,
    });
    return items.map(fromSessionItem);
  },

  // Audit trail: PK ORG#id, SK AUDIT#<seq>, head at AUDIT#HEAD, same optimistic chain append as receipts.
  async appendAudit(draft: AuditDraft) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const headRes = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `ORG#${draft.orgId}`, SK: "AUDIT#HEAD" }, ConsistentRead: true }));
      const head = (headRes.Item as { seq: number; hash: string } | undefined) ?? { seq: 0, hash: AUDIT_GENESIS };
      const unsigned = { ...draft, createdAt: draft.createdAt ?? new Date().toISOString(), id: id("aud"), seq: head.seq + 1, prevHash: head.hash };
      const event: AuditEvent = { ...unsigned, hash: hashAudit(unsigned) };
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              { Put: { TableName: TABLE, Item: { PK: `ORG#${draft.orgId}`, SK: auditKey(event.seq), type: "audit", ...event }, ConditionExpression: "attribute_not_exists(PK)" } },
              {
                Put: {
                  TableName: TABLE,
                  Item: { PK: `ORG#${draft.orgId}`, SK: "AUDIT#HEAD", seq: event.seq, hash: event.hash },
                  ConditionExpression: head.seq === 0 ? "attribute_not_exists(PK)" : "seq = :s",
                  ExpressionAttributeValues: head.seq === 0 ? undefined : { ":s": head.seq },
                },
              },
            ],
          }),
        );
        return event;
      } catch (e) {
        if (e instanceof TransactionCanceledException) continue;
        throw e;
      }
    }
    throw new Error("Could not append audit event: chain head contention");
  },
  async listAudit(orgId, q = {}) {
    const upper = q.before ? auditKey(q.before - 1) : "AUDIT#999999999999";
    const input = {
      TableName: TABLE,
      KeyConditionExpression: "PK = :o AND SK BETWEEN :lo AND :hi",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":lo": "AUDIT#000000000000", ":hi": upper },
      ScanIndexForward: false,
    };
    // Unfiltered pages read just one page; filters are applied after the read, so they scan the range.
    const items =
      q.limit && !q.action && !q.actorUserId ? ((await doc.send(new QueryCommand({ ...input, Limit: q.limit }))).Items ?? []) : await queryAll(input);
    let rows = items.map((i) => strip<AuditEvent>(i)!);
    if (q.action) rows = rows.filter((e) => e.action === q.action || e.action.startsWith(`${q.action}.`));
    if (q.actorUserId) rows = rows.filter((e) => e.actorUserId === q.actorUserId);
    return q.limit ? rows.slice(0, q.limit) : rows;
  },

  async createOrg(o, owner) {
    const m: Membership = { orgId: o.id, userId: owner, role: "owner", createdAt: o.createdAt };
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: { PK: `ORG#${o.id}`, SK: "PROFILE", ...o } } },
          {
            Put: {
              TableName: TABLE,
              Item: { PK: `ORG#${o.id}`, SK: `MEMBER#${owner}`, GSI1PK: `USER#${owner}`, GSI1SK: `ORG#${o.id}`, ...m },
            },
          },
        ],
      }),
    );
    return o;
  },
  async listOrgs() {
    // A scan, but only from the daily retention job; organization profiles are a tiny share of items.
    const out: Organization[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await doc.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "SK = :p AND begins_with(PK, :o)",
          ExpressionAttributeValues: { ":p": "PROFILE", ":o": "ORG#" },
          ExclusiveStartKey,
        }),
      );
      for (const i of r.Items ?? []) out.push(strip<Organization>(i)!);
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return out;
  },
  async getOrg(oid) {
    const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `ORG#${oid}`, SK: "PROFILE" } }));
    return strip<Organization>(r.Item);
  },
  async updateOrg(oid, patch) {
    const current = await this.getOrg(oid);
    if (!current) throw new Error("Organization not found");
    const next = { ...current, ...patch, id: oid };
    await doc.send(new PutCommand({ TableName: TABLE, Item: { PK: `ORG#${oid}`, SK: "PROFILE", ...next } }));
    return next;
  },
  async listMemberships(userId) {
    const items = await queryAll({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :u AND begins_with(GSI1SK, :o)",
      ExpressionAttributeValues: { ":u": `USER#${userId}`, ":o": "ORG#" },
    });
    return items.map((i) => strip<Membership>(i)!);
  },
  async getMembership(orgId, userId) {
    const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` } }));
    return strip<Membership>(r.Item);
  },
  async listMembers(orgId) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :m)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":m": "MEMBER#" },
    });
    const members = items.map((i) => strip<Membership>(i)!);
    return Promise.all(members.map(async (m) => ({ ...m, user: await this.getUser(m.userId) })));
  },
  async setRole(orgId, userId, role) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` },
        UpdateExpression: "SET #r = :r",
        ExpressionAttributeNames: { "#r": "role" },
        ExpressionAttributeValues: { ":r": role },
        ConditionExpression: "attribute_exists(PK)",
      }),
    );
  },
  async addMember(m) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `ORG#${m.orgId}`, SK: `MEMBER#${m.userId}`, GSI1PK: `USER#${m.userId}`, GSI1SK: `ORG#${m.orgId}`, ...m },
      }),
    );
  },
  async removeMember(orgId, userId) {
    await doc.send(new DeleteCommand({ TableName: TABLE, Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${userId}` } }));
  },
  async createInvite(i) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `ORG#${i.orgId}`, SK: `INVITE#${i.id}`, GSI1PK: `EMAIL#${i.email.toLowerCase()}`, GSI1SK: `INVITE#${i.id}`, ...i },
      }),
    );
    return i;
  },
  async listInvites(orgId) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :i)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":i": "INVITE#" },
    });
    return items.map((i) => strip<Invite>(i)!);
  },
  async invitesForEmail(email) {
    const items = await queryAll({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :e AND begins_with(GSI1SK, :i)",
      ExpressionAttributeValues: { ":e": `EMAIL#${email.toLowerCase()}`, ":i": "INVITE#" },
    });
    return items.map((i) => strip<Invite>(i)!);
  },
  async deleteInvite(orgId, inviteId) {
    await doc.send(new DeleteCommand({ TableName: TABLE, Key: { PK: `ORG#${orgId}`, SK: `INVITE#${inviteId}` } }));
  },

  async createProperty(p) {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: { PK: `ORG#${p.orgId}`, SK: `PROP#${p.id}`, GSI1PK: `PROP#${p.id}`, GSI1SK: "PROFILE", ...p } } },
          {
            Put: {
              TableName: TABLE,
              Item: { PK: `PROP#${p.id}`, SK: "PROFILE", GSI1PK: `SITEKEY#${p.siteKey}`, GSI1SK: "PROP", orgId: p.orgId },
            },
          },
        ],
      }),
    );
    return p;
  },
  async getProperty(pid) {
    const ptr = await propertyPointer(pid);
    if (!ptr) return null;
    const r = await doc.send(new GetCommand({ TableName: TABLE, Key: { PK: `ORG#${ptr.orgId}`, SK: `PROP#${pid}` } }));
    return strip<Property>(r.Item);
  },
  async getPropertyBySiteKey(siteKey) {
    const r = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :k AND GSI1SK = :p",
        ExpressionAttributeValues: { ":k": `SITEKEY#${siteKey}`, ":p": "PROP" },
      }),
    );
    const pk = r.Items?.[0]?.PK as string | undefined;
    return pk ? this.getProperty(pk.slice(5)) : null;
  },
  async listProperties(orgId) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :o AND begins_with(SK, :p)",
      ExpressionAttributeValues: { ":o": `ORG#${orgId}`, ":p": "PROP#" },
    });
    return items.map((i) => strip<Property>(i)!);
  },
  async updateProperty(pid, patch) {
    const current = await this.getProperty(pid);
    if (!current) throw new Error("Property not found");
    const next: Property = { ...current, ...patch, id: pid, orgId: current.orgId, updatedAt: new Date().toISOString() };
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `ORG#${next.orgId}`, SK: `PROP#${pid}`, GSI1PK: `PROP#${pid}`, GSI1SK: "PROFILE", ...next },
      }),
    );
    return next;
  },
  async deleteProperty(pid) {
    const ptr = await propertyPointer(pid);
    if (!ptr) return;
    // Receipts are retained (legal hold) and expire via the table's TTL attribute; only the config is removed.
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: TABLE, Key: { PK: `ORG#${ptr.orgId}`, SK: `PROP#${pid}` } } },
          { Delete: { TableName: TABLE, Key: { PK: `PROP#${pid}`, SK: "PROFILE" } } },
        ],
      }),
    );
  },

  async appendReceipt(draft: ReceiptDraft) {
    // Optimistic concurrency on the chain head: retry if another writer advanced it first.
    for (let attempt = 0; attempt < 8; attempt++) {
      const headRes = await doc.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `PROP#${draft.propertyId}`, SK: "CHAIN#HEAD" }, ConsistentRead: true }),
      );
      const head = (headRes.Item as { seq: number; hash: string } | undefined) ?? { seq: 0, hash: GENESIS_HASH };
      const unsigned = { ...draft, id: id("rcpt"), seq: head.seq + 1, prevHash: head.hash };
      const receipt: ConsentReceipt = { ...unsigned, hash: hashReceipt(unsigned) };
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: TABLE,
                  Item: { PK: `PROP#${draft.propertyId}`, SK: seqKey(receipt.seq), type: "receipt", ...receipt },
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              },
              {
                Put: {
                  TableName: TABLE,
                  Item: { PK: `PROP#${draft.propertyId}`, SK: "CHAIN#HEAD", seq: receipt.seq, hash: receipt.hash },
                  ConditionExpression: head.seq === 0 ? "attribute_not_exists(PK)" : "seq = :s",
                  ExpressionAttributeValues: head.seq === 0 ? undefined : { ":s": head.seq },
                },
              },
            ],
          }),
        );
        return receipt;
      } catch (e) {
        if (e instanceof TransactionCanceledException) continue;
        throw e;
      }
    }
    throw new Error("Could not append receipt: chain head contention");
  },
  async deleteReceiptsThrough(propertyId, seq) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :lo AND :hi",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":lo": seqKey(1), ":hi": seqKey(seq) },
      ProjectionExpression: "PK, SK",
    });
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await doc.send(new TransactWriteCommand({ TransactItems: batch.map((it) => ({ Delete: { TableName: TABLE, Key: { PK: it.PK, SK: it.SK } } })) }));
    }
    return items.length;
  },
  async listReceipts(propertyId, q = {}) {
    const upper = q.before ? seqKey(q.before - 1) : "RCPT#~";
    const rows: ConsentReceipt[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await doc.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :p AND SK BETWEEN :lo AND :hi",
          ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":lo": "RCPT#", ":hi": upper },
          ScanIndexForward: false,
          ExclusiveStartKey,
        }),
      );
      for (const item of r.Items ?? []) {
        const rec = strip<ConsentReceipt>(item)!;
        if (q.to && rec.timestamp > q.to) continue;
        if (q.from && rec.timestamp < q.from) return rows;
        rows.push(rec);
        if (q.limit && rows.length >= q.limit) return rows;
      }
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return rows;
  },

  async recordLeak(l) {
    const ttl = Math.floor(Date.now() / 1000) + 90 * 86400; // leak signals expire after 90 days
    await doc.send(new PutCommand({ TableName: TABLE, Item: { PK: `PROP#${l.propertyId}`, SK: `LEAK#${l.createdAt}#${l.id}`, type: "leak", expiresAt: ttl, ...l } }));
  },
  async listLeaks(propertyId, sinceIso) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": `LEAK#${sinceIso}`, ":b": "LEAK#~" },
      ScanIndexForward: false,
    });
    return items.map((i) => strip<LeakReport>(i)!);
  },
  async pruneLeaks(propertyId, beforeIso) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": "LEAK#", ":b": `LEAK#${beforeIso}` },
      ProjectionExpression: "PK, SK",
    });
    await Promise.all(items.map((it) => doc.send(new DeleteCommand({ TableName: TABLE, Key: { PK: it.PK, SK: it.SK } }))));
    return items.length;
  },
  async recordWebhookDelivery(d) {
    const ttl = Math.floor(Date.now() / 1000) + 30 * 86400;
    await doc.send(new PutCommand({ TableName: TABLE, Item: { PK: `PROP#${d.propertyId}`, SK: `HOOK#${d.createdAt}#${d.id}`, type: "delivery", expiresAt: ttl, ...d } }));
  },
  async listWebhookDeliveries(propertyId, limit) {
    const r = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p AND begins_with(SK, :h)",
        ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":h": "HOOK#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => strip<WebhookDelivery>(i)!);
  },

  async pruneWebhookDeliveries(propertyId, beforeIso) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": "HOOK#", ":b": `HOOK#${beforeIso}` },
      ProjectionExpression: "PK, SK",
    });
    await Promise.all(items.map((it) => doc.send(new DeleteCommand({ TableName: TABLE, Key: { PK: it.PK, SK: it.SK } }))));
    return items.length;
  },

  async createLead(l) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: `LEAD#${l.createdAt.slice(0, 7)}`, SK: `${l.createdAt}#${l.id}`, GSI1PK: `LEADIP#${l.ipHash}`, GSI1SK: l.createdAt, type: "lead", ...l },
      }),
    );
    return l;
  },
  async countRecentLeads(ipHash, sinceIso) {
    const r = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :k AND GSI1SK >= :s",
        ExpressionAttributeValues: { ":k": `LEADIP#${ipHash}`, ":s": sinceIso },
        Select: "COUNT",
      }),
    );
    return r.Count ?? 0;
  },

  async recordPageview(propertyId, day, kind) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `PROP#${propertyId}`, SK: `DAY#${day}` },
        UpdateExpression: "ADD #f :one SET propertyId = :p, #d = :d",
        ExpressionAttributeNames: { "#f": kind === "view" ? "views" : "bounces", "#d": "day" },
        ExpressionAttributeValues: { ":one": 1, ":p": propertyId, ":d": day },
      }),
    );
  },
  async listCounters(propertyId, fromDay, toDay) {
    const items = await queryAll({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":p": `PROP#${propertyId}`, ":a": `DAY#${fromDay}`, ":b": `DAY#${toDay}` },
    });
    return items.map((i) => {
      const c = strip<PageviewCounter>(i)!;
      return { ...c, views: c.views ?? 0, bounces: c.bounces ?? 0 };
    });
  },
};
