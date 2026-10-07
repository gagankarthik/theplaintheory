import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  STAFF_CHALLENGE_SECONDS,
  STAFF_CODE_MISMATCH,
  STAFF_INVALID,
  STAFF_SESSION_EXPIRED,
  classifyStaffError,
  normaliseTotp,
  openChallenge,
  sealChallenge,
  staffIssuer,
  staffJwksUrl,
  verifyStaffIdToken,
  type StaffAuthOp,
} from "@/lib/auth/staff-auth";
import { STAFF_ABSOLUTE_SECONDS, STAFF_IDLE_SECONDS, safeStaffNext, signStaffToken, staffSessionProblem, staffUserKey, verifyStaffToken } from "@/lib/auth/staff-token";
import { signSessionToken, verifySessionToken } from "@/lib/auth/token";
import type { SessionRecord } from "@/lib/types";

const err = (name: string, message = "") => Object.assign(new Error(message), { name });

describe("staff ID token verification (local JWKS)", () => {
  const region = "ap-south-1";
  const pool = "ap-south-1_TestPool1";
  const issuer = staffIssuer(region, pool);
  const clientId = "staffclient123";
  let sign: (claims: Record<string, unknown>, opts?: { key?: CryptoKey; kid?: string; exp?: number | string; iss?: string; aud?: string }) => Promise<string>;
  let jwks: ReturnType<typeof createLocalJWKSet>;
  let otherKey: CryptoKey;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const other = await generateKeyPair("RS256");
    otherKey = other.privateKey as CryptoKey;
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    jwks = createLocalJWKSet({ keys: [jwk] });
    sign = (claims, o = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: o.kid ?? "k1" })
        .setIssuer(o.iss ?? issuer)
        .setAudience(o.aud ?? clientId)
        .setIssuedAt()
        .setExpirationTime(o.exp ?? "5m")
        .sign(o.key ?? (privateKey as CryptoKey));
  });

  const good = { sub: "11111111-2222-3333-4444-555555555555", token_use: "id", email: "Ops@ThePlainTheory.in", name: "Ops Person", "cognito:groups": ["platform-analyst", "platform-support"] };
  const verify = (t: string) => verifyStaffIdToken(t, { jwks, issuer, clientId });

  it("builds the pool's issuer and JWKS URL", () => {
    expect(issuer).toBe("https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_TestPool1");
    expect(staffJwksUrl(region, pool)).toBe(`${issuer}/.well-known/jwks.json`);
  });

  it("accepts a valid ID token and reads the identity and highest role", async () => {
    expect(await verify(await sign(good))).toEqual({ ok: true, identity: { sub: good.sub, email: "ops@theplaintheory.in", name: "Ops Person", role: "support" } });
  });

  it("falls back to the email name when the token has no name", async () => {
    const r = await verify(await sign({ ...good, name: undefined }));
    expect(r.ok && r.identity.name).toBe("ops");
  });

  it("refuses a staff member without a platform group", async () => {
    expect(await verify(await sign({ ...good, "cognito:groups": ["someone-else"] }))).toEqual({ ok: false, reason: "no_role" });
    expect(await verify(await sign({ ...good, "cognito:groups": undefined }))).toEqual({ ok: false, reason: "no_role" });
  });

  it("rejects the wrong signature, issuer, audience, token use or an expired token", async () => {
    const bad = { ok: false, reason: "invalid_token" };
    expect(await verify(await sign(good, { key: otherKey }))).toEqual(bad);
    expect(await verify(await sign(good, { kid: "unknown" }))).toEqual(bad);
    expect(await verify(await sign(good, { iss: staffIssuer(region, "ap-south-1_Customers") }))).toEqual(bad);
    expect(await verify(await sign(good, { aud: "customerclient" }))).toEqual(bad);
    expect(await verify(await sign({ ...good, token_use: "access" }))).toEqual(bad);
    expect(await verify(await sign(good, { exp: Math.floor(Date.now() / 1000) - 60 }))).toEqual(bad);
    expect(await verify(await sign({ ...good, email: undefined }))).toEqual(bad);
    expect(await verify("not.a.jwt")).toEqual(bad);
  });

  it("rejects an unsigned (alg none) token", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${enc({ alg: "none" })}.${enc({ ...good, iss: issuer, aud: clientId, exp: now + 300 })}.`;
    expect(await verify(unsigned)).toEqual({ ok: false, reason: "invalid_token" });
  });
});

describe("staff sign-in challenge cookie", () => {
  const base = { step: "mfa_setup" as const, email: "a@pt.example", username: "uuid-1", session: "cognito-session-blob", secret: "JBSWY3DPEHPK3PXP", next: "/admin/orgs" };

  it("round-trips sealed, without exposing the session or secret", () => {
    const sealed = sealChallenge(base, 1_000);
    expect(sealed).not.toContain("cognito-session-blob");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(openChallenge(sealed, 2_000)).toEqual({ ...base, expiresAt: 1_000 + STAFF_CHALLENGE_SECONDS * 1000 });
  });

  it("expires with Cognito's 3-minute auth session", () => {
    const sealed = sealChallenge(base, 0);
    expect(openChallenge(sealed, STAFF_CHALLENGE_SECONDS * 1000 - 1)).not.toBeNull();
    expect(openChallenge(sealed, STAFF_CHALLENGE_SECONDS * 1000)).toBeNull();
  });

  it("rejects tampered, foreign or incomplete values", () => {
    const sealed = sealChallenge(base);
    const parts = sealed.split(":");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(openChallenge(parts.join(":"))).toBeNull();
    expect(openChallenge("v1:x:y:z")).toBeNull();
    expect(openChallenge(undefined)).toBeNull();
    expect(openChallenge(sealChallenge({ ...base, secret: undefined }))).toBeNull(); // MFA setup needs its secret
    expect(openChallenge(sealChallenge({ ...base, step: "mfa", secret: undefined }))).toMatchObject({ step: "mfa" });
    expect(openChallenge(sealChallenge({ ...base, session: "" }))).toBeNull();
  });
});

describe("staff sign-in errors", () => {
  const ops: StaffAuthOp[] = ["signIn", "newPassword", "mfaSetup", "mfa"];

  it("never distinguishes unknown, disabled or wrong-password accounts at the password step", () => {
    for (const e of [err("NotAuthorizedException", "Incorrect username or password."), err("NotAuthorizedException", "User is disabled."), err("UserNotFoundException"), err("PasswordResetRequiredException")]) {
      expect(classifyStaffError(e, "signIn")).toMatchObject({ kind: "invalid_credentials", message: STAFF_INVALID });
    }
  });

  it("maps expired sessions and wrong codes", () => {
    expect(classifyStaffError(err("NotAuthorizedException", "Invalid session for the user, session is expired."), "mfa")).toMatchObject({ kind: "session_expired", message: STAFF_SESSION_EXPIRED });
    expect(classifyStaffError(err("CodeMismatchException"), "mfa")).toMatchObject({ kind: "code_mismatch", message: STAFF_CODE_MISMATCH });
    expect(classifyStaffError(err("EnableSoftwareTokenMFAException", "Code mismatch"), "mfaSetup").kind).toBe("code_mismatch");
    expect(classifyStaffError(err("InvalidPasswordException"), "newPassword").kind).toBe("password_policy");
  });

  it("maps throttling everywhere and keeps unknown errors generic", () => {
    for (const op of ops) {
      expect(classifyStaffError(err("TooManyRequestsException"), op).kind).toBe("throttled");
      expect(classifyStaffError(err("NotAuthorizedException", "Password attempts exceeded"), op).kind).toBe("throttled");
      expect(classifyStaffError(err("InternalErrorException", "boom"), op).kind).toBe("unavailable");
    }
  });

  it("normalises TOTP input", () => {
    expect(normaliseTotp("123 456")).toBe("123456");
    expect(normaliseTotp("123-456")).toBe("123456");
    expect(normaliseTotp("12345")).toBeNull();
    expect(normaliseTotp("abcdef")).toBeNull();
    expect(normaliseTotp(null)).toBeNull();
  });
});

describe("staff session token and record", () => {
  const sub = "11111111-2222-3333-4444-555555555555";
  const now = Date.parse("2026-10-07T10:00:00Z");
  const rec = (patch: Partial<SessionRecord> = {}): SessionRecord => ({
    id: "sst_1",
    userId: staffUserKey(sub),
    kind: "staff",
    staff: { sub, email: "a@pt.example", name: "A", role: "billing" },
    createdAt: new Date(now - 60_000).toISOString(),
    lastSeenAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + STAFF_ABSOLUTE_SECONDS * 1000).toISOString(),
    ipHash: "ip",
    userAgent: "ua",
    mfaVerified: true,
    ...patch,
  });

  it("uses 1 hour idle and 8 hours absolute", () => {
    expect(STAFF_IDLE_SECONDS).toBe(3600);
    expect(STAFF_ABSOLUTE_SECONDS).toBe(8 * 3600);
  });

  it("accepts a live staff record and rejects everything else", () => {
    expect(staffSessionProblem(rec(), sub, now)).toBeNull();
    expect(staffSessionProblem(null, sub, now)).toBe("missing");
    expect(staffSessionProblem(rec({ kind: undefined }), sub, now)).toBe("missing"); // a customer session
    expect(staffSessionProblem(rec(), "someone-else", now)).toBe("mismatch");
    expect(staffSessionProblem(rec({ userId: "usr_123" }), sub, now)).toBe("mismatch");
    expect(staffSessionProblem(rec({ staff: { sub, email: "a@pt.example", name: "A", role: "owner" as never } }), sub, now)).toBe("missing");
    expect(staffSessionProblem(rec({ revokedAt: new Date(now).toISOString() }), sub, now)).toBe("revoked");
    expect(staffSessionProblem(rec({ expiresAt: new Date(now).toISOString() }), sub, now)).toBe("expired");
    expect(staffSessionProblem(rec({ lastSeenAt: new Date(now - STAFF_IDLE_SECONDS * 1000 - 1).toISOString() }), sub, now)).toBe("idle");
  });

  it("keeps staff and customer tokens apart", async () => {
    const abs = Math.floor(Date.now() / 1000) + 3600;
    const staffToken = await signStaffToken({ sid: "sst_1", sub, abs });
    const customerToken = await signSessionToken({ sid: "ses_1", userId: "usr_1", email: "a@b.co", abs });
    expect(await verifyStaffToken(staffToken)).toMatchObject({ sid: "sst_1", sub, abs });
    expect(await verifyStaffToken(customerToken)).toBeNull();
    expect(await verifySessionToken(staffToken)).toBeNull();
    expect(await verifyStaffToken(await signStaffToken({ sid: "sst_1", sub, abs: Math.floor(Date.now() / 1000) - 1 }))).toBeNull();
  });

  it("only returns to console pages after sign-in", () => {
    expect(safeStaffNext("/admin/orgs/org_1?tab=x")).toBe("/admin/orgs/org_1?tab=x");
    expect(safeStaffNext("/admin")).toBe("/admin");
    for (const bad of ["/app", "//evil.example/admin", "https://evil.example/admin", "/admin/login", "/admin/login/verify", "/administrator", "/admin\\..\\app", null, 42]) {
      expect(safeStaffNext(bad)).toBe("/admin");
    }
  });
});
