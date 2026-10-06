import type {
  ConsentReceipt,
  Invite,
  Membership,
  Organization,
  PageviewCounter,
  Property,
  Role,
  User,
} from "../types";

export type ReceiptDraft = Omit<ConsentReceipt, "id" | "seq" | "prevHash" | "hash">;

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

  // organizations & membership (RBAC)
  createOrg(o: Organization, owner: string): Promise<Organization>;
  getOrg(id: string): Promise<Organization | null>;
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

  // pageview counters for opt-in / bounce rates and plan limits
  /** "view" when the banner is shown, "bounce" when the visitor leaves without choosing */
  recordPageview(propertyId: string, day: string, kind: "view" | "bounce"): Promise<void>;
  listCounters(propertyId: string, fromDay: string, toDay: string): Promise<PageviewCounter[]>;
}
