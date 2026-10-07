import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MFA_GRACE_MS,
  MFA_PROMPT_SNOOZE_MS,
  WEBAUTHN_CHALLENGE_TTL_MS,
  canSkipMfaSetup,
  expectedOriginsFor,
  factorCount,
  hasSecondFactor,
  liveChallenge,
  mfaRequirementState,
  mfaSetupDeadline,
  rpIdFor,
  showMfaPrompt,
  withPasskey,
  withoutFactor,
} from "@/lib/auth/second-factor";
import { generateRecoveryCodes, generateTotpSecret, totp } from "@/lib/auth/totp";
import type { Store } from "@/lib/store/types";
import type { Passkey, User, UserMfa } from "@/lib/types";

const NOW = Date.parse("2026-10-07T10:00:00Z");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const pk = (id: string, extra: Partial<Passkey> = {}): Passkey => ({ id, publicKey: "AQID", counter: 0, name: `Key ${id}`, createdAt: iso(NOW), ...extra });

/* ---------------- data model ---------------- */

describe("second-factor data model", () => {
  const totpOnly: UserMfa = { secretEnc: "v1:x", enabledAt: iso(NOW), recoveryCodes: ["h1"], lastStep: 5 };

  it("counts an authenticator app and each passkey as factors", () => {
    expect(factorCount(undefined)).toBe(0);
    expect(factorCount(totpOnly)).toBe(1);
    expect(factorCount({ ...totpOnly, passkeys: [pk("a"), pk("b")] })).toBe(3);
    expect(factorCount({ enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("a")] })).toBe(1);
    expect(hasSecondFactor({ mfa: totpOnly })).toBe(true);
    expect(hasSecondFactor({})).toBe(false);
  });

  it("the first passkey starts two-factor with new recovery codes; later ones keep the old codes", () => {
    const first = withPasskey(undefined, pk("a"), ["new1", "new2"], new Date(NOW));
    expect(first).toEqual({ enabledAt: iso(NOW), recoveryCodes: ["new1", "new2"], passkeys: [pk("a")] });
    expect(first.secretEnc).toBeUndefined();
    const second = withPasskey(totpOnly, pk("b"), ["ignored"]);
    expect(second.recoveryCodes).toEqual(["h1"]);
    expect(second.secretEnc).toBe("v1:x");
    expect(second.passkeys).toEqual([pk("b")]);
  });

  it("removing one of several factors keeps two-factor on", () => {
    const both = { ...totpOnly, passkeys: [pk("a"), pk("b")] };
    const noApp = withoutFactor(both, { kind: "totp" })!;
    expect(noApp.secretEnc).toBeUndefined();
    expect(noApp.lastStep).toBeUndefined();
    expect(noApp.passkeys).toHaveLength(2);
    expect(noApp.recoveryCodes).toEqual(["h1"]);
    const oneKey = withoutFactor(both, { kind: "passkey", id: "a" })!;
    expect(oneKey.passkeys!.map((p) => p.id)).toEqual(["b"]);
    expect(oneKey.secretEnc).toBe("v1:x");
  });

  it("removing the last factor turns two-factor off", () => {
    expect(withoutFactor(totpOnly, { kind: "totp" })).toBeUndefined();
    expect(withoutFactor({ enabledAt: iso(NOW), recoveryCodes: ["h"], passkeys: [pk("a")] }, { kind: "passkey", id: "a" })).toBeUndefined();
  });
});

/* ---------------- org policy ---------------- */

describe("mfaRequirementState", () => {
  const requiring = { security: { requireMfa: true } };
  const optional = { security: { requireMfa: false } };
  const due = iso(NOW + MFA_GRACE_MS);

  it("is ok when the org doesn't require it or the member has a factor", () => {
    expect(mfaRequirementState(optional, {}, NOW)).toBe("ok");
    expect(mfaRequirementState({}, {}, NOW)).toBe("ok");
    expect(mfaRequirementState(requiring, { mfa: { enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("a")] } }, NOW)).toBe("ok");
  });

  it("is required until the member chooses Skip for now", () => {
    expect(mfaRequirementState(requiring, {}, NOW)).toBe("required");
    // asked once (deadline set) but not skipped
    expect(mfaRequirementState(requiring, { mfaSetupDeferredUntil: due }, NOW)).toBe("required");
  });

  it("is deferred after a skip, until the deadline", () => {
    const skipped = { mfaSetupDeferredUntil: due, mfaSetupSkippedAt: iso(NOW) };
    expect(mfaRequirementState(requiring, skipped, NOW)).toBe("deferred");
    expect(mfaRequirementState(requiring, skipped, NOW + MFA_GRACE_MS - 1)).toBe("deferred");
  });

  it("is required again once the deadline passes, and skipping is no longer offered", () => {
    const skipped = { mfaSetupDeferredUntil: due, mfaSetupSkippedAt: iso(NOW) };
    expect(mfaRequirementState(requiring, skipped, NOW + MFA_GRACE_MS)).toBe("required");
    expect(canSkipMfaSetup(skipped, NOW + MFA_GRACE_MS - 1)).toBe(true);
    expect(canSkipMfaSetup(skipped, NOW + MFA_GRACE_MS)).toBe(false);
    expect(canSkipMfaSetup({}, NOW)).toBe(true);
  });

  it("sets the deadline 7 days after the first prompt and never moves it", () => {
    expect(mfaSetupDeadline({}, NOW)).toBe(due);
    expect(mfaSetupDeadline({ mfaSetupDeferredUntil: due }, NOW + 3 * DAY)).toBe(due);
  });
});

