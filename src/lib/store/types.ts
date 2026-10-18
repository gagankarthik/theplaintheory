import type {
  AuditEvent,
  ConfigVersion,
  ConsentReceipt,
  SessionRecord,
  Invite,
  Lead,
  LeadStatus,
  LeadTopic,
  LeakReport,
  WebhookDelivery,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  Role,
  User,
} from "../types";
import type { SiteAuditReport } from "../site-audit/types";
import type { ScanReport } from "../trackers";
import type { PlatformAuditDraft, PlatformAuditEvent, PlatformAuditQuery } from "../platform/types";
import type { RollupRange } from "../rollups";

export type ReceiptDraft = Omit<ConsentReceipt, "id" | "seq" | "prevHash" | "hash">;
export type AuditDraft = Omit<AuditEvent, "id" | "seq" | "prevHash" | "hash" | "createdAt"> & { createdAt?: string };

export interface AuditQuery {
  /** events with seq < before (newest-first pagination) */
  before?: number;
  limit?: number;
  action?: string;
  actorUserId?: string;
}

export interface ReceiptQuery {
  from?: string;
  to?: string;
  limit?: number;
  /** return receipts with seq < before (newest-first pagination) */
  before?: number;
}

export interface LeadQuery {
  status?: LeadStatus;
  topic?: LeadTopic;
  /** most leads returned (default 200) */
  limit?: number;
}

/** live site check reports kept per site */
export const SITE_AUDIT_KEEP = 10;

export interface Store {
  // users
  createUser(u: User): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;
  /** every user; for the staff console and scheduled jobs, never customer request paths */
  listUsers(): Promise<User[]>;

  // server-side sessions (SOC 2 CC6.1): the cookie holds only the id
  createSessionRecord(s: SessionRecord): Promise<SessionRecord>;
  getSessionRecord(id: string): Promise<SessionRecord | null>;
  touchSession(id: string, lastSeenAt: string): Promise<void>;
  revokeSession(id: string, at: string): Promise<void>;
  /** revoke every session for the user except `exceptId`; returns how many were revoked */
  revokeUserSessions(userId: string, at: string, exceptId?: string): Promise<number>;
  listUserSessions(userId: string): Promise<SessionRecord[]>;

  // administrative audit trail, hash-chained per organization
  appendAudit(draft: AuditDraft): Promise<AuditEvent>;
  /** newest first */
  listAudit(orgId: string, q?: AuditQuery): Promise<AuditEvent[]>;

  // platform audit trail: what Plain Theory staff did, one hash chain across the platform
  appendPlatformAudit(draft: PlatformAuditDraft): Promise<PlatformAuditEvent>;
  /** newest first */
  listPlatformAudit(q?: PlatformAuditQuery): Promise<PlatformAuditEvent[]>;

  // organizations & membership (RBAC)
  createOrg(o: Organization, owner: string): Promise<Organization>;
  getOrg(id: string): Promise<Organization | null>;
  /** several organizations in one round trip (missing ones are left out; order not guaranteed) */
  getOrgs(ids: string[]): Promise<Organization[]>;
  /** every organization; for scheduled jobs such as retention, never request paths */
  listOrgs(): Promise<Organization[]>;
  updateOrg(id: string, patch: Partial<Organization>): Promise<Organization>;
  listMemberships(userId: string): Promise<Membership[]>;
  getMembership(orgId: string, userId: string): Promise<Membership | null>;
  listMembers(orgId: string): Promise<(Membership & { user: User | null })[]>;
  setRole(orgId: string, userId: string, role: Role): Promise<void>;
  addMember(m: Membership): Promise<void>;
  removeMember(orgId: string, userId: string): Promise<void>;
  createInvite(i: Invite): Promise<Invite>;
  listInvites(orgId: string): Promise<Invite[]>;
  invitesForEmail(email: string): Promise<Invite[]>;
  deleteInvite(orgId: string, inviteId: string): Promise<void>;

