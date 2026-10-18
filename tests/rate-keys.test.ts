import { describe, expect, it } from "vitest";
import { callerRateKey, ipRateKey } from "@/lib/crypto";

describe("rate-limit keys", () => {
  it("separates IPv4 callers in the same /24 (carrier NAT neighbours), unlike the network key", () => {
    expect(callerRateKey("49.36.10.1")).not.toBe(callerRateKey("49.36.10.2"));
    expect(ipRateKey("49.36.10.1")).toBe(ipRateKey("49.36.10.2"));
  });

  it("groups an IPv6 caller by /64, however the address is written", () => {
    const a = callerRateKey("2401:4900:1c2a:7b10:aaaa::1");
    expect(callerRateKey("2401:4900:1c2a:7b10:bbbb:cccc:dddd:eeee")).toBe(a);
    expect(callerRateKey("2401:4900:1c2a:7b10::9")).toBe(a);
    expect(callerRateKey("2401:4900:1c2a:7b11::1")).not.toBe(a);
  });

  it("uses the first address of a forwarded chain and handles a missing one", () => {
    expect(callerRateKey("49.36.10.1, 10.0.0.1")).toBe(callerRateKey("49.36.10.1"));
    expect(callerRateKey(null)).toBe("unknown");
  });
});
