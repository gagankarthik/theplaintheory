/**
 * Integration test against the REAL DynamoDB tables (docs/architecture/platform-architecture.md §6).
 *
 *   RUN_DYNAMO_INTEGRATION=1 STORE_DRIVER=dynamodb npx vitest run tests/integration
 *
 * Skipped unless RUN_DYNAMO_INTEGRATION=1, so `npx vitest run` stays offline. Store calls run through
 * src/lib/aws.ts, i.e. with the app's own credentials (PT_AWS_* from .env.local when present, so the
 * production IAM policy is exercised). Every id carries a unique prefix, and everything written is
 * deleted afterwards with a separate admin client (AWS_* keys), audit items included.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Store } from "@/lib/store/types";
import type { ConsentReceipt, Organization, Property, User } from "@/lib/types";

const RUN = process.env.RUN_DYNAMO_INTEGRATION === "1";

/** .env.local values that aren't already set (never printed). */
function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return {} as Record<string, string>;
  }
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const P = `itest${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TABLE_IDS = ["core", "receipts", "telemetry", "audit", "leads", "ephemeral"] as const;

describe.skipIf(!RUN)("DynamoDB store against the real tables", () => {
  let store: Store;
  let admin: DynamoDBDocumentClient;
  let tables: Record<(typeof TABLE_IDS)[number], string>;
  let platformHeadBefore: Record<string, unknown> | undefined;

  const now = new Date();
  const iso = (offsetMs = 0) => new Date(now.getTime() + offsetMs).toISOString();
  const user = (n: number): User => ({ id: `${P}_usr${n}`, email: `${P}.user${n}@example.com`, name: `Test User ${n}`, createdAt: iso(n) });
  const org: Organization = { id: `${P}_org`, name: "Integration Org", plan: "free", dataRegion: "ap-south-1", kind: "organization", createdAt: iso() };
  let property: Property;

  beforeAll(async () => {
    const env = loadEnvLocal();
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
    process.env.STORE_DRIVER = "dynamodb";

    const aws = await import("@/lib/aws");
    tables = aws.TABLES;
    // Cleanup runs as the admin user, explicitly, because the app policy can't delete audit items or scan.
    const adminCreds = env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } : undefined;
    admin = DynamoDBDocumentClient.from(new DynamoDBClient({ region: aws.awsRegion, credentials: adminCreds }));
    platformHeadBefore = (await admin.send(new GetCommand({ TableName: tables.core, Key: { PK: "PLATFORM", SK: "AUDIT#HEAD" } }))).Item;

    store = (await import("@/lib/store/dynamo")).dynamoStore;
    const { defaultConfig } = await import("@/lib/defaults");
    property = {
      id: `${P}_prop`,
      orgId: org.id,
      name: "Integration site",
      domain: `${P}.example.com`,
      siteKey: `${P}_sk`,
      config: defaultConfig(`${P}.example.com`),
      trackers: [],
      publishedVersion: 0,
      createdAt: iso(),
      updatedAt: iso(),
    };
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    let removed = 0;
    for (const t of TABLE_IDS) {
      const table = tables[t];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      const keys: { PK: string; SK: string }[] = [];
      do {
        const r = await admin.send(
          new ScanCommand({
            TableName: table,
            FilterExpression: "contains(PK, :p) OR contains(SK, :p) OR contains(GSI1PK, :p) OR contains(GSI2PK, :p) OR contains(actorUserId, :p) OR contains(orgId, :p)",
            ExpressionAttributeValues: { ":p": P },
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey,
          }),
        );
        keys.push(...((r.Items as { PK: string; SK: string }[]) ?? []));
        ExclusiveStartKey = r.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      for (const Key of keys) await admin.send(new DeleteCommand({ TableName: table, Key }));
      removed += keys.length;
    }
    // The platform trail's head is shared: put back what was there before, or remove the one we created.
    if (platformHeadBefore) await admin.send(new PutCommand({ TableName: tables.core, Item: platformHeadBefore }));
    else await admin.send(new DeleteCommand({ TableName: tables.core, Key: { PK: "PLATFORM", SK: "AUDIT#HEAD" } }));
    console.log(`[integration] removed ${removed} test items (prefix ${P})`);
  }, 120_000);

  it("users: create, get by id and email, update, lockout state in ephemeral, listUsers via GSI2", async () => {
    await store.createUser(user(1));
    await store.createUser(user(2));
    await expect(store.createUser(user(1))).rejects.toThrow();
    expect((await store.getUser(user(1).id))?.email).toBe(user(1).email);
    expect((await store.getUserByEmail(user(1).email.toUpperCase()))?.id).toBe(user(1).id);
    expect(await store.getUser(`${P}_nobody`)).toBeNull();

    const updated = await store.updateUser(user(1).id, { name: "Renamed", lastActiveAt: iso() });
    expect(updated.name).toBe("Renamed");
    await expect(store.updateUser(`${P}_nobody`, { name: "x" })).rejects.toThrow("User not found");

    const lockedUntil = iso(15 * 60_000);
    const locked = await store.updateUser(user(1).id, { loginFailures: undefined, lockedUntil });
    expect(locked.lockedUntil).toBe(lockedUntil);
    expect(locked.name).toBe("Renamed");
    expect((await store.getUser(user(1).id))?.lockedUntil).toBe(lockedUntil);
    const lockItem = (await admin.send(new GetCommand({ TableName: tables.ephemeral, Key: { PK: `LOCK#${user(1).id}`, SK: "LOCK" } }))).Item;
    expect(typeof lockItem?.expiresAt).toBe("number");
    const coreItem = (await admin.send(new GetCommand({ TableName: tables.core, Key: { PK: `USER#${user(1).id}`, SK: "PROFILE" } }))).Item;
    expect(coreItem?.lockedUntil).toBeUndefined();
    await store.updateUser(user(1).id, { loginFailures: { count: 2, windowStart: iso() }, lockedUntil: undefined });
    const u1 = await store.getUser(user(1).id);
    expect(u1?.lockedUntil).toBeUndefined();
    expect(u1?.loginFailures?.count).toBe(2);

    const all = await store.listUsers();
    const mine = all.filter((u) => u.id.startsWith(P));
    expect(mine.map((u) => u.id)).toEqual([user(2).id, user(1).id]); // newest first
    expect(mine.find((u) => u.id === user(1).id)?.loginFailures?.count).toBe(2);
  }, 60_000);

  it("orgs, memberships, invites; listOrgs via GSI2", async () => {
    await store.createOrg(org, user(1).id);
    expect((await store.getOrg(org.id))?.name).toBe(org.name);
    expect((await store.getMembership(org.id, user(1).id))?.role).toBe("owner");

    const suspended = await store.updateOrg(org.id, { suspendedAt: iso(), suspendedReason: "test" });
    expect(suspended.suspendedAt).toBeDefined();
    const lifted = await store.updateOrg(org.id, { suspendedAt: undefined, suspendedReason: undefined, plan: "growth" });
    expect(lifted.suspendedAt).toBeUndefined();
    expect(lifted.plan).toBe("growth");
    await expect(store.updateOrg(`${P}_noorg`, { plan: "free" })).rejects.toThrow("Organization not found");

    await store.addMember({ orgId: org.id, userId: user(2).id, role: "viewer", createdAt: iso() });
    await store.addMember({ orgId: org.id, userId: user(2).id, role: "admin", createdAt: iso() }); // no-op: already a member
    expect((await store.getMembership(org.id, user(2).id))?.role).toBe("viewer");
    await store.setRole(org.id, user(2).id, "editor");
    expect((await store.getMembership(org.id, user(2).id))?.role).toBe("editor");
    const members = await store.listMembers(org.id);
    expect(members.map((m) => m.userId).sort()).toEqual([user(1).id, user(2).id].sort());
    expect(members.every((m) => m.user?.email)).toBe(true);
    expect((await store.listMemberships(user(2).id)).map((m) => m.orgId)).toEqual([org.id]);
    await store.removeMember(org.id, user(2).id);
    expect(await store.getMembership(org.id, user(2).id)).toBeNull();

    const invite = { id: `${P}_inv`, orgId: org.id, email: `${P}.Invitee@example.com`, role: "viewer" as const, createdAt: iso() };
    await store.createInvite(invite);
    expect((await store.listInvites(org.id)).map((i) => i.id)).toEqual([invite.id]);
    expect((await store.invitesForEmail(invite.email.toLowerCase())).map((i) => i.id)).toEqual([invite.id]);
    await store.deleteInvite(org.id, invite.id);
    expect(await store.listInvites(org.id)).toEqual([]);

    const orgs = await store.listOrgs();
    expect(orgs.some((o) => o.id === org.id && o.plan === "growth")).toBe(true);
  }, 60_000);

  it("sites: create, get by id and site key, list, update", async () => {
    await store.createProperty(property);
    expect((await store.getProperty(property.id))?.domain).toBe(property.domain);
    expect((await store.getPropertyBySiteKey(property.siteKey))?.id).toBe(property.id);
    expect((await store.listProperties(org.id)).map((p) => p.id)).toEqual([property.id]);
    const next = await store.updateProperty(property.id, { publishedVersion: 1, publishedAt: iso() });
    expect(next.publishedVersion).toBe(1);
    expect(next.orgId).toBe(org.id);
    expect(next.config.version).toBe(property.config.version);
    await expect(store.updateProperty(`${P}_noprop`, { name: "x" })).rejects.toThrow("Property not found");
  }, 60_000);

  it("receipts: concurrent appends form one chain; list, page, delete through", async () => {
    const { verifyChain } = await import("@/lib/crypto");
    const draft = (i: number) => ({
      propertyId: property.id,
      visitorId: `${P}_v${i % 2}`,
      action: "accept_all" as const,
      framework: "gdpr" as const,
      categories: { essential: true, functional: true, analytics: i % 2 === 0, marketing: false },
      country: "IN",
      device: "desktop" as const,
      browser: "Chrome",
      ipHash: "iphash",
      configVersion: 1,
      timestamp: iso(i),
    });
    const first = await store.appendReceipt(draft(0));
    expect(first.seq).toBe(1);
    // Six writers racing for the same chain head must never fork it.
    const raced = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => store.appendReceipt(draft(i))));
    expect(raced.map((r) => r.seq).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7]);

    const all = await store.listReceipts(property.id);
    expect(all.map((r) => r.seq)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(verifyChain(all).ok).toBe(true);
    expect(all[0]).not.toHaveProperty("PK");
    expect((await store.listReceipts(property.id, { limit: 2, before: 5 })).map((r) => r.seq)).toEqual([4, 3]);

    const removed = await store.deleteReceiptsThrough(property.id, 3);
    expect(removed).toBe(3);
    const rest = await store.listReceipts(property.id);
    expect(rest.map((r: ConsentReceipt) => r.seq)).toEqual([7, 6, 5, 4]);
    const checkpoint = all.find((r) => r.seq === 3)!;
    expect(verifyChain(rest, { seq: 3, hash: checkpoint.hash }).ok).toBe(true);
    // The chain continues from the head after retention.
    expect((await store.appendReceipt(draft(8))).seq).toBe(8);
  }, 60_000);

  it("telemetry: atomic pageview counters, leaks, webhook deliveries", async () => {
    const day = iso().slice(0, 10);
    await Promise.all([
      store.recordPageview(property.id, day, "view"),
      store.recordPageview(property.id, day, "view"),
      store.recordPageview(property.id, day, "view"),
      store.recordPageview(property.id, day, "bounce"),
    ]);
    const counters = await store.listCounters(property.id, day, day);
    expect(counters).toEqual([{ propertyId: property.id, day, views: 3, bounces: 1 }]);

    const leak = (n: number, at: string) => ({ id: `${P}_leak${n}`, propertyId: property.id, url: "tracker.example/x", category: "marketing" as const, page: "/", framework: "gdpr" as const, country: "IN", createdAt: at });
    await store.recordLeak(leak(1, iso(-100 * 86_400_000)));
    await store.recordLeak(leak(2, iso()));
    expect((await store.listLeaks(property.id, iso(-86_400_000))).map((l) => l.id)).toEqual([`${P}_leak2`]);
    expect(await store.pruneLeaks(property.id, iso(-90 * 86_400_000))).toBe(1);
    expect((await store.listLeaks(property.id, iso(-365 * 86_400_000))).map((l) => l.id)).toEqual([`${P}_leak2`]);

    const delivery = (n: number, at: string) => ({ id: `${P}_dlv${n}`, propertyId: property.id, webhookId: "wh", event: "consent.created" as const, status: "delivered" as const, attempt: 1, durationMs: 10, createdAt: at });
    await store.recordWebhookDelivery(delivery(1, iso(-40 * 86_400_000)));
    await store.recordWebhookDelivery(delivery(2, iso(-1000)));
    await store.recordWebhookDelivery(delivery(3, iso()));
    expect((await store.listWebhookDeliveries(property.id, 2)).map((d) => d.id)).toEqual([`${P}_dlv3`, `${P}_dlv2`]);
    expect(await store.pruneWebhookDeliveries(property.id, iso(-30 * 86_400_000))).toBe(1);
    expect((await store.listWebhookDeliveries(property.id, 10)).length).toBe(2);
  }, 60_000);

  it("org audit: append-only chain, filters, actor index", async () => {
    const { verifyAuditChain } = await import("@/lib/audit-chain");
    const base = { orgId: org.id, actorEmail: user(1).email, target: { type: "org", id: org.id }, ipHash: "h", userAgent: "vitest" };
    const events = [];
    events.push(await store.appendAudit({ ...base, actorUserId: user(1).id, action: "org.created" }));
    events.push(...(await Promise.all([
      store.appendAudit({ ...base, actorUserId: user(1).id, action: "member.invited" }),
      store.appendAudit({ ...base, actorUserId: user(2).id, action: "member.role_changed" }),
      store.appendAudit({ ...base, actorUserId: null, actorEmail: "system", action: "billing.plan_changed" }),
    ])));
    const all = await store.listAudit(org.id);
    expect(all.map((e) => e.seq)).toEqual([4, 3, 2, 1]);
    expect(verifyAuditChain(all).ok).toBe(true);
    expect((await store.listAudit(org.id, { limit: 2 })).map((e) => e.seq)).toEqual([4, 3]);
    expect((await store.listAudit(org.id, { before: 3 })).map((e) => e.seq)).toEqual([2, 1]);
    expect((await store.listAudit(org.id, { action: "member" })).length).toBe(2);
    expect((await store.listAudit(org.id, { actorUserId: user(1).id })).map((e) => e.action).sort()).toEqual(["member.invited", "org.created"]);
    expect((await store.listAudit(org.id, { actorUserId: user(1).id, limit: 1 })).length).toBe(1);
    // The app's credentials can't rewrite history (IAM denies UpdateItem/DeleteItem on the audit table).
    const { dynamo } = await import("@/lib/aws");
    const key = { PK: `ORG#${org.id}`, SK: `TS#${events[0].createdAt}#${events[0].id}` };
    await expect(dynamo().send(new DeleteCommand({ TableName: tables.audit, Key: key }))).rejects.toThrow();
  }, 60_000);

  it("platform audit: month-partitioned chain, filters", async () => {
    const { verifyPlatformAuditChain } = await import("@/lib/platform/audit-chain");
    const draft = (target: string, action: "org.suspended" | "org.unsuspended" | "user.unlocked") => ({
      actorUserId: `${P}_staff`,
      actorEmail: `${P}.staff@example.com`,
      actorRole: "superadmin",
      action,
      target: { type: (action === "user.unlocked" ? "user" : "org") as "org" | "user", id: target },
      ipHash: "h",
      userAgent: "vitest",
    });
    const a = await store.appendPlatformAudit(draft(org.id, "org.suspended"));
    const b = await store.appendPlatformAudit(draft(org.id, "org.unsuspended"));
    const c = await store.appendPlatformAudit(draft(user(1).id, "user.unlocked"));
    expect([b.seq - a.seq, c.seq - b.seq]).toEqual([1, 1]);
    expect(b.prevHash).toBe(a.hash);

    const listed = (await store.listPlatformAudit({ limit: 3 })).filter((e) => e.actorUserId === `${P}_staff`);
    expect(listed.map((e) => e.seq)).toEqual([c.seq, b.seq, a.seq]);
    if (!platformHeadBefore) expect(verifyPlatformAuditChain(await store.listPlatformAudit()).ok).toBe(true);
    expect((await store.listPlatformAudit({ action: "org" })).filter((e) => e.actorUserId === `${P}_staff`).length).toBe(2);
    expect((await store.listPlatformAudit({ targetId: user(1).id })).map((e) => e.id)).toEqual([c.id]);
    expect((await store.listPlatformAudit({ before: c.seq, limit: 1 })).map((e) => e.id)).toEqual([b.id]);
  }, 60_000);

  it("leads: create and count by network without a scan", async () => {
    const ipHash = `${P}_ip`;
    const lead = (n: number) => ({
      id: `${P}_lead${n}`,
      name: "Test Lead",
      email: `${P}.lead@example.com`,
      company: "Example",
      sites: "1" as const,
      pageviews: "<100k" as const,
      regions: ["in" as const],
      ipHash,
      createdAt: iso(n),
    });
    await store.createLead(lead(1));
    await store.createLead(lead(2));
    expect(await store.countRecentLeads(ipHash, iso(-60 * 60_000))).toBe(2);
    expect(await store.countRecentLeads(ipHash, iso(60_000))).toBe(0);
    expect(await store.countRecentLeads(`${P}_other`, iso(-60 * 60_000))).toBe(0);
    const stored = (await admin.send(new GetCommand({ TableName: tables.leads, Key: { PK: `LEAD#${P}_lead1`, SK: "PROFILE" } }))).Item;
    expect(stored?.GSI1PK).toBe("STATUS#new");
    expect(stored?.GSI2PK).toBe(`EMAIL#${P}.lead@example.com`);

    // Status changes move the lead between GSI1 partitions; the inbox reads them without a scan.
    await store.createLead({ ...lead(3), topic: "support", subject: "Banner missing", category: "banner", severity: "high", message: "The banner doesn't show." });
    const moved = await store.updateLeadStatus(`${P}_lead3`, "open");
    expect(moved?.status).toBe("open");
    const raw = (await admin.send(new GetCommand({ TableName: tables.leads, Key: { PK: `LEAD#${P}_lead3`, SK: "PROFILE" } }))).Item;
    expect(raw?.GSI1PK).toBe("STATUS#open");
    expect(raw?.GSI1SK).toBe(`${iso(3)}#${P}_lead3`);
    expect((await store.getLead(`${P}_lead3`))?.topic).toBe("support");
    expect(await store.updateLeadStatus(`${P}_missing`, "closed")).toBeNull();
    const open = await store.listLeads({ status: "open", topic: "support", limit: 500 });
    expect(open.some((l) => l.id === `${P}_lead3`)).toBe(true);
    const sales = await store.listLeads({ topic: "sales", limit: 500 });
    expect(sales.some((l) => l.id === `${P}_lead3`)).toBe(false);
  }, 60_000);

  it("sessions: create, touch, revoke, list, revoke all", async () => {
    const sess = (n: number) => ({
      id: `${P}_sess${n}`,
      userId: user(1).id,
      createdAt: iso(n),
      lastSeenAt: iso(n),
      expiresAt: iso(12 * 3600_000),
      ipHash: "h",
      userAgent: "vitest",
      mfaVerified: false,
    });
    await Promise.all([1, 2, 3].map((n) => store.createSessionRecord(sess(n))));
    expect(await store.getSessionRecord(sess(1).id)).toEqual(sess(1));
    await store.touchSession(sess(1).id, iso(10_000));
    await store.touchSession(`${P}_missing`, iso()); // no-op
    expect((await store.getSessionRecord(sess(1).id))?.lastSeenAt).toBe(iso(10_000));
    await store.revokeSession(sess(2).id, iso(5));
    await store.revokeSession(sess(2).id, iso(6)); // first revocation time wins
    expect((await store.getSessionRecord(sess(2).id))?.revokedAt).toBe(iso(5));
    expect((await store.listUserSessions(user(1).id)).map((s) => s.id)).toEqual([sess(1).id, sess(3).id, sess(2).id]);
    expect(await store.revokeUserSessions(user(1).id, iso(20), sess(3).id)).toBe(1);
    const after = await store.listUserSessions(user(1).id);
    expect(after.find((s) => s.id === sess(3).id)?.revokedAt).toBeUndefined();
    expect(after.filter((s) => s.revokedAt).length).toBe(2);
    expect(await store.getSessionRecord(`${P}_missing`)).toBeNull();
  }, 60_000);

  it("rate limits: shared atomic counters in the ephemeral table", async () => {
    const { createDynamoRateLimiter } = await import("@/lib/rate-limit-dynamo");
    const rl = createDynamoRateLimiter("itest", { limit: 3, windowMs: 60_000 });
    const t = Math.floor(Date.now() / 60_000) * 60_000 + 1; // start of a window: nothing carried over
    const results = await Promise.all([0, 1, 2, 3, 4].map(() => rl.consume(`${P}_net`, t)));
    expect(results.filter((r) => r.ok).length).toBe(3);
    expect(results.find((r) => !r.ok)?.retryAfterMs).toBeGreaterThan(0);
    expect((await rl.peek(`${P}_net`, t)).ok).toBe(false);
    expect((await rl.consume(`${P}_other`, t)).ok).toBe(true);
    // Early in the next window most of the previous window still counts (sliding estimate).
    expect((await rl.consume(`${P}_net`, t + 60_000 + 1000)).ok).toBe(true); // budget 3 - floor(3 * 59/60) = 1
    expect((await rl.consume(`${P}_net`, t + 60_000 + 1000)).ok).toBe(false);
    expect((await rl.consume(`${P}_net`, t + 2 * 60_000)).ok).toBe(true);
    await rl.reset(`${P}_net`);

    // The app's limiters and the sign-in network throttle use it when STORE_DRIVER=dynamodb.
    const { rateLimiter } = await import("@/lib/rate-limit");
    expect((await rateLimiter("contactSales").consume(`${P}_ip`)).ok).toBe(true);
    const { allowIpAttempt } = await import("@/lib/auth/lockout");
    expect(await allowIpAttempt(`${P}_ip`)).toBe(true);
    const items = await admin.send(
      new ScanCommand({ TableName: tables.ephemeral, FilterExpression: "begins_with(PK, :r)", ExpressionAttributeValues: { ":r": `RATE#signIn#${P}_ip#` } }),
    );
    expect(items.Items?.[0]?.hits).toBe(1);
  }, 60_000);

  it("Stripe webhook idempotency", async () => {
    const evt = `${P}_evt`;
    expect(await store.claimStripeEvent(evt)).toBe(true);
    expect(await store.claimStripeEvent(evt)).toBe(false);
    await store.releaseStripeEvent(evt);
    expect(await store.claimStripeEvent(evt)).toBe(true);
  }, 30_000);

  it("deleting a site removes it with its receipts and telemetry", async () => {
    await store.deleteProperty(property.id);
    expect(await store.getProperty(property.id)).toBeNull();
    expect(await store.getPropertyBySiteKey(property.siteKey)).toBeNull();
    expect(await store.listReceipts(property.id)).toEqual([]);
    expect(await store.listCounters(property.id, "2000-01-01", "2100-01-01")).toEqual([]);
  }, 60_000);
});
