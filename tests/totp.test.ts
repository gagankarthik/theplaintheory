import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  totpStep,
  verifyTotp,
} from "@/lib/auth/totp";

// RFC 6238 Appendix B, SHA-1 seed "12345678901234567890". The RFC lists 8-digit values; we use the last 6.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 17]);
    expect(Buffer.from(base32Decode(base32Encode(bytes)))).toEqual(bytes);
  });
  it("encodes the RFC seed as expected", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
  it("ignores spaces, case and padding when decoding", () => {
    expect(Buffer.from(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==")).toString("ascii")).toBe("12345678901234567890");
  });
});

describe("TOTP (RFC 6238)", () => {
  it.each(VECTORS)("t=%i gives %s", (t, code) => {
    expect(totp(RFC_SECRET, t * 1000)).toBe(code);
  });

  it("HOTP counter 0 and 1 match RFC 4226 Appendix D", () => {
    expect(hotp(RFC_SECRET, 0)).toBe("755224");
    expect(hotp(RFC_SECRET, 1)).toBe("287082");
  });

  it("accepts one step of drift either side, not two", () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { nowMs: now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), { nowMs: now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), { nowMs: now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 2), { nowMs: now })).toBeNull();
  });

  it("refuses a code from a step already used (replay)", () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = hotp(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { nowMs: now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { nowMs: now, lastUsedStep: step - 1 })).toBe(step);
  });

  it("rejects malformed codes", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5"]) expect(verifyTotp(RFC_SECRET, bad)).toBeNull();
  });

  it("tolerates spaces in a typed code", () => {
    const now = 1_700_000_000_000;
    const code = totp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { nowMs: now })).not.toBeNull();
  });

  it("generates 160-bit secrets and a standard otpauth URI", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    const uri = new URL(otpauthUri(secret, "asha@example.com"));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Plain Theory:asha@example.com");
    expect(uri.searchParams.get("secret")).toBe(secret);
    expect(uri.searchParams.get("issuer")).toBe("Plain Theory");
    expect(uri.searchParams.get("digits")).toBe("6");
    expect(uri.searchParams.get("period")).toBe("30");
  });
});

describe("recovery codes", () => {
  it("are single use and stored only as hashes", () => {
    const { plain, hashes } = generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);
    for (const p of plain) expect(hashes.join()).not.toContain(p.replace("-", ""));
    const after = consumeRecoveryCode(hashes, plain[3]);
    expect(after).toHaveLength(9);
    expect(consumeRecoveryCode(after!, plain[3])).toBeNull();
  });
  it("accept case and dash variations", () => {
    const { plain, hashes } = generateRecoveryCodes(1);
    expect(consumeRecoveryCode(hashes, plain[0].toUpperCase().replace("-", " "))).toEqual([]);
  });
  it("reject unknown codes", () => {
    const { hashes } = generateRecoveryCodes(2);
    expect(consumeRecoveryCode(hashes, "zzzz-zzzz")).toBeNull();
  });
});
