import { describe, expect, it } from "vitest";
import { ForbiddenError, INVITE_ROLES, ROLES, ROLE_INFO, ROLE_LABEL, assertCan, can, isRole, memberChangeProblem, type Permission } from "@/lib/auth/rbac";
import type { Role } from "@/lib/types";

const all: Permission[] = [
  "property:read",
  "property:write",
  "property:create",
  "property:delete",
  "logs:export",
  "team:manage",
  "billing:manage",
  "org:settings",
  "audit:read",
  "security:manage",
];

/** The approved matrix (docs/architecture/platform-architecture.md section 7.3), one row per permission. */
const MATRIX: Record<Permission, Role[]> = {
  "property:read": ["owner", "admin", "editor", "auditor", "viewer"],
  "property:write": ["owner", "admin", "editor"],
  "property:create": ["owner", "admin"],
  "property:delete": ["owner", "admin"],
  "logs:export": ["owner", "admin", "auditor", "viewer"],
  "audit:read": ["owner", "admin", "auditor"],
  "team:manage": ["owner", "admin"],
  "org:settings": ["owner", "admin"],
  "security:manage": ["owner"],
  "billing:manage": ["owner"],
};

describe("organization roles", () => {
  it("lists five roles with a label and description each", () => {
    expect(ROLES).toEqual(["owner", "admin", "editor", "auditor", "viewer"]);
    for (const r of ROLES) {
      expect(ROLE_LABEL[r]).toBeTruthy();
      expect(ROLE_INFO[r]).toBeTruthy();
    }
  });

  it("invites into every role except owner", () => {
    expect([...INVITE_ROLES].sort()).toEqual(["admin", "auditor", "editor", "viewer"]);
  });

  it("recognises only known roles", () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("Owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("permission matrix", () => {
  it.each(all)("%s is granted to exactly the approved roles", (p) => {
    expect(ROLES.filter((r) => can(r, p))).toEqual(MATRIX[p]);
  });

  it("editor can edit and publish but not add or delete sites, export, read audit or manage the team", () => {
    expect(can("editor", "property:read")).toBe(true);
    expect(can("editor", "property:write")).toBe(true);
    for (const p of ["property:create", "property:delete", "logs:export", "audit:read", "team:manage", "org:settings", "billing:manage", "security:manage"] as const) {
      expect(can("editor", p)).toBe(false);
    }
  });

  it("auditor can export and read the audit trail but can't change anything", () => {
    expect(can("auditor", "logs:export")).toBe(true);
    expect(can("auditor", "audit:read")).toBe(true);
    for (const p of ["property:write", "property:create", "property:delete", "team:manage", "org:settings", "billing:manage", "security:manage"] as const) {
      expect(can("auditor", p)).toBe(false);
    }
  });

  it("only owners hold billing and security policy", () => {
    expect(ROLES.filter((r) => can(r, "billing:manage"))).toEqual(["owner"]);
    expect(ROLES.filter((r) => can(r, "security:manage"))).toEqual(["owner"]);
  });

  it("assertCan throws ForbiddenError when the role lacks the permission", () => {
    expect(() => assertCan("editor", "property:create")).toThrow(ForbiddenError);
    expect(() => assertCan("auditor", "property:write")).toThrow(ForbiddenError);
    expect(() => assertCan("editor", "property:write")).not.toThrow();
  });
});

describe("memberChangeProblem", () => {
  const change = (actorRole: Role, targetRole: Role, next: Role | null, targetUserId = "usr_target") =>
    memberChangeProblem({ actorRole, actorUserId: "usr_me", targetUserId, targetRole, next });

  it("refuses roles without team:manage", () => {
    for (const r of ["editor", "auditor", "viewer"] as const) {
      expect(change(r, "viewer", "editor")).toMatch(/can't manage the team/);
      expect(change(r, "viewer", null)).toMatch(/can't manage the team/);
    }
  });

  it("refuses changing or removing yourself", () => {
    expect(change("owner", "owner", "admin", "usr_me")).toMatch(/your own role/);
    expect(change("owner", "owner", null, "usr_me")).toMatch(/remove yourself/);
  });

  it("stops an admin from changing or removing an owner, or granting owner", () => {
    expect(change("admin", "owner", "viewer")).toMatch(/Only owners/);
    expect(change("admin", "owner", "owner")).toMatch(/Only owners/);
    expect(change("admin", "owner", null)).toMatch(/Only owners can remove/);
    expect(change("admin", "viewer", "owner")).toMatch(/Only owners/);
  });

  it("lets an admin manage every non-owner role", () => {
    for (const from of ["admin", "editor", "auditor", "viewer"] as const) {
      for (const to of ["admin", "editor", "auditor", "viewer"] as const) expect(change("admin", from, to)).toBeNull();
      expect(change("admin", from, null)).toBeNull();
    }
  });

  it("lets an owner manage owners", () => {
    expect(change("owner", "owner", "admin")).toBeNull();
    expect(change("owner", "editor", "owner")).toBeNull();
    expect(change("owner", "owner", null)).toBeNull();
  });
});