describe("optional prompt", () => {
  it("shows without two-factor and stays away 30 days after Skip for now", () => {
    expect(showMfaPrompt({}, NOW)).toBe(true);
    expect(showMfaPrompt({ mfa: { secretEnc: "v1:x", enabledAt: iso(NOW), recoveryCodes: [] } }, NOW)).toBe(false);
    const dismissed = { mfaPromptDismissedAt: iso(NOW) };
    expect(showMfaPrompt(dismissed, NOW + 29 * DAY)).toBe(false);
    expect(showMfaPrompt(dismissed, NOW + MFA_PROMPT_SNOOZE_MS)).toBe(true);
  });
});

/* ---------------- WebAuthn config and challenges ---------------- */

describe("relying party", () => {
  it("drops a leading www. for the RP ID", () => {
    expect(rpIdFor("https://www.theplaintheory.in")).toBe("theplaintheory.in");
    expect(rpIdFor("https://theplaintheory.in")).toBe("theplaintheory.in");
    expect(rpIdFor("http://localhost:3000")).toBe("localhost");
  });
  it("accepts the site origin and its www/apex twin", () => {
    expect(expectedOriginsFor("https://www.theplaintheory.in")).toEqual(["https://www.theplaintheory.in", "https://theplaintheory.in"]);
    expect(expectedOriginsFor("https://theplaintheory.in")).toEqual(["https://theplaintheory.in", "https://www.theplaintheory.in"]);
    expect(expectedOriginsFor("http://localhost:3000")).toEqual(["http://localhost:3000"]);
  });
});

describe("liveChallenge", () => {
  const stored = { challenge: "abc", purpose: "authenticate" as const, createdAt: iso(NOW) };
  it("returns the challenge only for the same ceremony within 5 minutes", () => {
    expect(liveChallenge(stored, "authenticate", NOW + 1000)).toBe("abc");
    expect(liveChallenge(stored, "register", NOW + 1000)).toBeNull();
    expect(liveChallenge(stored, "authenticate", NOW + WEBAUTHN_CHALLENGE_TTL_MS + 1)).toBeNull();
    expect(liveChallenge(undefined, "authenticate", NOW)).toBeNull();
  });
});

/* ---------------- wiring with the store and a mocked WebAuthn library ---------------- */

const lib = vi.hoisted(() => ({
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: async (o: { excludeCredentials?: unknown[]; rpID: string }) => ({ challenge: `reg-${Math.random()}`, rp: { id: o.rpID }, excludeCredentials: o.excludeCredentials }),
  generateAuthenticationOptions: async (o: { allowCredentials?: unknown[]; rpID: string; userVerification?: string }) => ({
    challenge: `auth-${Math.random()}`,
    rpId: o.rpID,
    allowCredentials: o.allowCredentials,
    userVerification: o.userVerification,
  }),
  verifyRegistrationResponse: lib.verifyRegistrationResponse,
  verifyAuthenticationResponse: lib.verifyAuthenticationResponse,
}));

