import { createHash, createHmac, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Staff "trust this browser for 30 days": the sealed cookie, the SRP maths (checked against a
 * simulated Cognito server), and the sign-in state machine choosing the device path or the code
 * path, with Cognito mocked.
 */

process.env.SESSION_SECRET = "test-session-secret-test-session-secret-0123456789";
process.env.COGNITO_STAFF_POOL_ID = "ap-south-1_StaffPool1";
process.env.COGNITO_STAFF_CLIENT_ID = "staffclient123";
process.env.COGNITO_REGION = "ap-south-1";

/* ---------------- a fake Cognito staff pool that speaks device SRP ---------------- */

const N_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";
// BigInt() rather than literals: the project targets ES2017.
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const N = BigInt(`0x${N_HEX}`);
const g = TWO;
const padHex = (x: bigint) => {
  let h = x.toString(16);
  if (h.length % 2) h = `0${h}`;
  return /^[89a-f]/i.test(h) ? `00${h}` : h;
};
const hexHash = (hex: string) => createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex");
const big = (hex: string) => BigInt(`0x${hex}`);
function modPow(base: bigint, exp: bigint, mod: bigint) {
  let r = ONE;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > ZERO) {
    if (e & ONE) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= ONE;
  }
  return r;
}
const k = big(hexHash(padHex(N) + padHex(g)));

/** Server side of SRP-6a as Cognito runs it, written independently of the client library. */
function serverStart(v: bigint) {
  const b = big(randomBytes(32).toString("hex"));
  const B = (k * v + modPow(g, b, N)) % N;
  return { b, B };
}
function serverExpectedSignature(o: { A: bigint; B: bigint; b: bigint; v: bigint; groupKey: string; deviceKey: string; secretBlock: string; timestamp: string }) {
  const u = big(hexHash(padHex(o.A) + padHex(o.B)));
  const S = modPow(o.A * modPow(o.v, u, N), o.b, N);
  const prk = createHmac("sha256", Buffer.from(padHex(u), "hex")).update(Buffer.from(padHex(S), "hex")).digest();
  const key = createHmac("sha256", prk).update(Buffer.concat([Buffer.from("Caldera Derived Key", "utf8"), Buffer.from([1])])).digest().subarray(0, 16);
  return createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(o.groupKey, "utf8"), Buffer.from(o.deviceKey, "utf8"), Buffer.from(o.secretBlock, "base64"), Buffer.from(o.timestamp, "utf8")]))
    .digest("base64");
}

const SUB = "11111111-2222-3333-4444-555555555555";
const EMAIL = "ops@theplaintheory.in";
const PASSWORD = "Correct-horse-9!";
const GROUP_KEY = "-abcdEFGH";
const newDeviceKey = () => `ap-south-1_${crypto.randomUUID()}`;

const err = (name: string, message = "") => Object.assign(new Error(message), { name });

interface FakeDevice {
  key: string;
  verifier?: bigint;
  saltHex?: string;
  remembered: boolean;
  created: Date;
  name?: string;
}

class FakeCognito {
  devices = new Map<string, FakeDevice>();
  calls: { name: string; input: Record<string, unknown> }[] = [];
  srp = new Map<string, { A: bigint; B: bigint; b: bigint; device: FakeDevice; secretBlock: string }>();
  /** Cognito's own decision: only a remembered device replaces the TOTP challenge. */
  issueDeviceOnMfa = true;
  failInitiateWithDevice?: Error;

  names = () => this.calls.map((c) => c.name);

