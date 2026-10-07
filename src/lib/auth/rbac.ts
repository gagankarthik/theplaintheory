import type { Role } from "../types";

export type Permission =
  | "property:read"
  /** edit banners, regions, languages, trackers and webhooks; publish */
  | "property:write"
  /** add a site to the organization */
  | "property:create"
  | "property:delete"
  /** export consent logs and Evidence Packs */
  | "logs:export"
  /** invite and remove members, change roles (only owners can manage owners, see memberChangeProblem) */
  | "team:manage"
  | "billing:manage"
  | "org:settings"
  /** read the audit trail, security status and access reviews */
  | "audit:read"
  /** org-wide security policy, e.g. requiring MFA */
  | "security:manage";

/** Every organization role, most to least privileged. */
export const ROLES: Role[] = ["owner", "admin", "editor", "auditor", "viewer"];

/** Roles an owner or admin can invite someone into. Owner access is granted by changing an existing member's role. */
export const INVITE_ROLES = ["admin", "editor", "auditor", "viewer"] as const satisfies readonly Role[];

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);

const GRANTS: Record<Role, Permission[]> = {
  owner: ["property:read", "property:write", "property:create", "property:delete", "logs:export", "team:manage", "billing:manage", "org:settings", "audit:read", "security:manage"],
  admin: ["property:read", "property:write", "property:create", "property:delete", "logs:export", "team:manage", "org:settings", "audit:read"],
  editor: ["property:read", "property:write"],
  auditor: ["property:read", "logs:export", "audit:read"],
  viewer: ["property:read", "logs:export"],
};

export const can = (role: Role, p: Permission) => GRANTS[role].includes(p);

export class ForbiddenError extends Error {
  constructor(p: Permission) {
    super(`Your role doesn't allow this (${p}). Ask an owner or admin.`);
  }
}

export function assertCan(role: Role, p: Permission) {
  if (!can(role, p)) throw new ForbiddenError(p);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  auditor: "Auditor",
  viewer: "Viewer",
};

export const ROLE_INFO: Record<Role, string> = {
  owner: "Everything, including billing, security policy and deleting the organization.",
  admin: "Add and delete sites, edit banners and manage the team. Can't manage owners or billing.",
  editor: "Edit banners, regions, languages and trackers, and publish. Can't add or delete sites.",
  auditor: "Read-only, plus export consent logs and Evidence Packs and read the audit trail.",
  viewer: "See analytics and export consent logs and Evidence Packs. Can't change anything.",
};

/**
 * Why a team change isn't allowed, or null. `next` null means remove the member.
 * Checked on the server; the team UI only mirrors it.
 * - You need team:manage.
 * - Nobody changes their own role or removes themselves.
 * - Only owners can grant owner access, or change or remove an owner.
 */
export function memberChangeProblem({
  actorRole,
  actorUserId,
  targetUserId,
  targetRole,
  next,
}: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
  next: Role | null;
}): string | null {
  if (!can(actorRole, "team:manage")) return "Your role can't manage the team. Ask an owner or admin.";
  if (targetUserId === actorUserId) return next ? "You can't change your own role. Ask another owner." : "You can't remove yourself.";
  if (actorRole !== "owner") {
    if (next === null && targetRole === "owner") return "Only owners can remove an owner.";
    if (next !== null && (targetRole === "owner" || next === "owner")) return "Only owners can grant or remove owner access.";
  }
  return null;
}
