// Shared domain model. Mirrors the single-table DynamoDB layout described in infra/README.md.

export type Role = "owner" | "admin" | "editor" | "auditor" | "viewer";
export type PlanId = "free" | "starter" | "growth" | "business" | "enterprise";
export type Framework = "gdpr" | "ccpa" | "dpdpa" | "generic";
export type CategoryId = "essential" | "functional" | "analytics" | "marketing";
export type Layout = "bar" | "modal" | "toast";
export type Position = "bottom" | "top" | "bottom-left" | "bottom-right" | "center";

export interface User {
  id: string;
  email: string;
  name: string;
  /** scrypt hash, local auth driver only. Cognito users have no password stored here. */
  passwordHash?: string;
  /** Cognito user pool `sub` (AUTH_DRIVER=cognito). Linked by e-mail at sign-up and refreshed at each sign-in. */
  cognitoSub?: string;
  passwordChangedAt?: string;
  /**
   * Two-factor sign-in, run by the app for both auth drivers (Cognito's own MFA isn't used).
   * Present exactly when at least one factor (authenticator app or passkey) is set up, so `user.mfa`
   * means "two-factor is on" everywhere.
   */
  mfa?: UserMfa;
  /** enrolment started but not yet confirmed with a code; expires after 15 minutes */
  mfaPending?: { secretEnc: string; createdAt: string };
  /** an outstanding WebAuthn challenge (passkey registration or sign-in); single use, 5 minutes */
  webauthnChallenge?: WebAuthnChallenge;
  /**
   * Under an organization that requires two-factor: the end of the grace period, set to 7 days after
   * the first time the member was asked to set it up. Never moved later.
   */
  mfaSetupDeferredUntil?: string;
  /** when the member chose "Skip for now" on the required setup screen (keeps them working until the deadline) */
  mfaSetupSkippedAt?: string;
  /** when the optional "Protect your account" prompt was dismissed; it stays away for 30 days */
  mfaPromptDismissedAt?: string;
  /** failed sign-ins inside the current lockout window (SOC 2 CC6.1) */
  loginFailures?: { count: number; windowStart: string };
  lockedUntil?: string;
  lastActiveAt?: string;
  createdAt: string;
}

export interface UserMfa {
  /**
   * AES-256-GCM encrypted base32 TOTP secret ("v1:iv:tag:ciphertext", base64url parts). Present only
   * when an authenticator app is set up.
   */
  secretEnc?: string;
  /** passkeys (WebAuthn credentials) registered as a second factor */
  passkeys?: Passkey[];
  enabledAt: string;
  /** sha256 hashes of unused one-time recovery codes */
  recoveryCodes: string[];
  /** last TOTP time step accepted; codes from this step or earlier are rejected (replay protection) */
  lastStep?: number;
}

/** A WebAuthn credential used as a second factor. */
export interface Passkey {
  /** credential ID, base64url */
  id: string;
  /** COSE public key, base64url */
  publicKey: string;
  /** signature counter last seen (0 for most synced passkeys, which don't count) */
  counter: number;
  transports?: string[];
  /** the member's own label, e.g. "MacBook Touch ID" */
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface WebAuthnChallenge {
  /** base64url challenge sent to the browser */
  challenge: string;
  purpose: "register" | "authenticate";
  createdAt: string;
}

/** A signed-in browser. The cookie only carries this id; the record decides whether it's still valid. */
export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  /** absolute lifetime end, regardless of activity */
  expiresAt: string;
  ipHash: string;
  userAgent: string;
  mfaVerified: boolean;
  revokedAt?: string;
  /**
   * "staff" for a staff console session (separate cookie, staff Cognito pool); absent for customers.
   * Staff sessions use `userId` = "staff:<cognito sub>", so a person's sessions can be listed and revoked.
   */
  kind?: "staff";
  /** who a staff session belongs to, read from the verified ID token at sign-in */
  staff?: StaffIdentity;
}

/** A Plain Theory staff member, from the staff user pool. The role is their highest platform-* group. */
export interface StaffIdentity {
  /** Cognito `sub` in the staff pool */
  sub: string;
  email: string;
  name: string;
  role: "superadmin" | "support" | "billing" | "analyst";
}

