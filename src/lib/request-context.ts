import "server-only";
import { headers } from "next/headers";
import { anonymizeIp } from "./crypto";

/** Anonymised network and client details for audit events and session records. Never the raw IP. */
export async function requestContext() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
    return { ipHash: anonymizeIp(ip), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 200) };
  } catch {
    // outside a request (scripts, background jobs)
    return { ipHash: "system", userAgent: "system" };
  }
}
