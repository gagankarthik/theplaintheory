import "server-only";
import { createHash } from "node:crypto";
import { createMemoryRateLimiter, type RateLimiter } from "../rate-limit";

/**
 * Limits on e-mails that carry a code (confirmation resends, password resets), on top of the 45 s
 * cooldown per sign-up and Cognito's own per-user limits:
 * - per network (salted IP hash): 10 an hour, reported to the person.
 * - per address: 5 an hour, enforced silently so the answer never says whether an account exists.
 */
const HOUR = 60 * 60 * 1000;

const g = globalThis as typeof globalThis & { __ptCodeLimiters?: { ip: RateLimiter; email: RateLimiter } };
const limiters = () => (g.__ptCodeLimiters ??= { ip: createMemoryRateLimiter({ limit: 10, windowMs: HOUR }), email: createMemoryRateLimiter({ limit: 5, windowMs: HOUR }) });

const emailKey = (email: string) => createHash("sha256").update(`code-mail:${email.trim().toLowerCase()}`).digest("base64url");

/** `network` false: tell the person to wait. `address` false: skip sending but answer as usual. */
export async function allowCodeEmail(ipHash: string, email: string) {
  const { ip, email: perEmail } = limiters();
  const network = await ip.consume(ipHash);
  if (!network.ok) return { network: false as const, address: false, retryAfterMs: network.retryAfterMs };
  const address = await perEmail.consume(emailKey(email));
  return { network: true as const, address: address.ok, retryAfterMs: 0 };
}
