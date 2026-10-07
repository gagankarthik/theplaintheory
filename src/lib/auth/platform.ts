/**
 * Platform (Plain Theory staff) roles and permissions. Separate from org RBAC in rbac.ts: org roles say
 * what a customer can do inside their own organization; platform roles say what our team can do across
 * every customer.
 *
 * Staff sign in through their own Cognito user pool (staff-cognito.ts). Membership of a
 * `platform-<role>` group in that pool IS the staff role: there's no copy in the data store. Pure
 * functions only, so the rules are unit-tested without a store, a pool or a request.
 */
export type PlatformRole = "superadmin" | "support" | "billing" | "analyst";

/** Highest first: someone in two groups gets the higher role. */
export const PLATFORM_ROLES: PlatformRole[] = ["superadmin", "support", "billing", "analyst"];

export type PlatformPermission =
  /** overview metrics, plan mix, signups */
  | "platform:metrics"
  /** organization and user lists */
  | "platform:lists"
  /** member, session, billing-id and audit detail for one customer */
  | "platform:detail"
  /** the platform audit trail */
  | "platform:audit"
  /** clear a sign-in lockout */
  | "users:unlock"
  /** sign a user out everywhere */
  | "users:revoke_sessions"
  /** change an organization's plan without Stripe (comp) */
  | "orgs:plan"
  /** suspend or lift a suspension */
  | "orgs:suspend"
  /** place or lift a legal hold (retention deletes nothing while it's set) */
  | "orgs:legal_hold"
  /** invite, change, disable or remove staff */
  | "staff:manage"
  /** the contact-request inbox (sales, support, partner and enterprise requests) */
  | "leads:read"
  /** change a contact request's status */
  | "leads:manage";

/** docs/architecture/platform-architecture.md §7.2 */
const GRANTS: Record<PlatformRole, PlatformPermission[]> = {
  superadmin: [
    "platform:metrics",
    "platform:lists",
    "platform:detail",
    "platform:audit",
    "users:unlock",
    "users:revoke_sessions",
    "orgs:plan",
    "orgs:suspend",
    "orgs:legal_hold",
    "staff:manage",
    "leads:read",
    "leads:manage",
  ],
  support: ["platform:metrics", "platform:lists", "platform:detail", "platform:audit", "users:unlock", "users:revoke_sessions", "leads:read", "leads:manage"],
  billing: ["platform:metrics", "platform:lists", "orgs:plan"],
  analyst: ["platform:metrics", "platform:lists", "leads:read"],
};

export const canPlatform = (role: PlatformRole | null | undefined, p: PlatformPermission) => Boolean(role && GRANTS[role]?.includes(p));

export class PlatformForbiddenError extends Error {
  constructor(p: PlatformPermission) {
    super(`Your staff role doesn't allow this (${p}). Ask a superadmin.`);
  }
}

export function assertPlatform(role: PlatformRole | null | undefined, p: PlatformPermission) {
  if (!canPlatform(role, p)) throw new PlatformForbiddenError(p);
}

export const PLATFORM_ROLE_INFO: Record<PlatformRole, { label: string; summary: string }> = {
  superadmin: { label: "Superadmin", summary: "Everything, including inviting and managing staff, plan changes, suspensions and legal holds." },
  support: { label: "Support", summary: "Read all customer data, unlock accounts, sign users out and work the request inbox." },
  billing: { label: "Billing", summary: "Metrics, the organization and user lists, and plan changes (comps)." },
  analyst: { label: "Analyst", summary: "Read-only metrics, the organization and user lists, and the request inbox." },
};

export const isPlatformRole = (v: unknown): v is PlatformRole => typeof v === "string" && (PLATFORM_ROLES as string[]).includes(v);

/* ---------------- Cognito groups ---------------- */

export const STAFF_GROUP_PREFIX = "platform-";

/** The staff pool group that grants a role. */
export const staffGroupName = (role: PlatformRole) => `${STAFF_GROUP_PREFIX}${role}`;

/**
 * The staff role from a `cognito:groups` claim (or a group listing): the highest platform-* group the
 * person is in, or null when they're in none. Unknown groups are ignored.
 */
export function roleFromGroups(groups: unknown): PlatformRole | null {
  const list = Array.isArray(groups) ? groups : typeof groups === "string" ? [groups] : [];
  const roles = new Set(list.filter((g): g is string => typeof g === "string" && g.startsWith(STAFF_GROUP_PREFIX)).map((g) => g.slice(STAFF_GROUP_PREFIX.length)));
  return PLATFORM_ROLES.find((r) => roles.has(r)) ?? null;
}

/* ---------------- staff management guards ---------------- */

export interface StaffMember {
  /** Cognito `sub` (stable id; the pool's username is also this UUID) */
  sub: string;
  email: string;
  role: PlatformRole;
  enabled: boolean;
}

export type StaffChange = { kind: "role"; next: PlatformRole } | { kind: "disable" } | { kind: "enable" } | { kind: "remove" } | { kind: "reset_password" } | { kind: "resend_invite" };

/**
 * Why a staff change isn't allowed, or null.
 * - Nobody changes, disables, resets or removes their own account (another superadmin must), so you
 *   can't lock yourself out by accident.
 * - The last enabled superadmin can't be demoted, disabled or removed.
 */
export function staffChangeProblem({ actorSub, target, change, staff }: { actorSub: string; target: StaffMember | null; change: StaffChange; staff: StaffMember[] }): string | null {
  if (!target) return "That person isn't on the staff list.";
  if (target.sub === actorSub) return "You can't change your own staff account. Ask another superadmin.";
  if (change.kind === "role" && target.role === change.next) return `${target.email} is already ${PLATFORM_ROLE_INFO[target.role].label.toLowerCase()}.`;
  if (change.kind === "disable" && !target.enabled) return `${target.email} is already disabled.`;
  if (change.kind === "enable" && target.enabled) return `${target.email} is already enabled.`;
  const losesSuperadmin = target.role === "superadmin" && target.enabled && (change.kind === "disable" || change.kind === "remove" || (change.kind === "role" && change.next !== "superadmin"));
  if (losesSuperadmin) {
    const others = staff.filter((s) => s.role === "superadmin" && s.enabled && s.sub !== target.sub).length;
    if (others === 0) return "This is the last superadmin. Make someone else superadmin first.";
  }
  return null;
}
