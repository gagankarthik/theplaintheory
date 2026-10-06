import { GENESIS_HASH, hashReceipt } from "@/lib/crypto";
import type { ConsentReceipt } from "@/lib/types";

/** A valid receipt chain, one receipt per day from `start`. */
export function receipts(n: number, startSeq = 1, prev = GENESIS_HASH, start = Date.parse("2026-01-01T00:00:00Z")): ConsentReceipt[] {
  const out: ConsentReceipt[] = [];
  for (let i = 0; i < n; i++) {
    const unsigned = {
      id: `rcpt_${startSeq + i}`,
      propertyId: "prop_1",
      seq: startSeq + i,
      prevHash: prev,
      visitorId: `v_${i}`,
      action: "accept_all",
      framework: "gdpr",
      categories: { essential: true, functional: true, analytics: true, marketing: true },
      country: "DE",
      device: "desktop",
      browser: "Chrome",
      ipHash: "x",
      configVersion: 1,
      timestamp: new Date(start + i * 86_400_000).toISOString(),
    } as Omit<ConsentReceipt, "hash">;
    const r = { ...unsigned, hash: hashReceipt(unsigned) } as ConsentReceipt;
    prev = r.hash;
    out.push(r);
  }
  return out;
}
