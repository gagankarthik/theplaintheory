/** Shared, pure data for the chain demo: the server signs it, the browser verifies it. */

export type Decision = "granted" | "declined";

export interface DemoReceipt {
  seq: number;
  time: string;
  notice: string;
  purposes: { id: string; label: string; decision: Decision }[];
  prevHash: string;
  /** hash stored when the receipt was written */
  hash: string;
}

export const GENESIS = "0".repeat(64);

export const DEMO_RECEIPTS: Omit<DemoReceipt, "hash" | "prevHash">[] = [
  {
    seq: 1041,
    time: "2026-09-26T11:15:04Z",
    notice: "GDPR, Germany",
    purposes: [
      { id: "analytics", label: "Analytics", decision: "granted" },
      { id: "marketing", label: "Marketing", decision: "declined" },
    ],
  },
  {
    seq: 1042,
    time: "2026-09-26T11:16:31Z",
    notice: "DPDPA, India",
    purposes: [
      { id: "analytics", label: "Analytics", decision: "declined" },
      { id: "marketing", label: "Marketing", decision: "declined" },
    ],
  },
  {
    seq: 1043,
    time: "2026-09-26T11:18:12Z",
    notice: "CCPA, California",
    purposes: [
      { id: "analytics", label: "Analytics", decision: "granted" },
      { id: "marketing", label: "Sale or sharing", decision: "declined" },
    ],
  },
];

/** Stable string every party hashes. Field order is fixed. */
export function canonical(r: Pick<DemoReceipt, "seq" | "time" | "notice" | "purposes" | "prevHash">) {
  const purposes = r.purposes.map((p) => `${p.id}=${p.decision === "granted" ? 1 : 0}`).join(",");
  return [r.seq, r.time, r.notice, purposes, r.prevHash].join("|");
}
