import type {
  AuditEvent,
  ConsentReceipt,
  SessionRecord,
  Invite,
  Lead,
  LeakReport,
  WebhookDelivery,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  Role,
  User,
} from "../types";

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

export interface Store {
  // users
  createUser(u: User): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;

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

  // organizations & membership (RBAC)
  createOrg(o: Organization, owner: string): Promise<Organization>;
  getOrg(id: string): Promise<Organization | null>;
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

  // consent receipts: append-only, hash-chained per property
  appendReceipt(draft: ReceiptDraft): Promise<ConsentReceipt>;
  listReceipts(propertyId: string, q?: ReceiptQuery): Promise<ConsentReceipt[]>;
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

  // sales enquiries
  createLead(l: Lead): Promise<Lead>;
  countRecentLeads(ipHash: string, sinceIso: string): Promise<number>;

  // pageview counters for opt-in / bounce rates and plan limits
  /** "view" when the banner is shown, "bounce" when the visitor leaves without choosing */
  recordPageview(propertyId: string, day: string, kind: "view" | "bounce"): Promise<void>;
  listCounters(propertyId: string, fromDay: string, toDay: string): Promise<PageviewCounter[]>;
}
