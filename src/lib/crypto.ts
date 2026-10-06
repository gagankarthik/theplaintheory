import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ConsentReceipt } from "./types";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const GENESIS_HASH = "0".repeat(64);

export function id(prefix: string, bytes = 9) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Drop the host part of the address before hashing (last octet for IPv4, last 80 bits for IPv6),
 * then salt so the hash can't be reversed by enumerating the address space.
 */
export function anonymizeIp(ip: string | null | undefined) {
  if (!ip) return "unknown";
  const raw = ip.split(",")[0].trim();
  let truncated = raw;
  if (raw.includes(".")) truncated = raw.split(".").slice(0, 3).join(".") + ".0";
  else if (raw.includes(":")) truncated = raw.split(":").slice(0, 3).join(":") + "::";
  const salt = process.env.IP_HASH_SALT ?? "plain-dev-salt";
  return sha256(`${salt}:${truncated}`).slice(0, 32);
}

/**
 * Stable field order so the same receipt always produces the same hash.
 *
 * Signal fields (gpc, automated, language) were added after launch. They are appended only when at
 * least one is present, so every receipt written before they existed still hashes to the same value
 * and old chains keep verifying.
 */
export function canonicalReceipt(r: Omit<ConsentReceipt, "hash">) {
  const cats = Object.keys(r.categories)
    .sort()
    .map((k) => `${k}=${r.categories[k as keyof typeof r.categories] ? 1 : 0}`)
    .join(",");
  const base = [
    r.id,
    r.propertyId,
    r.seq,
    r.visitorId,
    r.action,
    r.framework,
    cats,
    r.country,
    r.ipHash,
    r.configVersion,
    r.timestamp,
    r.prevHash,
  ];
  const hasSignals = r.gpc !== undefined || r.automated !== undefined || r.language !== undefined;
  if (hasSignals) base.push(`g=${r.gpc ? 1 : 0}`, `a=${r.automated ? 1 : 0}`, `l=${r.language ?? ""}`);
  return base.join("|");
}

export function hashReceipt(r: Omit<ConsentReceipt, "hash">) {
  return sha256(canonicalReceipt(r));
}

/**
 * Walk a property's receipts in sequence and report the first break in the chain.
 *
 * Without a checkpoint the chain must start at seq 1 from the genesis hash. When the retention job
 * has removed old receipts it leaves a checkpoint (last removed seq + hash); verification then starts
 * there, so expiring old records never breaks tamper evidence for the rest. Gaps in the sequence
 * (deleted receipts) are breaks too. The checkpoint is written before receipts are removed, so a job
 * interrupted between the two steps still verifies.
 */
export function verifyChain(receipts: ConsentReceipt[], checkpoint?: { seq: number; hash: string } | null) {
  // Receipts at or below the checkpoint are retired (a re-run of retention removes any left behind).
  const sorted = receipts.filter((r) => !checkpoint || r.seq > checkpoint.seq).sort((a, b) => a.seq - b.seq);
  let prev = checkpoint?.hash ?? GENESIS_HASH;
  let expectedSeq = (checkpoint?.seq ?? 0) + 1;
  for (const r of sorted) {
    const { hash, ...rest } = r;
    if (r.seq !== expectedSeq || r.prevHash !== prev || hashReceipt(rest) !== hash) {
      return { ok: false as const, brokenAt: r.seq, checked: sorted.length };
    }
    prev = hash;
    expectedSeq += 1;
  }
  return { ok: true as const, checked: sorted.length, head: prev };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, saltB64, keyB64] = stored.split("$");
  if (!saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}