describe("passkey ceremonies", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pt-passkeys-"));
  let store: Store;
  let pk_: typeof import("@/lib/auth/passkeys");
  let mfa: typeof import("@/lib/auth/mfa");
  const regResponse = { id: "cred1", rawId: "cred1", type: "public-key" as const, response: { clientDataJSON: "e30", attestationObject: "AA" }, clientExtensionResults: {} };
  const authResponse = { id: "cred1", rawId: "cred1", type: "public-key" as const, response: { clientDataJSON: "e30", authenticatorData: "AA", signature: "AA" }, clientExtensionResults: {} };

  const newUser = async (extra: Partial<User> = {}) =>
    store.createUser({ id: `usr_${Math.random().toString(36).slice(2)}`, email: `${Math.random().toString(36).slice(2)}@acme.example`, name: "Asha", createdAt: iso(NOW), ...extra });

  beforeAll(async () => {
    process.env.LOCAL_DATA_DIR = dir;
    vi.resetModules();
    store = (await import("@/lib/store/local")).localStore;
    pk_ = await import("@/lib/auth/passkeys");
    mfa = await import("@/lib/auth/mfa");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    lib.verifyRegistrationResponse.mockReset();
    lib.verifyAuthenticationResponse.mockReset();
  });

  it("registers a first passkey: verifies against the stored challenge, turns two-factor on, returns recovery codes", async () => {
    const user = await newUser();
    const options = await pk_.passkeyRegistrationOptions(user);
    lib.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: { credential: { id: "cred1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } },
    });
    const r = await pk_.verifyPasskeyRegistration(user.id, regResponse, "MacBook");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.firstFactor).toBe(true);
    expect(r.recoveryCodes).toHaveLength(10);
    const call = lib.verifyRegistrationResponse.mock.calls[0][0];
    expect(call.expectedChallenge).toBe(options.challenge);
    expect(call.expectedRPID).toBe("localhost");
    expect(call.expectedOrigin).toEqual(["http://localhost:3000"]);

    const saved = (await store.getUser(user.id))!;
    expect(saved.webauthnChallenge).toBeUndefined();
    expect(saved.mfa?.secretEnc).toBeUndefined();
    expect(saved.mfa?.recoveryCodes).toHaveLength(10);
    expect(saved.mfa?.passkeys).toEqual([{ id: "cred1", publicKey: "AQID", counter: 0, transports: ["internal"], name: "MacBook", createdAt: expect.any(String) }]);
  });

  it("uses a challenge once: a replay finds no challenge", async () => {
    const user = await newUser();
    await pk_.passkeyRegistrationOptions(user);
    lib.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    expect(await pk_.verifyPasskeyRegistration(user.id, regResponse, "x")).toEqual({ ok: false, reason: "invalid" });
    expect(await pk_.verifyPasskeyRegistration(user.id, regResponse, "x")).toEqual({ ok: false, reason: "expired" });
    expect(lib.verifyRegistrationResponse).toHaveBeenCalledTimes(1);
  });

  it("rejects and clears an expired challenge without calling the library", async () => {
    const user = await newUser({ webauthnChallenge: { challenge: "old", purpose: "authenticate", createdAt: iso(Date.now() - WEBAUTHN_CHALLENGE_TTL_MS - 1000) } });
    expect(await pk_.verifyPasskeyAssertion(user.id, authResponse)).toEqual({ ok: false, reason: "expired" });
    expect((await store.getUser(user.id))!.webauthnChallenge).toBeUndefined();
    expect(lib.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("won't accept a registration challenge for a sign-in", async () => {
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("cred1")] } });
    await pk_.passkeyRegistrationOptions(user);
    expect(await pk_.verifyPasskeyAssertion(user.id, authResponse)).toEqual({ ok: false, reason: "expired" });
  });

  it("excludes existing passkeys at registration and lists them at sign-in", async () => {
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("cred1", { transports: ["usb"] })] } });
    const reg = (await pk_.passkeyRegistrationOptions(user)) as unknown as { excludeCredentials: unknown };
    expect(reg.excludeCredentials).toEqual([{ id: "cred1", transports: ["usb"] }]);
    const auth = await pk_.passkeyAuthenticationOptions(user);
    expect(auth.allowCredentials).toEqual([{ id: "cred1", transports: ["usb"] }]);
    expect(auth.userVerification).toBe("preferred");
  });

  it("adding a second passkey keeps the recovery codes and returns none", async () => {
    const codes = generateRecoveryCodes();
    const user = await newUser({ mfa: { secretEnc: "v1:x", enabledAt: iso(NOW), recoveryCodes: codes.hashes } });
    await pk_.passkeyRegistrationOptions(user);
    lib.verifyRegistrationResponse.mockResolvedValue({ verified: true, registrationInfo: { credential: { id: "cred2", publicKey: new Uint8Array([9]), counter: 0 } } });
    const r = await pk_.verifyPasskeyRegistration(user.id, { ...regResponse, id: "cred2", rawId: "cred2" }, "YubiKey");
    expect(r).toMatchObject({ ok: true, firstFactor: false, recoveryCodes: undefined });
    const saved = (await store.getUser(user.id))!;
    expect(saved.mfa?.recoveryCodes).toEqual(codes.hashes);
    expect(saved.mfa?.secretEnc).toBe("v1:x");
  });

  it("verifies a sign-in assertion and updates the counter and last-used date", async () => {
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("cred1", { counter: 4 })] } });
    const options = await pk_.passkeyAuthenticationOptions(user);
    lib.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5, credentialID: "cred1" } });
    const r = await pk_.verifyPasskeyAssertion(user.id, authResponse);
    expect(r.ok).toBe(true);
    const call = lib.verifyAuthenticationResponse.mock.calls[0][0];
    expect(call.expectedChallenge).toBe(options.challenge);
    expect(call.credential).toMatchObject({ id: "cred1", counter: 4 });
    expect(Array.from(call.credential.publicKey)).toEqual([1, 2, 3]);
    const saved = (await store.getUser(user.id))!.mfa!.passkeys![0];
    expect(saved.counter).toBe(5);
    expect(saved.lastUsedAt).toBeTruthy();
  });

  it("flags a counter regression and an unknown credential", async () => {
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: [], passkeys: [pk("cred1", { counter: 9 })] } });
    await pk_.passkeyAuthenticationOptions(user);
    lib.verifyAuthenticationResponse.mockRejectedValue(new Error("Response counter value 3 was lower than expected 9"));
    expect(await pk_.verifyPasskeyAssertion(user.id, authResponse)).toMatchObject({ ok: false, reason: "counter" });
    expect((await store.getUser(user.id))!.mfa!.passkeys![0].counter).toBe(9);

    await pk_.passkeyAuthenticationOptions(user);
    expect(await pk_.verifyPasskeyAssertion(user.id, { ...authResponse, id: "someone-else" })).toEqual({ ok: false, reason: "unknown" });
  });

  it("removing the last passkey turns two-factor off", async () => {
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: ["h"], passkeys: [pk("cred1")] } });
    expect(await mfa.removeFactor(user, { kind: "passkey", id: "cred1" })).toEqual({ stillOn: false });
    expect((await store.getUser(user.id))!.mfa).toBeUndefined();
  });

  it("rejects malformed browser responses", () => {
    expect(pk_.parseAuthenticationJson({ id: "x" })).toBeNull();
    expect(pk_.parseAuthenticationJson({ ...authResponse, type: "password" })).toBeNull();
    expect(pk_.parseAuthenticationJson(authResponse)).not.toBeNull();
  });

  /* ---------- the authenticator-app path is unchanged for existing users ---------- */

  it("an existing TOTP user still verifies with a code and a recovery code", async () => {
    const { seal } = await import("@/lib/auth/secret-box");
    const secret = generateTotpSecret();
    const recovery = generateRecoveryCodes();
    // the record shape stored before passkeys existed
    const user = await newUser({ mfa: { secretEnc: seal(secret), enabledAt: iso(NOW), recoveryCodes: recovery.hashes } });
    const ok = await mfa.verifySecondFactor(user, totp(secret));
    expect(ok).toMatchObject({ ok: true, method: "totp" });
    const fresh = (await store.getUser(user.id))!;
    // the same code can't be replayed
    expect((await mfa.verifySecondFactor(fresh, totp(secret))).ok).toBe(false);
    expect(await mfa.verifySecondFactor(fresh, recovery.plain[0])).toMatchObject({ ok: true, method: "recovery", remaining: 9 });
  });

  it("enrolling an authenticator app: first factor gets recovery codes; alongside a passkey it keeps them", async () => {
    const solo = await newUser();
    const a = await mfa.beginEnrolment(solo);
    const first = await mfa.confirmEnrolment((await store.getUser(solo.id))!, totp(a.secret));
    expect(first).toMatchObject({ ok: true, firstFactor: true });
    if (first.ok) expect(first.recoveryCodes).toHaveLength(10);

    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: ["keep"], passkeys: [pk("cred1")] } });
    const b = await mfa.beginEnrolment(user);
    const second = await mfa.confirmEnrolment((await store.getUser(user.id))!, totp(b.secret));
    expect(second).toMatchObject({ ok: true, firstFactor: false, recoveryCodes: undefined });
    const saved = (await store.getUser(user.id))!.mfa!;
    expect(saved.recoveryCodes).toEqual(["keep"]);
    expect(saved.secretEnc).toBeTruthy();
    expect(saved.passkeys).toHaveLength(1);
  });

  it("a passkey-only user can use a recovery code, and no TOTP code matches", async () => {
    const recovery = generateRecoveryCodes();
    const user = await newUser({ mfa: { enabledAt: iso(NOW), recoveryCodes: recovery.hashes, passkeys: [pk("cred1")] } });
    expect((await mfa.verifySecondFactor(user, "123456")).ok).toBe(false);
    expect(await mfa.verifySecondFactor(user, recovery.plain[1])).toMatchObject({ ok: true, method: "recovery" });
  });
});