  async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }) {
    const name = cmd.constructor.name.replace(/Command$/, "");
    const input = cmd.input;
    this.calls.push({ name, input });
    const tokens = (extra: Record<string, unknown> = {}) => ({ AuthenticationResult: { IdToken: "id.token", AccessToken: "access.token", RefreshToken: "refresh.token", ...extra } });
    switch (name) {
      case "InitiateAuth": {
        const p = input.AuthParameters as Record<string, string>;
        if (p.PASSWORD !== PASSWORD) throw err("NotAuthorizedException", "Incorrect username or password.");
        if (p.DEVICE_KEY) {
          if (this.failInitiateWithDevice) throw this.failInitiateWithDevice;
          const d = this.devices.get(p.DEVICE_KEY);
          if (d?.remembered) return { ChallengeName: "DEVICE_SRP_AUTH", Session: "s-device", ChallengeParameters: { USERNAME: SUB } };
        }
        return { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "s-mfa", ChallengeParameters: { USER_ID_FOR_SRP: SUB } };
      }
      case "RespondToAuthChallenge": {
        const r = input.ChallengeResponses as Record<string, string>;
        if (input.ChallengeName === "SOFTWARE_TOKEN_MFA") {
          if (r.SOFTWARE_TOKEN_MFA_CODE !== "123456") throw err("CodeMismatchException");
          return this.issueDeviceOnMfa ? tokens({ NewDeviceMetadata: { DeviceKey: newDeviceKey(), DeviceGroupKey: GROUP_KEY } }) : tokens();
        }
        if (input.ChallengeName === "DEVICE_SRP_AUTH") {
          const d = this.devices.get(r.DEVICE_KEY);
          if (!d?.verifier || !d.remembered) throw err("ResourceNotFoundException", "Device does not exist.");
          const { b, B } = serverStart(d.verifier);
          const secretBlock = randomBytes(64).toString("base64");
          this.srp.set("s-verifier", { A: big(r.SRP_A), B, b, device: d, secretBlock });
          return { ChallengeName: "DEVICE_PASSWORD_VERIFIER", Session: "s-verifier", ChallengeParameters: { SRP_B: B.toString(16), SALT: d.saltHex, SECRET_BLOCK: secretBlock, USERNAME: SUB } };
        }
        if (input.ChallengeName === "DEVICE_PASSWORD_VERIFIER") {
          const st = this.srp.get(input.Session as string);
          if (!st || r.DEVICE_KEY !== st.device.key || r.PASSWORD_CLAIM_SECRET_BLOCK !== st.secretBlock) throw err("NotAuthorizedException", "Incorrect device.");
          const expected = serverExpectedSignature({ A: st.A, B: st.B, b: st.b, v: st.device.verifier!, groupKey: GROUP_KEY, deviceKey: st.device.key, secretBlock: st.secretBlock, timestamp: r.TIMESTAMP });
          if (r.PASSWORD_CLAIM_SIGNATURE !== expected) throw err("NotAuthorizedException", "Incorrect device password.");
          return tokens();
        }
        throw new Error(`unexpected challenge ${String(input.ChallengeName)}`);
      }
      case "ConfirmDevice": {
        const c = input.DeviceSecretVerifierConfig as { PasswordVerifier: string; Salt: string };
        const key = input.DeviceKey as string;
        this.devices.set(key, {
          key,
          verifier: big(Buffer.from(c.PasswordVerifier, "base64").toString("hex")),
          saltHex: Buffer.from(c.Salt, "base64").toString("hex"),
          remembered: false,
          created: new Date(),
          name: input.DeviceName as string,
        });
        return { UserConfirmationNecessary: true };
      }
      case "UpdateDeviceStatus": {
        const d = this.devices.get(input.DeviceKey as string);
        if (!d) throw err("ResourceNotFoundException", "Device does not exist.");
        d.remembered = input.DeviceRememberedStatus === "remembered";
        return {};
      }
      case "AdminListDevices": {
        const all = [...this.devices.values()];
        const start = input.PaginationToken ? Number(input.PaginationToken) : 0;
        const page = all.slice(start, start + 2); // small pages, to exercise pagination
        return { Devices: page.map((d) => ({ DeviceKey: d.key, DeviceCreateDate: d.created })), PaginationToken: start + 2 < all.length ? String(start + 2) : undefined };
      }
      case "AdminForgetDevice": {
        if (!this.devices.delete(input.DeviceKey as string)) throw err("ResourceNotFoundException", "Device does not exist.");
        return {};
      }
      case "AdminUserGlobalSignOut":
      case "RevokeToken":
        return {};
      default:
        throw new Error(`unexpected command ${name}`);
    }
  }
}

let fake = new FakeCognito();

vi.mock("@/lib/aws", () => ({ awsRegion: "ap-south-1", cognitoClient: () => fake }));
vi.mock("@/lib/auth/staff-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/staff-auth")>()),
  verifyStaffIdToken: vi.fn(async () => ({ ok: true, identity: { sub: SUB, email: EMAIL, name: "Ops Person", role: "support" } })),
}));