export type AuditAction =
  | "auth.signup"
  | "auth.login"
  | "auth.login_failed"
  | "auth.locked"
  | "auth.logout"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "auth.mfa_recovery_used"
  | "auth.mfa_setup_skipped"
  | "auth.passkey_added"
  | "auth.passkey_removed"
  | "auth.passkey_counter_mismatch"
  | "auth.totp_removed"
  | "auth.password_changed"
  | "auth.password_reset"
  | "auth.session_revoked"
  | "auth.recovery_codes_regenerated"
  | "org.created"
  | "org.settings_updated"
  | "org.security_updated"
  | "member.invited"
  | "member.invite_revoked"
  | "member.joined"
  | "member.role_changed"
  | "member.removed"
  | "property.created"
  | "property.deleted"
  | "property.published"
  | "banner.updated"
  | "regions.updated"
  | "notice.updated"
  | "tracker.added"
  | "tracker.updated"
  | "tracker.removed"
  | "tracker.scan_run"
  | "tracker.approved"
  | "tracker.ignored"
  | "tracker.restored"
  | "site.audit_run"
  | "language.added"
  | "language.updated"
  | "language.reviewed"
  | "language.removed"
  | "webhook.created"
  | "webhook.updated"
  | "webhook.deleted"
  | "webhook.tested"
  | "billing.plan_changed"
  | "logs.exported"
  | "logs.chain_verified"
  | "evidence.exported"
  | "access_review.exported"
  | "audit.exported"
  | "audit.chain_verified"
  | "retention.run"
  | "retention.grace_started"
  | "retention.grace_expired"
  | "retention.legal_hold_set"
  | "retention.legal_hold_cleared";

/**
 * Administrative audit trail (SOC 2 CC4.1, CC7.2). Hash-chained per organization like consent
 * receipts, so a changed or deleted event breaks verification.
 */
