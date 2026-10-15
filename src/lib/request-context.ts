import "server-only";
import { headers } from "next/headers";
import { ipRateKey } from "./crypto";
import { dailyIpHash } from "./ip-hash";

/**
 * Anonymised network and client details. Never the raw IP.
 * - ipHash: daily-salted hash, for storing with audit events and session records.
 * - ipKey: stable keyed hash, for rate limits only (never stored with a record).
 */
export async function requestContext() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
    return { ipHash: await dailyIpHash(ip), ipKey: ipRateKey(ip), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 200) };
  } catch {
    // outside a request (scripts, background jobs)
    return { ipHash: "system", ipKey: "system", userAgent: "system" };
  }
}
