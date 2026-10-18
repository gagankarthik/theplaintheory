import { describe, expect, it } from "vitest";
import { countWithdrawals } from "@/lib/withdrawals";

const all = { essential: true, functional: true, analytics: true, marketing: true };
const none = { essential: true, functional: false, analytics: false, marketing: false };
const r = (visitorId: string, action: "accept_all" | "reject_all" | "custom" | "revoke", categories: typeof all, minute: number) => ({
  visitorId, action, categories, timestamp: new Date(Date.UTC(2026, 9, 18, 9, minute)).toISOString(),
});

describe("countWithdrawals", () => {
  it("counts accept-then-reject and explicit revokes, not first-time declines", () => {
    expect(
      countWithdrawals([
        r("a", "reject_all", none, 2), // a: accept then reject = withdrawal
        r("a", "accept_all", all, 1),
        r("b", "reject_all", none, 1), // b: first decline only
        r("c", "accept_all", all, 1),
        r("c", "custom", { ...all, marketing: false }, 3), // c: narrowed = withdrawal
        r("d", "revoke", none, 4), // d: explicit revoke
      ]),
    ).toBe(3);
  });
});
