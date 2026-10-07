import { RATE_LIMITS, rateLimiter } from "../rate-limit";
import type { User } from "../types";

/**
 * Brute-force protection (SOC 2 CC6.1). Per account: 5 failures inside 15 minutes lock sign-in for
 * 15 minutes. Per network (salted IP hash): 30 attempts per 15 minutes as a first line of defence,
 * through the shared rate limiter (DynamoDB counters with STORE_DRIVER=dynamodb, memory otherwise).
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;
export const IP_MAX_ATTEMPTS = RATE_LIMITS.signIn.limit;

export function isLocked(user: Pick<User, "lockedUntil">, now = Date.now()) {
  return Boolean(user.lockedUntil && Date.parse(user.lockedUntil) > now);
}

/** The user fields to persist after a failed attempt. */
export function registerFailure(user: Pick<User, "loginFailures">, now = Date.now()): Pick<User, "loginFailures" | "lockedUntil"> & { locked: boolean } {
  const start = user.loginFailures && now - Date.parse(user.loginFailures.windowStart) < WINDOW_MS ? user.loginFailures.windowStart : new Date(now).toISOString();
  const count = (start === user.loginFailures?.windowStart ? user.loginFailures.count : 0) + 1;
  if (count >= MAX_FAILURES) {
    return { loginFailures: undefined, lockedUntil: new Date(now + LOCK_MS).toISOString(), locked: true };
  }
  return { loginFailures: { count, windowStart: start }, lockedUntil: undefined, locked: false };
}

/** Resolves false when this network has made too many attempts recently. Records the attempt. */
export async function allowIpAttempt(ipHash: string, now = Date.now()) {
  return (await rateLimiter("signIn").consume(ipHash, now)).ok;
}
