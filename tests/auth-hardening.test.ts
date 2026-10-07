import { describe, expect, it } from "vitest";
import { IP_MAX_ATTEMPTS, LOCK_MS, MAX_FAILURES, WINDOW_MS, allowIpAttempt, isLocked, registerFailure } from "@/lib/auth/lockout";
import { checkPassword } from "@/lib/auth/password-policy";
import { open, seal } from "@/lib/auth/secret-box";
import { signMfaChallenge, signSessionToken, verifyMfaChallenge, verifySessionToken } from "@/lib/auth/token";
import type { User } from "@/lib/types";

describe("password policy", () => {
  it("accepts a long, uncommon passphrase", () => {
    expect(checkPassword("violet harbour lantern 47", "asha@acme.example")).toBeNull();
  });
  it.each([
    ["short", "Tr0ub4dor&3"],
    ["common word with digits", "Password12345"],
    ["common word with symbols", "!!letmein!!2026"],
    ["keyboard sequence", "1234567890"],
    ["alphabet run", "abcdefghijklm"],
    ["single repeated character", "aaaaaaaaaaaaaa"],
  ])("rejects %s", (_, pw) => {
    expect(checkPassword(pw, "someone@example.com")).not.toBeNull();
  });
  it("rejects passwords containing the email name", () => {
    expect(checkPassword("asha.menon-rocks-2026", "asha.menon@acme.example")).toMatch(/email name/);
  });
  it("ignores very short email names", () => {
    expect(checkPassword("tidal-ember-orchard", "ted@acme.example")).toBeNull();
  });
  it("caps length", () => {
    expect(checkPassword("x".repeat(60) + "y".repeat(70))).toMatch(/at most/);
  });
});

describe("account lockout", () => {
  const t0 = Date.parse("2026-10-06T10:00:00Z");
  const fail = (user: Pick<User, "loginFailures" | "lockedUntil">, n: number, start = t0) => {
    let u = user;
    let last = { locked: false } as ReturnType<typeof registerFailure>;
    for (let i = 0; i < n; i++) {
      last = registerFailure(u, start + i * 1000);
      u = { loginFailures: last.loginFailures, lockedUntil: last.lockedUntil };
    }
    return { user: u, last };
  };

  it(`locks on the ${MAX_FAILURES}th failure inside the window`, () => {
    expect(fail({}, MAX_FAILURES - 1).last.locked).toBe(false);
    const { user, last } = fail({}, MAX_FAILURES);
    expect(last.locked).toBe(true);
    expect(isLocked(user, t0 + 10_000)).toBe(true);
    expect(isLocked(user, t0 + 5_000 + LOCK_MS)).toBe(false);
  });

  it("starts a new window once the old one has passed", () => {
    const { user } = fail({}, MAX_FAILURES - 1);
    const next = registerFailure(user, t0 + WINDOW_MS + 60_000);
    expect(next.locked).toBe(false);
    expect(next.loginFailures?.count).toBe(1);
  });

  it("throttles a network after too many attempts", async () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < IP_MAX_ATTEMPTS; i++) expect(await allowIpAttempt(ip, t0 + i)).toBe(true);
    expect(await allowIpAttempt(ip, t0 + IP_MAX_ATTEMPTS)).toBe(false);
    expect(await allowIpAttempt(ip, t0 + WINDOW_MS + IP_MAX_ATTEMPTS + 1)).toBe(true);
  });
});

describe("secret box (MFA secrets at rest)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = seal("JBSWY3DPEHPK3PXP");
    const b = seal("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(open(a)).toBe("JBSWY3DPEHPK3PXP");
  });
  it("detects tampering", () => {
    const [v, iv, tag, ct] = seal("secret").split(":");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => open([v, iv, tag, flipped.toString("base64url")].join(":"))).toThrow();
  });
});

describe("session and MFA tokens", () => {
  const abs = () => Math.floor(Date.now() / 1000) + 3600;

  it("carry the session id and absolute expiry", async () => {
    const token = await signSessionToken({ sid: "ses_1", userId: "usr_1", email: "a@b.co", orgId: "org_1", abs: abs() });
    expect(await verifySessionToken(token)).toMatchObject({ sid: "ses_1", userId: "usr_1", orgId: "org_1" });
  });

  it("reject a session past its absolute lifetime", async () => {
    const token = await signSessionToken({ sid: "ses_1", userId: "usr_1", email: "a@b.co", abs: Math.floor(Date.now() / 1000) - 1 });
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("never accept an MFA challenge as a session, or the reverse", async () => {
    const challenge = await signMfaChallenge("usr_1", "/app");
    expect(await verifySessionToken(challenge)).toBeNull();
    expect(await verifyMfaChallenge(challenge)).toEqual({ userId: "usr_1", next: "/app" });
    const session = await signSessionToken({ sid: "ses_1", userId: "usr_1", email: "a@b.co", abs: abs() });
    expect(await verifyMfaChallenge(session)).toBeNull();
  });

  it("reject tampered tokens", async () => {
    const token = await signSessionToken({ sid: "ses_1", userId: "usr_1", email: "a@b.co", abs: abs() });
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.userId = "usr_2";
    expect(await verifySessionToken([h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join("."))).toBeNull();
  });
});