const device = await import("@/lib/auth/staff-device");
const srp = await import("@/lib/auth/cognito-srp");
const staff = await import("@/lib/auth/staff-cognito");
const { sealChallenge } = await import("@/lib/auth/staff-auth");

/* ---------------- the cookie ---------------- */

describe("trusted-browser cookie", () => {
  const secret = { deviceKey: `ap-south-1_${"0".repeat(8)}-1111-2222-3333-444444444444`, deviceGroupKey: GROUP_KEY, devicePassword: "p".repeat(56), sub: SUB, email: "Ops@ThePlainTheory.in" };
  const t0 = Date.UTC(2026, 9, 7, 12);
  const DAY = 24 * 60 * 60 * 1000;

  it("seals and opens, lower-casing the email and setting a 30-day expiry", () => {
    const r = device.openTrustedDevice(device.sealTrustedDevice(secret, t0), t0 + 1000);
    expect(r.status).toBe("valid");
    if (r.status !== "valid") return;
    expect(r.device).toMatchObject({ deviceKey: secret.deviceKey, deviceGroupKey: GROUP_KEY, devicePassword: secret.devicePassword, sub: SUB, email: "ops@theplaintheory.in", trustedAt: t0 });
    expect(r.device.expiresAt - t0).toBe(30 * DAY);
  });

  it("is unreadable in the browser", () => {
    const v = device.sealTrustedDevice(secret, t0);
    expect(v).not.toContain(secret.devicePassword);
    expect(v).not.toContain(secret.deviceKey);
    expect(v).toMatch(/^v1:/);
  });

  it("expires on the server after 30 days, whatever the browser kept", () => {
    const v = device.sealTrustedDevice(secret, t0);
    expect(device.openTrustedDevice(v, t0 + 30 * DAY - 1).status).toBe("valid");
    const late = device.openTrustedDevice(v, t0 + 30 * DAY);
    expect(late.status).toBe("expired");
    // the device comes back so it can be forgotten in Cognito
    expect(late.status === "expired" && late.device.deviceKey).toBe(secret.deviceKey);
  });

  it("rejects tampering, other sealed values and garbage", () => {
    const v = device.sealTrustedDevice(secret, t0);
    const [ver, iv, tag, ct] = v.split(":");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(device.openTrustedDevice([ver, iv, tag, flipped.toString("base64url")].join(":"), t0).status).toBe("invalid");
    const badTag = Buffer.from(tag, "base64url");
    badTag[0] ^= 1;
    expect(device.openTrustedDevice([ver, iv, badTag.toString("base64url"), ct].join(":"), t0).status).toBe("invalid");
    // a sealed sign-in challenge is not a device
    expect(device.openTrustedDevice(sealChallenge({ step: "mfa", email: EMAIL, username: SUB, session: "s" }), t0).status).toBe("invalid");
    expect(device.openTrustedDevice("v1:x:y:z", t0).status).toBe("invalid");
    expect(device.openTrustedDevice("", t0).status).toBe("invalid");
    expect(device.openTrustedDevice(undefined, t0).status).toBe("invalid");
  });

  it("rejects a malformed device key", () => {
    expect(device.openTrustedDevice(device.sealTrustedDevice({ ...secret, deviceKey: "not-a-device" }, t0), t0).status).toBe("invalid");
  });

  it("uses an httpOnly, SameSite=Strict, /admin cookie that lives 30 days (Secure in production)", () => {
    expect(device.trustedDeviceCookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: "strict", path: "/admin", maxAge: 30 * 24 * 60 * 60 });
  });

  it("is off unless STAFF_REMEMBER_DEVICE=1", () => {
    const before = process.env.STAFF_REMEMBER_DEVICE;
    process.env.STAFF_REMEMBER_DEVICE = "";
    expect(device.staffRememberDeviceEnabled()).toBe(false);
    process.env.STAFF_REMEMBER_DEVICE = "true";
    expect(device.staffRememberDeviceEnabled()).toBe(false);
    process.env.STAFF_REMEMBER_DEVICE = "1";
    expect(device.staffRememberDeviceEnabled()).toBe(true);
    process.env.STAFF_REMEMBER_DEVICE = before;
  });

  it("knows when a remembered device has outlived its 30 days", () => {
    expect(device.deviceTrustLapsed(new Date(t0), t0 + 31 * DAY)).toBe(true);
    expect(device.deviceTrustLapsed(new Date(t0), t0 + 29 * DAY)).toBe(false);
    expect(device.deviceTrustLapsed(undefined, t0)).toBe(false);
  });
});

