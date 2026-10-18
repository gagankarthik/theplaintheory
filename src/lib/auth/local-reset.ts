import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { sendMail } from "@/lib/mail";
import { site } from "@/lib/site";
import { getStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { CODE_EXPIRED, CODE_MISMATCH } from "./cognito-errors";

/**
 * Password reset for the local auth driver, mirroring what Cognito does for AUTH_DRIVER=cognito: a
 * 6-digit code is e-mailed, works for 15 minutes, once, and dies after five wrong tries. Only an
 * HMAC digest of the code is stored on the user, never the code itself. Callers answer the same way
 * whether or not the address has an account.
 */
export const RESET_CODE_TTL_MS = 15 * 60_000;
export const RESET_MAX_ATTEMPTS = 5;

function digest(userId: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`password-reset:${userId}:${code}`).digest("hex");
}

/** E-mail a fresh code to the account using this address, if there is one with a local password. */
export async function issueLocalReset(email: string): Promise<void> {
  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (!user?.passwordHash) return;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await store.updateUser(user.id, {
    passwordReset: { digest: digest(user.id, code), expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS).toISOString(), attempts: 0 },
  });
  const sent = await sendMail({
    to: user.email,
    subject: `Your ${site.name} password reset code`,
    paragraphs: [
      `Use this code to set a new ${site.name} password: ${code}`,
      "It works once, for the next 15 minutes. If you didn't ask for it, ignore this email: your password stays as it is.",
    ],
  });
  // Local development has no e-mail: print the code where the developer can see it, never in production.
  if (!sent.sent && process.env.NODE_ENV !== "production") console.info(`[auth] password reset code for ${user.email}: ${code} (e-mail isn't configured)`);
}

export type LocalResetCheck = { ok: true; user: User } | { ok: false; kind: "code_mismatch" | "code_expired"; message: string };

/** Check a code against the stored digest. A wrong code counts against the code's tries; a right one is used up. */
export async function checkLocalReset(email: string, code: string): Promise<LocalResetCheck> {
  const store = await getStore();
  const user = await store.getUserByEmail(email);
  const pending = user?.passwordReset;
  if (!user || !pending) return { ok: false, kind: "code_mismatch", message: CODE_MISMATCH };
  if (Date.parse(pending.expiresAt) <= Date.now() || pending.attempts >= RESET_MAX_ATTEMPTS) {
    await store.updateUser(user.id, { passwordReset: undefined });
    return { ok: false, kind: "code_expired", message: CODE_EXPIRED };
  }
  const want = Buffer.from(pending.digest, "hex");
  const got = Buffer.from(digest(user.id, code), "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await store.updateUser(user.id, { passwordReset: { ...pending, attempts: pending.attempts + 1 } });
    return { ok: false, kind: "code_mismatch", message: CODE_MISMATCH };
  }
  return { ok: true, user };
}
