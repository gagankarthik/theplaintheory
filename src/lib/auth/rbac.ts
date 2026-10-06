import type { Role } from "../types";

export type Permission =
  | "property:read"
  | "property:write"
  | "property:delete"
  | "logs:export"
  | "team:manage"
  | "billing:manage"
  | "org:settings"
  /** read the audit trail, security status and access reviews */
  | "audit:read"
  /** org-wide security policy, e.g. requiring MFA */
  | "security:manage";

const GRANTS: Record<Role, Permission[]> = {
  owner: ["property:read", "property:write", "property:delete", "logs:export", "team:manage", "billing:manage", "org:settings", "audit:read", "security:manage"],
  admin: ["property:read", "property:write", "property:delete", "logs:export", "team:manage", "org:settings", "audit:read"],
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

export const ROLE_INFO: Record<Role, string> = {
  owner: "Everything, including billing and deleting the organization.",
  admin: "Manage sites, banners and team members. No billing.",
  viewer: "See analytics and export consent logs. Can't change anything.",
};
