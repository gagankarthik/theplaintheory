import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PLATFORM_ROLES,
  PlatformForbiddenError,
  assertPlatform,
  canPlatform,
  roleFromGroups,
  staffChangeProblem,
  staffGroupName,
  type PlatformPermission,
  type StaffMember,
} from "@/lib/auth/platform";
import { verifyPlatformAuditChain } from "@/lib/platform/audit-chain";
import type { Store } from "@/lib/store/types";

describe("platform permissions", () => {
  const all: PlatformPermission[] = [
    "platform:metrics",
    "platform:lists",
    "platform:detail",
    "platform:audit",
    "users:unlock",
    "users:revoke_sessions",
    "orgs:plan",
    "orgs:suspend",
    "staff:manage",
    "leads:read",
    "leads:manage",
  ];

  it("superadmin can do everything", () => {
    for (const p of all) expect(canPlatform("superadmin", p)).toBe(true);
  });

  it("support reads everything and can unlock and sign users out, but can't change plans, suspend or manage staff", () => {
    for (const p of ["platform:metrics", "platform:lists", "platform:detail", "platform:audit", "users:unlock", "users:revoke_sessions", "leads:read", "leads:manage"] as const)
      expect(canPlatform("support", p)).toBe(true);
    for (const p of ["orgs:plan", "orgs:suspend", "staff:manage"] as const) expect(canPlatform("support", p)).toBe(false);
  });

  it("billing sees metrics and lists and can change plans, nothing else", () => {
    expect(all.filter((p) => canPlatform("billing", p))).toEqual(["platform:metrics", "platform:lists", "orgs:plan"]);
  });

  it("analyst is read-only metrics, lists and the request inbox", () => {
    expect(all.filter((p) => canPlatform("analyst", p))).toEqual(["platform:metrics", "platform:lists", "leads:read"]);
  });

  it("only superadmins manage staff", () => {
    expect(PLATFORM_ROLES.filter((r) => canPlatform(r, "staff:manage"))).toEqual(["superadmin"]);
  });

  it("no role means no access", () => {
    for (const p of all) {
      expect(canPlatform(null, p)).toBe(false);
      expect(canPlatform(undefined, p)).toBe(false);
      expect(canPlatform("owner" as never, p)).toBe(false);
    }
  });

  it("assertPlatform throws a readable error", () => {
    expect(() => assertPlatform("analyst", "orgs:suspend")).toThrow(PlatformForbiddenError);
    expect(() => assertPlatform("superadmin", "orgs:suspend")).not.toThrow();
  });
});

describe("staff roles from Cognito groups", () => {
  it("names groups after the role", () => {
    expect(PLATFORM_ROLES.map(staffGroupName)).toEqual(["platform-superadmin", "platform-support", "platform-billing", "platform-analyst"]);
  });

  it("takes the highest platform-* group", () => {
    expect(roleFromGroups(["platform-analyst"])).toBe("analyst");
    expect(roleFromGroups(["platform-analyst", "platform-superadmin"])).toBe("superadmin");
    expect(roleFromGroups(["platform-billing", "platform-analyst"])).toBe("billing");
    expect(roleFromGroups(["platform-analyst", "platform-support", "platform-billing"])).toBe("support");
    expect(roleFromGroups("platform-support")).toBe("support");
  });

  it("is null without a platform group, and ignores unknown or look-alike groups", () => {
    expect(roleFromGroups(undefined)).toBeNull();
    expect(roleFromGroups([])).toBeNull();
    expect(roleFromGroups(["admins", "platform-owner", "platform-", "superadmin", "xplatform-superadmin", 7])).toBeNull();
    expect(roleFromGroups({ 0: "platform-superadmin" })).toBeNull();
  });
});

