import type { User } from "../types";

/**
 * Platform (Plain Theory staff) permissions. Separate from org RBAC in rbac.ts: org roles say what a
 * customer can do inside their own organization; platform roles say what our team can do across
 * every customer. Pure functions only, so the rules are unit-tested without a store or a request.
 */
export type PlatformRole = NonNullable<User["platformRole"]>;

export const PLATFORM_ROLES: PlatformRole[] = ["superadmin", "support", "analyst"];

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
  /** grant, change or revoke platform roles */
  | "staff:manage";

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
    "staff:manage",
  ],
  support: ["platform:metrics", "platform:lists", "platform:detail", "platform:audit", "users:unlock", "users:revoke_sessions"],
  analyst: ["platform:metrics", "platform:lists"],
};

export const canPlatform = (role: PlatformRole | null | undefined, p: PlatformPermission) => Boolean(role && GRANTS[role].includes(p));

export class PlatformForbiddenError extends Error {
  constructor(p: PlatformPermission) {
    super(`Your staff role doesn't allow this (${p}). Ask a superadmin.`);
  }
}

export function assertPlatform(role: PlatformRole | null | undefined, p: PlatformPermission) {
  if (!canPlatform(role, p)) throw new PlatformForbiddenError(p);
}

export const PLATFORM_ROLE_INFO: Record<PlatformRole, { label: string; summary: string }> = {
  superadmin: { label: "Superadmin", summary: "Everything, including staff roles, plan changes and suspensions." },
  support: { label: "Support", summary: "Read all customer data, unlock accounts and sign users out." },
  analyst: { label: "Analyst", summary: "Read-only metrics and the organization and user lists." },
};

export const isPlatformRole = (v: unknown): v is PlatformRole => typeof v === "string" && (PLATFORM_ROLES as string[]).includes(v);

/** Emails from PLATFORM_SUPERADMINS (comma or whitespace separated), lower-cased. */
export function parseSuperadminEnv(value: string | undefined | null): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export const isBootstrapSuperadmin = (email: string, env = process.env.PLATFORM_SUPERADMINS) => parseSuperadminEnv(env).has(email.toLowerCase());

/**
 * The effective platform role. Bootstrap emails always resolve to superadmin, so a fresh deployment
 * (or a locked-out team) can always get in by setting the env var; otherwise the stored role.
 */
export function resolvePlatformRole(user: Pick<User, "email" | "platformRole"> | null | undefined, env = process.env.PLATFORM_SUPERADMINS): PlatformRole | null {
  if (!user) return null;
  if (isBootstrapSuperadmin(user.email, env)) return "superadmin";
  return isPlatformRole(user.platformRole) ? user.platformRole : null;
}

/**
 * Staff sessions must have passed two-factor in production. In development (NODE_ENV !== "production")
 * the check is skipped so the seeded demo superadmin, who has no authenticator, can open the console.
 */
export function staffMfaProblem(input: { userHasMfa: boolean; sessionMfaVerified: boolean; production: boolean }): "enroll" | "verify" | null {
  if (!input.production) return null; // DEV BYPASS: local and preview environments only
  if (!input.userHasMfa) return "enroll";
  if (!input.sessionMfaVerified) return "verify";
  return null;
}

export interface StaffMember {
  userId: string;
  email: string;
  role: PlatformRole;
  /** role comes from PLATFORM_SUPERADMINS and can't be changed in the console */
  bootstrap: boolean;
}

/**
 * Why a staff role change isn't allowed, or null. `next` null means revoke.
 * - Nobody changes their own role (another superadmin must), so you can't lock yourself out.
 * - Bootstrap superadmins are managed through the env var, not the console.
 * - The last superadmin can't be demoted or removed.
 */
export function staffChangeProblem({ actorUserId, target, next, staff }: { actorUserId: string; target: StaffMember | null; next: PlatformRole | null; staff: StaffMember[] }): string | null {
  if (target && target.userId === actorUserId) return "You can't change your own staff role. Ask another superadmin.";
  if (!target) return next ? null : "That person isn't on the staff list.";
  if (target.bootstrap) return "This superadmin is set by PLATFORM_SUPERADMINS. Change it in the environment, not here.";
  if (target.role === next) return `${target.email} is already ${PLATFORM_ROLE_INFO[target.role].label.toLowerCase()}.`;
  if (target.role === "superadmin" && next !== "superadmin") {
    const others = staff.filter((s) => s.role === "superadmin" && s.userId !== target.userId).length;
    if (others === 0) return "This is the last superadmin. Make someone else superadmin first.";
  }
  return null;
}