export interface AuditEvent {
  id: string;
  orgId: string;
  seq: number;
  /** null for system actors (billing webhook, retention job) */
  actorUserId: string | null;
  actorEmail: string;
  action: AuditAction;
  target: { type: string; id: string; label?: string };
  /** small, non-secret context (e.g. changed field names, old and new role) */
  metadata?: Record<string, string | number | boolean | null>;
  ipHash: string;
  userAgent: string;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export type WorkspaceKind = "personal" | "organization";
export const TEAM_SIZES = ["1-10", "11-50", "51-250", "251-1000", "1000+"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export interface Organization {
  id: string;
  name: string;
  /** chosen at onboarding: a personal workspace or a company/agency organization */
  kind?: WorkspaceKind;
  /** headcount band, organizations only */
  teamSize?: TeamSize;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** AWS region consent receipts are pinned to (data residency). */
  dataRegion: "ap-south-1" | "ap-south-2" | "eu-central-1" | "us-east-1";
  dpo?: { name: string; email: string; address?: string };
  security?: { requireMfa: boolean };
  /** last run of the retention job across this organization's sites */
  retentionLastRunAt?: string;
  /**
   * Set when the plan drops to one that keeps consent receipts for less time (cancellation or
   * downgrade). Until `until`, retention keeps the old plan's `logRetentionDays` and its export
   * features stay available, so customers can take their records with them (src/lib/retention-grace.ts).
   */
  retentionGrace?: { until: string; logRetentionDays: number; fromPlan: PlanId };
  /** set by Plain Theory staff: while present, the retention job deletes nothing for this organization */
  legalHold?: { since: string; by: string; reason?: string };
  /** set by Plain Theory staff: members can't use the dashboard until it's lifted */
  suspendedAt?: string;
  suspendedReason?: string;
  createdAt: string;
}

export interface Membership {
  orgId: string;
  userId: string;
  role: Role;
  invitedBy?: string;
  createdAt: string;
}

export interface Invite {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  /** user id of whoever sent the invite (access reviews) */
  invitedBy?: string;
  createdAt: string;
}

export interface CategoryCopy {
  id: CategoryId;
  label: string;
  description: string;
  /** essential categories are always on and cannot be declined */
  required: boolean;
  /** DPDPA Rule 3 itemised notice: the personal data items collected for this purpose */
  dataItems?: string[];
  /** how long data for this purpose is kept, in plain words (e.g. "13 months") */
  retention?: string;
}

/**
 * Languages a notice can be shown in: English plus the 22 languages of the Eighth Schedule to the
 * Constitution of India (DPDP Act s.5(3)), and common global languages.
 */
export type LanguageCode =
  | "en" | "as" | "bn" | "brx" | "doi" | "gu" | "hi" | "kn" | "ks" | "kok" | "mai" | "ml" | "mni" | "mr" | "ne" | "or" | "pa" | "sa" | "sat" | "sd" | "ta" | "te" | "ur"
  | "de" | "fr" | "es" | "it" | "nl" | "pt";

/** A translated notice. Drafts are machine-assisted and must be reviewed by a person before relying on them. */
export interface NoticeTranslation {
  copy: BannerCopy;
  /** category id -> translated label/description */
  categories?: Partial<Record<CategoryId, { label: string; description: string }>>;
  status: "draft" | "reviewed";
  reviewedBy?: string;
  reviewedAt?: string;
}

/** DPDPA s.6(4), Rule 3: how to withdraw, exercise rights and complain to the Data Protection Board. */
export interface RightsLinks {
  /** page or address where people exercise access, correction and erasure rights */
  rightsUrl?: string;
  /** grievance contact; answered within 90 days (Rule 14) */
  grievanceEmail?: string;
  /** Data Protection Board complaint link shown in DPDPA notices */
  boardComplaintUrl?: string;
}

export interface BannerCopy {
  title: string;
  body: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  save: string;
  /** link shown at the end of the body */
  policyLabel: string;
}

export interface BannerTheme {
  layout: Layout;
  position: Position;
  background: string;
  text: string;
  accent: string;
  accentText: string;
  radius: number;
  font: "system" | "inherit" | "serif" | "mono";
  /** equal-weight buttons: reject is as prominent as accept (required for GDPR/DPDPA, no dark patterns) */
  equalButtons: boolean;
  /** corner for the "Privacy choices" button shown after a decision (default left) */
  fabSide?: "left" | "right";
}

export interface RegionRule {
  framework: Framework;
  /** ISO-3166 alpha-2 country codes, or "EU" / "IN" / "US-CA" groups resolved in geo.ts */
  enabled: boolean;
  /** opt-in requires explicit consent; opt-out pre-enables non-essential categories with a "Do not sell" link */
  model: "opt-in" | "opt-out";
  copy: BannerCopy;
  /** default language of `copy` */
  language: string;
  /** extra languages; the SDK picks one from the page `lang` or the browser's languages */
  translations?: Partial<Record<LanguageCode, NoticeTranslation>>;
}

export interface BannerConfig {
  version: number;
  theme: BannerTheme;
  categories: CategoryCopy[];
  regions: Record<Framework, RegionRule>;
  policyUrl: string;
  /** headless: SDK loads rules + blocking but renders no UI; site supplies its own via window.PlainConsent */
  headless: boolean;
  /** Google Consent Mode v2 signals */
  googleConsentMode: boolean;
  /** days before re-asking */
  expiryDays: number;
  /** after "reject all", don't show the banner again for this many days (EU Digital Omnibus direction: 180) */
  reaskAfterRejectDays?: number;
  rights?: RightsLinks;
  /** report tracker requests that still fire after a visitor declines (leak detection) */
  leakDetection?: boolean;
}

/** Signed webhook for withdrawal and consent propagation to CRMs, CDPs and analytics tools. */
export type WebhookEvent = "consent.created" | "consent.withdrawn" | "leak.detected";

export interface Webhook {
  id: string;
  url: string;
  /** HMAC-SHA256 signing secret; shown once on creation */
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  propertyId: string;
  webhookId: string;
  event: WebhookEvent;
  status: "delivered" | "failed";
  httpStatus?: number;
  attempt: number;
  durationMs: number;
  createdAt: string;
}

/** A tracker request observed in a visitor's browser after they declined its category. */
export interface LeakReport {
  id: string;
  propertyId: string;
  /** request host + path, query string removed */
  url: string;
  category: CategoryId;
  page: string;
  framework: Framework;
  country: string;
  createdAt: string;
}

export type TrackerStatus = "approved" | "review" | "ignored";
export type TrackerSource = "scan" | "manual" | "traffic";
export type TrackerKind = "script" | "cookie" | "iframe" | "pixel";

/**
 * A tracker in the site's inventory. Only approved ones with a category are held by the SDK
 * (see lib/trackers.ts); scan suggestions wait in "review", and "ignored" ones are remembered so
 * a rescan doesn't suggest them again. Older records have no status: they are approved and manual.
 */
export interface Tracker {
  id: string;
  name: string;
  /** null only while in review and not yet classified */
  category: CategoryId | null;
  /** substring or hostname matched against script src (a cookie name when kind is "cookie") */
  pattern: string;
  status?: TrackerStatus;
  source?: TrackerSource;
  vendor?: string;
  purpose?: string;
  kind?: TrackerKind;
  /** typical cookie lifetime, e.g. "2 years" */
  expiry?: string;
  party?: "first" | "third";
  /** pages it was last found on (at most 5) */
  foundOn?: string[];
  /** how many scanned pages it was found on */
  pageCount?: number;
  /** last scan that found it */
  seenAt?: string;
}

export interface Property {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  /** public site key embedded in the snippet */
  siteKey: string;
  config: BannerConfig;
  trackers: Tracker[];
  publishedVersion: number;
  publishedAt?: string;
  /** Snapshot taken at publish time. Visitors only ever see this, never unpublished drafts. */
  published?: { config: BannerConfig; trackers: Tracker[] };
  webhooks?: Webhook[];
  /**
   * Receipts up to and including `seq` were removed by the retention job. Verification of the
   * remaining chain starts from this hash, so retention never breaks tamper evidence.
   */
  retentionCheckpoint?: RetentionCheckpoint;
  /** outcome of the most recent "Verify chain" run on the consent log */
  lastChainCheck?: { at: string; ok: boolean; checked: number; brokenAt?: number };
  createdAt: string;
  updatedAt: string;
}

/**
 * Immutable snapshot of what a site published: the exact banner config and tracker rules visitors
 * were shown under `version`. Written once at publish time and never overwritten, so any consent
 * receipt can be matched to the notice text behind it.
 */
export interface ConfigVersion {
  propertyId: string;
  version: number;
  config: BannerConfig;
  trackers: Tracker[];
  publishedAt: string;
  /** user id of whoever published */
  publishedBy: string;
  /** sha-256 of the canonical JSON of every other field */
  hash: string;
}

export type ConsentAction = "accept_all" | "reject_all" | "custom" | "revoke" | "dismiss";

export interface ConsentReceipt {
  id: string;
  propertyId: string;
  /** anonymous visitor id generated by the SDK (random, not derived from PII) */
  visitorId: string;
  action: ConsentAction;
  framework: Framework;
  categories: Record<CategoryId, boolean>;
  country: string;
  device: "desktop" | "mobile" | "tablet";
  browser: string;
  /** truncated then salted-hashed IP; the raw IP is never stored */
  ipHash: string;
  configVersion: number;
  /** the browser sent a Global Privacy Control signal and it was honoured */
  gpc?: boolean;
  /** the decision came from an automated browser (navigator.webdriver), e.g. an AI agent or test */
  automated?: boolean;
  /** language the notice was shown in */
  language?: string;
  timestamp: string;
  /** sha256(prevHash + canonical(receipt)) — forms a tamper-evident chain per property */
  prevHash: string;
  hash: string;
  seq: number;
}

export type LeadTopic = "sales" | "support" | "partner" | "enterprise";
export type LeadStatus = "new" | "open" | "closed";

/**
 * A request from a public contact form: /contact-sales (topic "sales", the original shape) or one of
 * /contact/support, /contact/partners and /contact/enterprise. Leads stored before topics existed have
 * no `topic` and are sales enquiries; ones without `status` are new.
 */
export interface Lead {
  id: string;
  /** missing on leads stored before topics existed: treat as "sales" */
  topic?: LeadTopic;
  /** workflow state in the staff inbox; missing means "new" */
  status?: LeadStatus;
  name: string;
  email: string;
  company?: string;
  /** sales only */
  sites?: "1" | "2-10" | "11-50" | "50+";
  /** sales only */
  pageviews?: "<100k" | "100k-1m" | "1m-10m" | "10m+";
  /** sales and enterprise */
  regions?: ("eu" | "us" | "in" | "other")[];
  /** support: the ticket subject */
  subject?: string;
  /** support category, partner query type or enterprise request type */
  category?: string;
  /** support only */
  severity?: "low" | "normal" | "high" | "urgent";
  message?: string;
  /** topic-specific extras, such as the site domain or partnership type */
  details?: Record<string, string>;
  /** truncated, salted IP hash for abuse limits; never the raw IP */
  ipHash: string;
  createdAt: string;
  /** when staff last changed the status */
  updatedAt?: string;
}

export interface PageviewCounter {
  propertyId: string;
  /** YYYY-MM-DD */
  day: string;
  views: number;
  /** banner shown, no interaction before leaving */
  bounces: number;
}

export interface RetentionCheckpoint {
  seq: number;
  hash: string;
  /** timestamp of the newest removed receipt */
  removedThrough: string;
  removedCount: number;
  at: string;
}