/* ---------------- SRP ---------------- */

describe("device SRP (amazon-cognito-identity-js) against an independent server implementation", () => {
  it("formats TIMESTAMP the way Cognito expects", () => {
    expect(srp.srpTimestamp(new Date(Date.UTC(2026, 9, 7, 9, 5, 3)))).toBe("Wed Oct 7 09:05:03 UTC 2026");
    expect(srp.srpTimestamp(new Date(Date.UTC(2026, 0, 31, 23, 59, 59)))).toBe("Sat Jan 31 23:59:59 UTC 2026");
  });

  it("registers a verifier the server accepts, and only for the right device password", async () => {
    const deviceKey = newDeviceKey();
    const v = await srp.createDeviceVerifier(GROUP_KEY, deviceKey);
    expect(v.devicePassword.length).toBeGreaterThanOrEqual(40);
    const verifier = big(Buffer.from(v.config.PasswordVerifier, "base64").toString("hex"));
    const saltHex = Buffer.from(v.config.Salt, "base64").toString("hex");
    // v = g^x mod N with x = H(salt | H(groupKey + deviceKey + ":" + password))
    const x = big(hexHash(saltHex + createHash("sha256").update(`${GROUP_KEY}${deviceKey}:${v.devicePassword}`).digest("hex")));
    expect(verifier).toBe(modPow(g, x, N));

    const prove = async (password: string) => {
      const session = await srp.startDeviceSrp(GROUP_KEY);
      const A = big(session.srpA);
      const { b, B } = serverStart(verifier);
      const secretBlock = randomBytes(48).toString("base64");
      const now = new Date(Date.UTC(2026, 9, 7, 9, 5, 3));
      const out = await session.respond({ deviceKey, devicePassword: password, srpB: B.toString(16), salt: saltHex, secretBlock, now });
      expect(out.TIMESTAMP).toBe("Wed Oct 7 09:05:03 UTC 2026");
      expect(out.PASSWORD_CLAIM_SECRET_BLOCK).toBe(secretBlock);
      return out.PASSWORD_CLAIM_SIGNATURE === serverExpectedSignature({ A, B, b, v: verifier, groupKey: GROUP_KEY, deviceKey, secretBlock, timestamp: out.TIMESTAMP });
    };
    expect(await prove(v.devicePassword)).toBe(true);
    expect(await prove(`${v.devicePassword}x`)).toBe(false);
  });

  it("uses a fresh random password and salt for every device", async () => {
    const a = await srp.createDeviceVerifier(GROUP_KEY, newDeviceKey());
    const b = await srp.createDeviceVerifier(GROUP_KEY, newDeviceKey());
    expect(a.devicePassword).not.toBe(b.devicePassword);
    expect(a.config.Salt).not.toBe(b.config.Salt);
  });

  it("refuses a malformed server challenge", async () => {
    const s = await srp.startDeviceSrp(GROUP_KEY);
    await expect(s.respond({ deviceKey: newDeviceKey(), devicePassword: "p", srpB: "zz", salt: "00", secretBlock: "" })).rejects.toThrow();
  });
});

/* ---------------- the sign-in state machine ---------------- */

const challengeFrom = (o: Awaited<ReturnType<typeof staff.staffSignIn>>) => {
  if (o.kind !== "challenge") throw new Error(`expected a challenge, got ${o.kind}`);
  return { ...o.challenge, expiresAt: Date.now() + 60_000 };
};

/** Sign in with a code and tick "trust this browser": returns the sealed-cookie contents. */
async function trustThisBrowser() {
  const c = challengeFrom(await staff.staffSignIn(EMAIL, PASSWORD));
  const o = await staff.staffVerifyMfa(c, "123456", { trust: { deviceName: "Plain Theory staff console, Chrome on Windows" } });
  if (o.kind !== "signed_in" || !o.trusted) throw new Error("expected a trusted sign-in");
  const opened = device.openTrustedDevice(device.sealTrustedDevice({ ...o.trusted, sub: o.identity.sub, email: o.identity.email }));
  if (opened.status !== "valid") throw new Error("cookie didn't open");
  return opened.device;
}

