import { open, seal } from "./secret-box";

/**
 * "Trust this browser for 30 days" for the staff console: pure parts (no SDK, no request), so they're
 * unit-tested. Staff two-factor stays REQUIRED in the pool; a trusted browser holds a Cognito
 * remembered device, and Cognito itself replaces the TOTP challenge with a device SRP challenge that
 * only this browser's sealed device secret can answer (staff-cognito.ts). The app never skips a
 * challenge on its own.
 *
 * Off unless STAFF_REMEMBER_DEVICE=1, which needs the staff pool's device tracking deployed first
 * (infra/lib/auth-stack.ts). With it off, sign-in behaves exactly as before: no checkbox, no
 * DEVICE_KEY sent, nothing forgotten.
 */

export const STAFF_DEVICE_COOKIE = "pt_staff_device";
export const STAFF_DEVICE_DAYS = 30;
export const STAFF_DEVICE_SECONDS = STAFF_DEVICE_DAYS * 24 * 60 * 60;

export const staffRememberDeviceEnabled = () => process.env.STAFF_REMEMBER_DEVICE === "1";

/** What Cognito needs to answer its device challenge. */
export interface DeviceSecret {
  deviceKey: string;
  deviceGroupKey: string;
  /** the random SRP password ConfirmDevice registered a verifier for */
  devicePassword: string;
}

export interface TrustedDevice extends DeviceSecret {
  /** whose device it is: the staff-pool sub and email at the time */
  sub: string;
  email: string;
  /** epoch ms */
  trustedAt: number;
  /** epoch ms; the server-side 30-day limit, checked even if the browser keeps the cookie */
  expiresAt: number;
}

/** AES-256-GCM sealed (secret-box.ts): unreadable and tamper-evident in the browser. */
export function sealTrustedDevice(d: DeviceSecret & { sub: string; email: string }, now = Date.now()): string {
  const t: TrustedDevice = {
    deviceKey: d.deviceKey,
    deviceGroupKey: d.deviceGroupKey,
    devicePassword: d.devicePassword,
    sub: d.sub,
    email: d.email.toLowerCase(),
    trustedAt: now,
    expiresAt: now + STAFF_DEVICE_SECONDS * 1000,
  };
  return seal(JSON.stringify({ v: 1, k: "staff-device", ...t }));
}

export type OpenedDevice = { status: "valid"; device: TrustedDevice } | { status: "expired"; device: TrustedDevice } | { status: "invalid" };

/** Cognito device keys look like "<region>_<uuid>". */
const DEVICE_KEY = /^[a-z]{2}(-[a-z]+)+-\d_[0-9a-f-]{36}$/;

/**
 * Open the cookie. "invalid" for anything missing, tampered, from another key or malformed;
 * "expired" (with the device, so it can be forgotten in Cognito) once the 30 days are up.
 */
export function openTrustedDevice(value: string | undefined, now = Date.now()): OpenedDevice {
  if (!value) return { status: "invalid" };
  let d: Partial<TrustedDevice> & { v?: number; k?: string };
  try {
    d = JSON.parse(open(value));
  } catch {
    return { status: "invalid" };
  }
  if (!d || d.v !== 1 || d.k !== "staff-device") return { status: "invalid" };
  const str = (x: unknown, max: number): x is string => typeof x === "string" && x.length > 0 && x.length <= max;
  if (!str(d.deviceKey, 80) || !DEVICE_KEY.test(d.deviceKey) || !str(d.deviceGroupKey, 80) || !str(d.devicePassword, 200) || !str(d.sub, 64) || !str(d.email, 254)) return { status: "invalid" };
  if (typeof d.trustedAt !== "number" || typeof d.expiresAt !== "number" || d.expiresAt - d.trustedAt > STAFF_DEVICE_SECONDS * 1000) return { status: "invalid" };
  const device: TrustedDevice = {
    deviceKey: d.deviceKey,
    deviceGroupKey: d.deviceGroupKey,
    devicePassword: d.devicePassword,
    sub: d.sub,
    email: d.email,
    trustedAt: d.trustedAt,
    expiresAt: d.expiresAt,
  };
  return d.expiresAt <= now ? { status: "expired", device } : { status: "valid", device };
}

/** The cookie: httpOnly, Secure, SameSite=Strict, only sent to /admin, gone after 30 days. */
export function trustedDeviceCookieOptions(secure = process.env.NODE_ENV === "production") {
  return { httpOnly: true, secure, sameSite: "strict" as const, path: "/admin", maxAge: STAFF_DEVICE_SECONDS };
}

/** A remembered device in Cognito that's older than the 30-day trust window (forget it). */
export function deviceTrustLapsed(createdAt: Date | undefined, now = Date.now()): boolean {
  return Boolean(createdAt && now - createdAt.getTime() > STAFF_DEVICE_SECONDS * 1000);
}
