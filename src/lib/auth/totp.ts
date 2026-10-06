import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP): HMAC-SHA1, 30-second steps,
 * 6 digits, accepting one step either side for clock drift. No dependencies.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, the size RFC 4226 recommends for HMAC-SHA1. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secretBase32: string, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secretBase32)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

export const totp = (secretBase32: string, nowMs = Date.now()) => hotp(secretBase32, totpStep(nowMs));

const sameDigits = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Check a code against the current step ±1. Returns the matched step so callers can reject reuse of
 * the same (or an older) step, which stops a captured code being replayed inside its window.
 */
export function verifyTotp(secretBase32: string, code: string, opts: { nowMs?: number; lastUsedStep?: number } = {}) {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = totpStep(opts.nowMs);
  for (const step of [current - 1, current, current + 1]) {
    if (opts.lastUsedStep !== undefined && step <= opts.lastUsedStep) continue;
    if (sameDigits(hotp(secretBase32, step), digits)) return step;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "Plain Theory") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ---------- recovery codes ---------- */

const normaliseRecovery = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
export const hashRecoveryCode = (code: string) => createHash("sha256").update(`plain-recovery:${normaliseRecovery(code)}`).digest("hex");

/** Ten single-use codes like "k7m2-q9xd" (8 unbiased picks from 31 symbols, about 40 bits). Only their hashes are stored. */
export function generateRecoveryCodes(count = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const plain = Array.from({ length: count }, () => {
    const chars = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
  return { plain, hashes: plain.map(hashRecoveryCode) };
}

/** Returns the remaining hashes when the code matches one, or null. */
export function consumeRecoveryCode(hashes: string[], code: string) {
  const candidate = Buffer.from(hashRecoveryCode(code));
  let matched = -1;
  hashes.forEach((h, i) => {
    if (h.length === candidate.length && timingSafeEqual(Buffer.from(h), candidate)) matched = i;
  });
  return matched === -1 ? null : hashes.filter((_, i) => i !== matched);
}
