import "server-only";
import { randomBytes } from "node:crypto";
import { hashIpWithSalt } from "./crypto";
import { getStore } from "./store";

/**
 * IP hashes stored with records (receipts, audit events, sessions, leads) use a random salt per UTC
 * day, shared by every instance through the store and deleted by TTL about two days later. After that
 * the day's hashes can't be recomputed or reversed by enumerating addresses. Within a day the same
 * network gets the same hash, which is all the records need.
 *
 * Nothing compares stored IP hashes across days: rate limits use ipRateKey (lib/crypto.ts), and the
 * receipt and audit chains hash the stored value, never a recomputed one, so old chains still verify.
 */

const g = globalThis as typeof globalThis & { __ptDailySalts?: Map<string, Promise<string>> };
const cache = () => (g.__ptDailySalts ??= new Map());

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

async function saltFor(day: string): Promise<string> {
  const salts = cache();
  let p = salts.get(day);
  if (!p) {
    p = (async () => {
      try {
        return await (await getStore()).dailySalt(day);
      } catch (e) {
        // Never block a consent decision on this: an instance-local salt still can't be reversed,
        // it just won't match other instances' hashes for the day.
        // Retry the store after a minute rather than on every request.
        console.error("[ip-hash] daily salt unavailable; using an instance-local salt", e);
        setTimeout(() => salts.get(day) === p && salts.delete(day), 60_000).unref?.();
        return randomBytes(32).toString("base64url");
      }
    })();
    // keep today and yesterday only
    for (const k of salts.keys()) if (k < utcDay(new Date(Date.parse(`${day}T00:00:00Z`) - 864e5))) salts.delete(k);
    salts.set(day, p);
  }
  return p;
}

/** The salted daily hash of a truncated IP, for storing with a record. */
export async function dailyIpHash(ip: string | null | undefined, now = new Date()) {
  if (!ip) return "unknown";
  return hashIpWithSalt(ip, await saltFor(utcDay(now)));
}

/** Test hook: forget cached salts. */
export function resetDailySaltCache() {
  g.__ptDailySalts = new Map();
}
