import "server-only";
import { createHmac } from "node:crypto";
import * as cognitoIdentity from "amazon-cognito-identity-js";

/**
 * Cognito remembered-device SRP, using AWS's own implementation (AuthenticationHelper from
 * amazon-cognito-identity-js) rather than hand-rolled crypto: the same code Amplify uses to confirm a
 * device and to answer DEVICE_SRP_AUTH / DEVICE_PASSWORD_VERIFIER. This file only adapts its
 * callback API to promises and builds the request fields. Server-side only (the device password is a
 * secret).
 *
 * The protocol (SRP-6a, 3072-bit group, SHA-256), for a device:
 *   "pool name" = DeviceGroupKey, "username" = DeviceKey, "password" = a random device password
 *   ConfirmDevice: salt s, x = H(s | H(groupKey + deviceKey + ":" + password)), verifier v = g^x mod N
 *   sign-in: A = g^a -> Cognito returns B, salt, SECRET_BLOCK -> key = HKDF(S, u) ->
 *            PASSWORD_CLAIM_SIGNATURE = HMAC-SHA256(key, groupKey | deviceKey | SECRET_BLOCK | TIMESTAMP)
 */

/** The parts of the library's BigInteger (jsbn) we touch. */
interface SrpBigInteger {
  toString(radix: number): string;
}
interface SrpBigIntegerCtor {
  new (value: string, radix: number): SrpBigInteger;
}
/** The untyped AuthenticationHelper class (exported by the package, missing from its index.d.ts). */
interface SrpHelper {
  N: SrpBigInteger;
  getLargeAValue(cb: (err: unknown, a: SrpBigInteger) => void): void;
  generateHashDevice(deviceGroupKey: string, deviceKey: string, cb: (err: unknown) => void): void;
  getRandomPassword(): string;
  getSaltDevices(): string;
  getVerifierDevices(): string;
  getPasswordAuthenticationKey(username: string, password: string, serverB: SrpBigInteger, salt: SrpBigInteger, cb: (err: unknown, key: Uint8Array) => void): void;
}

function helper(poolName: string): { h: SrpHelper; BigInteger: SrpBigIntegerCtor } {
  const Ctor = (cognitoIdentity as unknown as { AuthenticationHelper: new (poolName: string) => SrpHelper }).AuthenticationHelper;
  if (typeof Ctor !== "function") throw new Error("amazon-cognito-identity-js AuthenticationHelper is unavailable");
  const h = new Ctor(poolName);
  // The package doesn't export its BigInteger; the helper's own N is one.
  return { h, BigInteger: h.N.constructor as SrpBigIntegerCtor };
}

const promised = <T>(run: (cb: (err: unknown, v: T) => void) => void) =>
  new Promise<T>((resolve, reject) => {
    try {
      run((err, v) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve(v)));
    } catch (e) {
      reject(e);
    }
  });

export interface DeviceVerifier {
  /** the random device password: stays sealed on the server/browser, never sent to Cognito */
  devicePassword: string;
  /** ConfirmDevice's DeviceSecretVerifierConfig */
  config: { PasswordVerifier: string; Salt: string };
}

/** A fresh random device password and the SRP verifier Cognito stores for it (ConfirmDevice). */
export async function createDeviceVerifier(deviceGroupKey: string, deviceKey: string): Promise<DeviceVerifier> {
  const { h } = helper(deviceGroupKey);
  await promised<void>((cb) => h.generateHashDevice(deviceGroupKey, deviceKey, (err) => cb(err, undefined)));
  const devicePassword = h.getRandomPassword();
  const salt = h.getSaltDevices();
  const verifier = h.getVerifierDevices();
  if (!devicePassword || !salt || !verifier) throw new Error("Device verifier generation failed");
  return {
    devicePassword,
    config: { PasswordVerifier: Buffer.from(verifier, "hex").toString("base64"), Salt: Buffer.from(salt, "hex").toString("base64") },
  };
}

/** Cognito's TIMESTAMP format: "ddd MMM D HH:mm:ss UTC YYYY" (day not zero-padded), always UTC, English. */
export function srpTimestamp(d = new Date()): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`;
}

export interface DeviceSrpSession {
  /** SRP_A for the DEVICE_SRP_AUTH challenge response (hex) */
  srpA: string;
  /** Turn Cognito's SRP_B / SALT / SECRET_BLOCK into the DEVICE_PASSWORD_VERIFIER responses. */
  respond(input: { deviceKey: string; devicePassword: string; srpB: string; salt: string; secretBlock: string; now?: Date }): Promise<{ TIMESTAMP: string; PASSWORD_CLAIM_SIGNATURE: string; PASSWORD_CLAIM_SECRET_BLOCK: string }>;
}

/** Start the client side of device SRP for a remembered device (one per sign-in attempt). */
export async function startDeviceSrp(deviceGroupKey: string): Promise<DeviceSrpSession> {
  const { h, BigInteger } = helper(deviceGroupKey);
  const A = await promised<SrpBigInteger>((cb) => h.getLargeAValue(cb));
  return {
    srpA: A.toString(16),
    async respond({ deviceKey, devicePassword, srpB, salt, secretBlock, now }) {
      if (!/^[0-9a-f]+$/i.test(srpB) || !/^[0-9a-f]+$/i.test(salt)) throw new Error("Malformed SRP challenge");
      const key = await promised<Uint8Array>((cb) => h.getPasswordAuthenticationKey(deviceKey, devicePassword, new BigInteger(srpB, 16), new BigInteger(salt, 16), cb));
      const timestamp = srpTimestamp(now);
      const message = Buffer.concat([Buffer.from(deviceGroupKey, "utf8"), Buffer.from(deviceKey, "utf8"), Buffer.from(secretBlock, "base64"), Buffer.from(timestamp, "utf8")]);
      const signature = createHmac("sha256", Buffer.from(key)).update(message).digest("base64");
      return { TIMESTAMP: timestamp, PASSWORD_CLAIM_SIGNATURE: signature, PASSWORD_CLAIM_SECRET_BLOCK: secretBlock };
    },
  };
}
