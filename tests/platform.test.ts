import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PLATFORM_ROLES,
  PlatformForbiddenError,
  assertPlatform,
  canPlatform,
  parseSuperadminEnv,
  resolvePlatformRole,
  staffChangeProblem,
  staffMfaProblem,
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
  ];

  it("superadmin can do everything", () => {
    for (const p of all) expect(canPlatform("superadmin", p)).toBe(true);
  });

  it("support reads everything and can unlock and sign users out, but can't change plans, suspend or manage staff", () => {
    for (const p of ["platform:metrics", "platform:lists", "platform:detail", "platform:audit", "users:unlock", "users:revoke_sessions"] as const) expect(canPlatform("support", p)).toBe(true);
    for (const p of ["orgs:plan", "orgs:suspend", "staff:manage"] as const) expect(canPlatform("support", p)).toBe(false);
  });

  it("analyst is read-only metrics and lists", () => {
    expect(all.filter((p) => canPlatform("analyst", p))).toEqual(["platform:metrics", "platform:lists"]);
  });

  it("no role means no access", () => {
    for (const p of all) {
      expect(canPlatform(null, p)).toBe(false);
      expect(canPlatform(undefined, p)).toBe(false);
    }
  });

  it("assertPlatform throws a readable error", () => {
    expect(() => assertPlatform("analyst", "orgs:suspend")).toThrow(PlatformForbiddenError);
    expect(() => assertPlatform("superadmin", "orgs:suspend")).not.toThrow();
  });
});

describe("platform role resolution", () => {
  it("parses the bootstrap env leniently", () => {
    expect([...parseSuperadminEnv(" A@x.com, b@y.io;c@z.dev\nnot-an-email ")]).toEqual(["a@x.com", "b@y.io", "c@z.dev"]);
    expect(parseSuperadminEnv(undefined).size).toBe(0);
  });

  it("bootstrap emails are always superadmin, case-insensitively", () => {
    expect(resolvePlatformRole({ email: "Ops@ThePlainTheory.com" }, "ops@theplaintheory.com")).toBe("superadmin");
    expect(resolvePlatformRole({ email: "ops@theplaintheory.com", platformRole: "analyst" }, "ops@theplaintheory.com")).toBe("superadmin");
  });

  it("otherwise uses the stored role, and ignores unknown values", () => {
    expect(resolvePlatformRole({ email: "a@b.co", platformRole: "support" }, "")).toBe("support");
    expect(resolvePlatformRole({ email: "a@b.co" }, "")).toBeNull();
    expect(resolvePlatformRole({ email: "a@b.co", platformRole: "owner" as never }, "")).toBeNull();
    expect(resolvePlatformRole(null, "a@b.co")).toBeNull();
  });
});

describe("staff two-factor requirement", () => {
  it("is bypassed outside production", () => {
    expect(staffMfaProblem({ userHasMfa: false, sessionMfaVerified: false, production: false })).toBeNull();
  });
  it("requires enrolment and a verified session in production", () => {
    expect(staffMfaProblem({ userHasMfa: false, sessionMfaVerified: false, production: true })).toBe("enroll");
    expect(staffMfaProblem({ userHasMfa: true, sessionMfaVerified: false, production: true })).toBe("verify");
    expect(staffMfaProblem({ userHasMfa: true, sessionMfaVerified: true, production: true })).toBeNull();
  });
});

describe("staff role changes", () => {
  const m = (userId: string, role: StaffMember["role"], bootstrap = false): StaffMember => ({ userId, email: `${userId}@pt.example`, role, bootstrap });

  it("blocks changing your own role, even to promote or remove yourself", () => {
    const staff = [m("me", "superadmin"), m("other", "superadmin")];
    expect(staffChangeProblem({ actorUserId: "me", target: staff[0], next: null, staff })).toMatch(/your own/);
    expect(staffChangeProblem({ actorUserId: "me", target: staff[0], next: "support", staff })).toMatch(/your own/);
  });

  it("protects the last superadmin from demotion and removal", () => {
    const staff = [m("me", "superadmin"), m("sole", "superadmin"), m("s", "support")];
    // two superadmins: "me" may demote "sole"
    expect(staffChangeProblem({ actorUserId: "me", target: staff[1], next: "analyst", staff })).toBeNull();
    // only one left after "me" is gone from the list
    const left = [m("sole", "superadmin"), m("s", "support")];
    expect(staffChangeProblem({ actorUserId: "s", target: left[0], next: null, staff: left })).toMatch(/last superadmin/);
    expect(staffChangeProblem({ actorUserId: "s", target: left[0], next: "support", staff: left })).toMatch(/last superadmin/);
  });

  it("leaves bootstrap superadmins to the environment", () => {
    const staff = [m("me", "superadmin"), m("boot", "superadmin", true)];
    expect(staffChangeProblem({ actorUserId: "me", target: staff[1], next: null, staff })).toMatch(/PLATFORM_SUPERADMINS/);
  });

  it("allows granting a new role and rejects no-op or unknown targets", () => {
    const staff = [m("me", "superadmin"), m("s", "support")];
    expect(staffChangeProblem({ actorUserId: "me", target: null, next: "analyst", staff })).toBeNull();
    expect(staffChangeProblem({ actorUserId: "me", target: null, next: null, staff })).toMatch(/isn't on the staff/);
    expect(staffChangeProblem({ actorUserId: "me", target: staff[1], next: "support", staff })).toMatch(/already/);
    expect(staffChangeProblem({ actorUserId: "me", target: staff[1], next: null, staff })).toBeNull();
  });

  it("covers every role", () => {
    expect(PLATFORM_ROLES).toEqual(["superadmin", "support", "analyst"]);
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

  it("lists users", async () => {
    await store.createUser({ id: "usr_a", email: "a@pt.example", name: "A", createdAt: new Date().toISOString() });
    expect((await store.listUsers()).map((u) => u.id)).toContain("usr_a");
  });
});