describe("staff sign-in with a trusted browser (Cognito mocked)", () => {
  beforeEach(() => {
    fake = new FakeCognito();
    process.env.STAFF_REMEMBER_DEVICE = "1";
  });

  it("without a trusted device: password, then the authenticator code", async () => {
    const o = await staff.staffSignIn(EMAIL, PASSWORD);
    expect(o).toMatchObject({ kind: "challenge", challenge: { step: "mfa", username: SUB } });
    expect((fake.calls[0].input.AuthParameters as Record<string, string>).DEVICE_KEY).toBeUndefined();
    const done = await staff.staffVerifyMfa(challengeFrom(o), "123456");
    expect(done).toMatchObject({ kind: "signed_in", method: "code" });
    expect(done.kind === "signed_in" && done.trusted).toBeFalsy();
    expect(fake.names()).not.toContain("ConfirmDevice");
  });

  it("ticking the box confirms and remembers the device before the refresh token is revoked", async () => {
    const d = await trustThisBrowser();
    const names = fake.names();
    expect(names.indexOf("ConfirmDevice")).toBeLessThan(names.indexOf("UpdateDeviceStatus"));
    expect(names.indexOf("UpdateDeviceStatus")).toBeLessThan(names.indexOf("RevokeToken"));
    const stored = fake.devices.get(d.deviceKey)!;
    expect(stored.remembered).toBe(true);
    expect(stored.name).toBe("Plain Theory staff console, Chrome on Windows");
    expect(fake.calls.find((c) => c.name === "UpdateDeviceStatus")?.input.DeviceRememberedStatus).toBe("remembered");
  });

  it("a trusted browser answers Cognito's device challenge and skips the code", async () => {
    const d = await trustThisBrowser();
    fake.calls = [];
    const o = await staff.staffSignIn(EMAIL, PASSWORD, "/admin/orgs", { device: d });
    expect(o).toMatchObject({ kind: "signed_in", method: "trusted_device", identity: { sub: SUB } });
    expect(o.droppedDevice).toBeUndefined();
    expect((fake.calls[0].input.AuthParameters as Record<string, string>).DEVICE_KEY).toBe(d.deviceKey);
    const challenges = fake.calls.filter((c) => c.name === "RespondToAuthChallenge").map((c) => c.input.ChallengeName);
    expect(challenges).toEqual(["DEVICE_SRP_AUTH", "DEVICE_PASSWORD_VERIFIER"]);
    expect(fake.names()).toContain("RevokeToken");
  });

  it("the device never replaces the password", async () => {
    const d = await trustThisBrowser();
    fake.calls = [];
    const o = await staff.staffSignIn(EMAIL, "wrong-password-1!", undefined, { device: d });
    expect(o).toMatchObject({ kind: "failed", failure: { kind: "invalid_credentials" } });
    expect(o.droppedDevice).toBeUndefined();
    expect(fake.names()).not.toContain("AdminForgetDevice");
    expect(fake.devices.has(d.deviceKey)).toBe(true);
  });

  it("a forgotten device falls back to the code step and drops the cookie", async () => {
    const d = await trustThisBrowser();
    fake.devices.clear(); // forgotten in Cognito (sign out everywhere elsewhere)
    fake.calls = [];
    const o = await staff.staffSignIn(EMAIL, PASSWORD, undefined, { device: d });
    expect(o).toMatchObject({ kind: "challenge", challenge: { step: "mfa" }, droppedDevice: { reason: "not_remembered", forgotten: true } });
    const inits = fake.calls.filter((c) => c.name === "InitiateAuth").map((c) => (c.input.AuthParameters as Record<string, string>).DEVICE_KEY);
    expect(inits).toEqual([d.deviceKey, undefined]);
  });

  it("a wrong device secret (tampered or stale) falls back to the code step and forgets the device", async () => {
    const d = await trustThisBrowser();
    fake.calls = [];
    const o = await staff.staffSignIn(EMAIL, PASSWORD, undefined, { device: { ...d, devicePassword: `${d.devicePassword}x` } });
    expect(o).toMatchObject({ kind: "challenge", challenge: { step: "mfa" }, droppedDevice: { reason: "device_error", forgotten: true } });
    expect(fake.calls.find((c) => c.name === "AdminForgetDevice")?.input).toMatchObject({ Username: SUB, DeviceKey: d.deviceKey });
    expect(fake.devices.has(d.deviceKey)).toBe(false);
  });

  it("a Cognito device error at the password step falls back too", async () => {
    const d = await trustThisBrowser();
    fake.failInitiateWithDevice = err("ResourceNotFoundException", "Device does not exist.");
    const o = await staff.staffSignIn(EMAIL, PASSWORD, undefined, { device: d });
    expect(o).toMatchObject({ kind: "challenge", challenge: { step: "mfa" }, droppedDevice: { reason: "device_error" } });
  });

  it("throttling on the device path is reported, not retried, and keeps the device", async () => {
    const d = await trustThisBrowser();
    fake.failInitiateWithDevice = err("TooManyRequestsException");
    fake.calls = [];
    const o = await staff.staffSignIn(EMAIL, PASSWORD, undefined, { device: d });
    expect(o).toMatchObject({ kind: "failed", failure: { kind: "throttled" } });
    expect(fake.names()).toEqual(["InitiateAuth"]);
  });

  it("if Cognito offers no device after the code, sign-in still succeeds, untrusted", async () => {
    fake.issueDeviceOnMfa = false;
    const c = challengeFrom(await staff.staffSignIn(EMAIL, PASSWORD));
    const o = await staff.staffVerifyMfa(c, "123456", { trust: { deviceName: "x" } });
    expect(o).toMatchObject({ kind: "signed_in", method: "code" });
    expect(o.kind === "signed_in" && o.trusted).toBeFalsy();
  });
});

