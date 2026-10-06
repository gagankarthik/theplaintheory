import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Field-level encryption for secrets we must be able to read back (TOTP seeds). AES-256-GCM with a
 * key from MFA_ENCRYPTION_KEY (32 bytes, base64) or, failing that, derived from SESSION_SECRET with
 * HKDF so the two never share raw key material. Format: "v1:<iv>:<tag>:<ciphertext>" (base64url).
 */
function key() {
  const explicit = process.env.MFA_ENCRYPTION_KEY;
  if (explicit) {
    const k = Buffer.from(explicit, "base64");
    if (k.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return k;
  }
  const base = process.env.SESSION_SECRET;
  if (!base && process.env.NODE_ENV === "production") throw new Error("Set MFA_ENCRYPTION_KEY or SESSION_SECRET in production");
  return Buffer.from(hkdfSync("sha256", base ?? "dev-only-secret-change-me-dev-only-secret", "plain-theory", "mfa-secret-box-v1", 32));
}

export function seal(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function open(sealed: string) {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