  // properties
  createProperty(p: Property): Promise<Property>;
  getProperty(id: string): Promise<Property | null>;
  getPropertyBySiteKey(siteKey: string): Promise<Property | null>;
  listProperties(orgId: string): Promise<Property[]>;
  updateProperty(id: string, patch: Partial<Property>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  /**
   * Sites with a scan schedule due at or before `nowIso`, longest-overdue first, at most `limit`.
   * For the scheduled-scans cron only. DynamoDB reads a sparse index, never the whole table.
   */
  listDueScanProperties(nowIso: string, limit: number): Promise<Property[]>;

  // consent receipts: append-only, hash-chained per property
  /** also adds the decision to its day's rollup (lib/rollups.ts); a failed rollup write is logged, never fails the receipt */
  appendReceipt(draft: ReceiptDraft): Promise<ConsentReceipt>;
  /** daily decision rollups for the inclusive day range, and the first receipt seq they cover */
  listDecisionRollups(propertyId: string, fromDay: string, toDay: string): Promise<RollupRange>;
  listReceipts(propertyId: string, q?: ReceiptQuery): Promise<ConsentReceipt[]>;
  /** One visitor's receipts, newest first, through the visitor index (never a scan of the ledger). */
  listVisitorReceipts(propertyId: string, visitorId: string, q?: { limit?: number; before?: number }): Promise<ConsentReceipt[]>;
  /** Add to a day's rollup counters after the fact (e.g. "n:withdrawn", known once the previous receipt is read). */
  bumpRollup(propertyId: string, day: string, fields: Record<string, number>): Promise<void>;
  /** retention: remove receipts with seq <= `seq`; returns how many were removed */
  deleteReceiptsThrough(propertyId: string, seq: number): Promise<number>;

  // leak detection: tracker requests seen after a decline
  recordLeak(l: LeakReport): Promise<void>;
  listLeaks(propertyId: string, sinceIso: string): Promise<LeakReport[]>;
  pruneLeaks(propertyId: string, beforeIso: string): Promise<number>;

  // webhook delivery log (newest first)
  recordWebhookDelivery(d: WebhookDelivery): Promise<void>;
  listWebhookDeliveries(propertyId: string, limit: number): Promise<WebhookDelivery[]>;
  pruneWebhookDeliveries(propertyId: string, beforeIso: string): Promise<number>;

  // contact requests (sales, support, partner, enterprise)
  /** `abuseKey` (a stable keyed IP hash) indexes the per-network abuse window; defaults to l.ipHash */
  createLead(l: Lead, abuseKey?: string): Promise<Lead>;
  countRecentLeads(abuseKey: string, sinceIso: string): Promise<number>;
  /** staff inbox, newest first; leads without a topic are sales, without a status are new */
  listLeads(q?: LeadQuery): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | null>;
  /** move a lead through new, open and closed; null when it doesn't exist */
  updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null>;

  // pageview counters for opt-in / bounce rates and plan limits
  /** "view" when the banner is shown, "bounce" when the visitor leaves without choosing */
  recordPageview(propertyId: string, day: string, kind: "view" | "bounce"): Promise<void>;
  listCounters(propertyId: string, fromDay: string, toDay: string): Promise<PageviewCounter[]>;

  // shared fixed-window counters (public API rate limits)
  /**
   * Add one hit to `key`'s counter for the window starting at `windowStart` (epoch ms) and return
   * the count including this hit. Counters expire shortly after the window closes.
   */
  hitWindow(key: string, windowStart: number, windowMs: number): Promise<number>;

  // IP hashing: one random salt per UTC day, the same on every instance, gone ~2 days later
  /** the salt for `day` (YYYY-MM-DD), created on first use; concurrent callers get the same one */
  dailySalt(day: string): Promise<string>;

  // Stripe webhook idempotency (kept 30 days)
  /** true the first time an event id is claimed; false when it was already claimed (a redelivery) */
  claimStripeEvent(eventId: string): Promise<boolean>;
  /** undo a claim when handling failed, so Stripe's retry is processed */
  releaseStripeEvent(eventId: string): Promise<void>;

  // live site checks: the newest SITE_AUDIT_KEEP reports per site
  saveSiteAudit(propertyId: string, report: SiteAuditReport): Promise<void>;
  /** newest first */
  listSiteAudits(propertyId: string, limit: number): Promise<SiteAuditReport[]>;

  // proof of consent: immutable snapshots of each published config version
  /** write once; returns false (and changes nothing) when that version was already saved */
  saveConfigVersion(v: ConfigVersion): Promise<boolean>;
  getConfigVersion(propertyId: string, version: number): Promise<ConfigVersion | null>;
  /** newest version first */
  listConfigVersions(propertyId: string, limit: number): Promise<ConfigVersion[]>;
  /** one receipt by its sequence number in the site's chain */
  getReceipt(propertyId: string, seq: number): Promise<ConsentReceipt | null>;

  // tracker scans: the newest SCAN_KEEP reports per site (lib/trackers.ts)
  saveScan(report: ScanReport): Promise<void>;
  /** newest first */
  listScans(propertyId: string, limit: number): Promise<ScanReport[]>;
  /** one scan report by id, or null (also null for another site's scan) */
  getScan(propertyId: string, scanId: string): Promise<ScanReport | null>;
  /**
   * For polling a running scan: the report with only the log lines after the `logAfter` line the
   * caller already has (matched by time and message). `logMode` "append" means `log` holds just the
   * new lines; "replace" means the cursor wasn't found and `log` is the whole log.
   */
  pollScan(
    propertyId: string,
    scanId: string,
    logAfter?: { at: string; message: string } | null,
  ): Promise<(ScanReport & { logMode: "append" | "replace" }) | null>;
  /**
   * Patch a scan report in place (its storage key never changes). With `ifStatus`, the patch only
   * applies while the report's status is one of those; otherwise nothing changes and null is
   * returned. That makes "queued → running" a claim only one worker wins, and lets a cancel stop
   * a worker's next progress write. Returns the updated report, or null when missing or skipped.
   */
  updateScan(
    propertyId: string,
    scanId: string,
    patch: Partial<Omit<ScanReport, "id" | "propertyId" | "startedAt">>,
    opts?: { ifStatus?: ScanReport["status"][] },
  ): Promise<ScanReport | null>;
  /**
   * Oldest queued scans across all sites. Only the local file store implements this (the local
   * crawler worker polls it); in AWS the queue is SQS and the DynamoDB store returns [].
   */
  listQueuedScans(limit: number): Promise<ScanReport[]>;
}