describe("staff management guards", () => {
  const m = (sub: string, role: StaffMember["role"], enabled = true): StaffMember => ({ sub, email: `${sub}@pt.example`, role, enabled });

  it("blocks every change to your own account", () => {
    const staff = [m("me", "superadmin"), m("other", "superadmin")];
    for (const change of [{ kind: "role", next: "support" }, { kind: "disable" }, { kind: "remove" }, { kind: "reset_password" }, { kind: "resend_invite" }] as const) {
      expect(staffChangeProblem({ actorSub: "me", target: staff[0], change, staff })).toMatch(/your own/);
    }
  });

  it("protects the last enabled superadmin from demotion, disabling and removal", () => {
    const staff = [m("me", "superadmin"), m("sole", "superadmin"), m("s", "support")];
    // two superadmins: "me" may demote, disable or remove "sole"
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "role", next: "analyst" }, staff })).toBeNull();
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "disable" }, staff })).toBeNull();
    // a disabled superadmin doesn't count as another one
    const withDisabled = [m("sole", "superadmin"), m("off", "superadmin", false), m("s", "support")];
    for (const change of [{ kind: "role", next: "support" }, { kind: "disable" }, { kind: "remove" }] as const) {
      expect(staffChangeProblem({ actorSub: "s", target: withDisabled[0], change, staff: withDisabled })).toMatch(/last superadmin/);
    }
    // but resetting their password or promoting is fine
    expect(staffChangeProblem({ actorSub: "s", target: withDisabled[0], change: { kind: "reset_password" }, staff: withDisabled })).toBeNull();
  });

  it("allows removing or enabling a disabled superadmin while another is active", () => {
    const staff = [m("me", "superadmin"), m("off", "superadmin", false)];
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "remove" }, staff })).toBeNull();
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "enable" }, staff })).toBeNull();
  });

  it("rejects no-op changes and unknown targets", () => {
    const staff = [m("me", "superadmin"), m("s", "support"), m("off", "analyst", false)];
    expect(staffChangeProblem({ actorSub: "me", target: null, change: { kind: "remove" }, staff })).toMatch(/isn't on the staff/);
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "role", next: "support" }, staff })).toMatch(/already/);
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "enable" }, staff })).toMatch(/already enabled/);
    expect(staffChangeProblem({ actorSub: "me", target: staff[2], change: { kind: "disable" }, staff })).toMatch(/already disabled/);
    expect(staffChangeProblem({ actorSub: "me", target: staff[1], change: { kind: "role", next: "billing" }, staff })).toBeNull();
  });

  it("covers every role, highest first", () => {
    expect(PLATFORM_ROLES).toEqual(["superadmin", "support", "billing", "analyst"]);
  });
});

describe("platform audit trail (local store)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-platform-"));
  let store: Store;

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const draft = (action: "org.suspended" | "user.unlocked", id: string) => ({
    actorUserId: "usr_staff",
    actorEmail: "staff@pt.example",
    actorRole: "superadmin",
    action,
    target: { type: action.startsWith("org") ? ("org" as const) : ("user" as const), id, label: id },
    metadata: { reason: "test" },
    ipHash: "ip",
    userAgent: "ua",
  });

  it("appends a verifiable chain and lists newest first with filters", async () => {
    await Promise.all([store.appendPlatformAudit(draft("org.suspended", "org_1")), store.appendPlatformAudit(draft("user.unlocked", "usr_1")), store.appendPlatformAudit(draft("org.suspended", "org_2"))]);
    const all = await store.listPlatformAudit();
    expect(all.map((e) => e.seq)).toEqual([3, 2, 1]);
    expect(verifyPlatformAuditChain(all).ok).toBe(true);
    expect((await store.listPlatformAudit({ action: "org" })).length).toBe(2);
    expect((await store.listPlatformAudit({ targetId: "usr_1" }))[0].action).toBe("user.unlocked");
    expect((await store.listPlatformAudit({ limit: 1 }))[0].seq).toBe(3);
  });

  it("detects a tampered event", async () => {
    const all = await store.listPlatformAudit();
    const tampered = all.map((e) => (e.seq === 2 ? { ...e, metadata: { reason: "edited" } } : e));
    expect(verifyPlatformAuditChain(tampered)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it("keeps staff session records apart from customer sessions", async () => {
    const now = new Date();
    const base = { createdAt: now.toISOString(), lastSeenAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3600e3).toISOString(), ipHash: "ip", userAgent: "ua", mfaVerified: true };
    const staff = { sub: "11111111-2222-3333-4444-555555555555", email: "s@pt.example", name: "S", role: "support" as const };
    await store.createSessionRecord({ ...base, id: "sst_a", userId: `staff:${staff.sub}`, kind: "staff", staff });
    await store.createSessionRecord({ ...base, id: "sst_b", userId: `staff:${staff.sub}`, kind: "staff", staff });
    await store.createSessionRecord({ ...base, id: "ses_c", userId: "usr_a", mfaVerified: false });
    expect(await store.getSessionRecord("sst_a")).toMatchObject({ kind: "staff", staff });
    expect((await store.getSessionRecord("ses_c"))?.kind).toBeUndefined();
    expect(await store.revokeUserSessions(`staff:${staff.sub}`, now.toISOString())).toBe(2);
    expect((await store.getSessionRecord("ses_c"))?.revokedAt).toBeUndefined();
  });

  it("lists users", async () => {
    await store.createUser({ id: "usr_a", email: "a@pt.example", name: "A", createdAt: new Date().toISOString() });
    expect((await store.listUsers()).map((u) => u.id)).toContain("usr_a");
  });
});