describe("forgetting staff devices (Cognito mocked)", () => {
  beforeEach(() => {
    fake = new FakeCognito();
    process.env.STAFF_REMEMBER_DEVICE = "1";
  });

  it("sign out everywhere signs out of Cognito and forgets every remembered device, across pages", async () => {
    for (let i = 0; i < 5; i++) fake.devices.set(`k${i}`, { key: `k${i}`, remembered: true, created: new Date() });
    const r = await staff.staffGlobalSignOut(SUB);
    expect(r).toEqual({ signedOut: true, devicesForgotten: 5 });
    expect(fake.devices.size).toBe(0);
    expect(fake.names().filter((n) => n === "AdminListDevices").length).toBe(3);
  });

  it("a password reset or disable reports how many devices were forgotten", async () => {
    fake.devices.set("k1", { key: "k1", remembered: true, created: new Date() });
    // AdminSetUserPassword / AdminDisableUser aren't in the fake's script; extend it for this test.
    const send = fake.send.bind(fake);
    fake.send = async (cmd) => (/^Admin(SetUserPassword|DisableUser)Command$/.test(cmd.constructor.name) ? {} : send(cmd));
    expect(await staff.setStaffEnabled(SUB, false)).toEqual({ ok: true, devicesForgotten: 1 });
    expect(await staff.resetStaffPassword(SUB, { deliver: false })).toEqual({ ok: true, devicesForgotten: 0 });
  });

  it("after a sign-in, only devices older than 30 days are forgotten", async () => {
    const now = Date.now();
    fake.devices.set("old", { key: "old", remembered: true, created: new Date(now - 31 * 24 * 60 * 60 * 1000) });
    fake.devices.set("new", { key: "new", remembered: true, created: new Date(now - 2 * 24 * 60 * 60 * 1000) });
    expect(await staff.forgetLapsedStaffDevices(SUB, now)).toBe(1);
    expect([...fake.devices.keys()]).toEqual(["new"]);
  });

  it("does nothing with the feature off", async () => {
    process.env.STAFF_REMEMBER_DEVICE = "";
    fake.devices.set("k1", { key: "k1", remembered: true, created: new Date() });
    expect(await staff.staffGlobalSignOut(SUB)).toEqual({ signedOut: true, devicesForgotten: 0 });
    expect(fake.names()).toEqual(["AdminUserGlobalSignOut"]);
  });

  it("reports an unreadable device list as null rather than 0", async () => {
    const send = fake.send.bind(fake);
    fake.send = async (cmd) => (cmd.constructor.name === "AdminListDevicesCommand" ? Promise.reject(err("AccessDeniedException")) : send(cmd));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await staff.forgetStaffDevices(SUB)).toBeNull();
    spy.mockRestore();
  });
});
