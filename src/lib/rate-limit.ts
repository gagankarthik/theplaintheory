/**
 * Sliding-window rate limits for public forms.
 *
 * The interface is async so the backing store can vary without touching callers. With
 * STORE_DRIVER=dynamodb the limits are shared atomic counters in the ephemeral table
 * (rate-limit-dynamo.ts), because in-memory windows don't hold across serverless instances; otherwise
 * (local driver, tests) they're held in memory. `setRateLimiterFactory` overrides both.
 * Keys are always salted IP hashes (see anonymizeIp), never raw addresses.
 *
 * Memory store: a per-key log of hit timestamps. Only hits inside the window count, so the limit
 * slides rather than resetting on the hour. Memory is bounded by `maxKeys`.
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  /** hits left in the current window after this one */
  remaining: number;
  /** when blocked, how long until the oldest hit leaves the window; 0 when allowed */
  retryAfterMs: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** most keys held in memory before stale ones are evicted */
  maxKeys?: number;
}

export interface RateLimiter {
  /** Record a hit for `key` if allowed. A blocked hit is not recorded. */
  consume(key: string, now?: number): Promise<RateLimitResult>;
  /** Check without recording. */
  peek(key: string, now?: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export function createMemoryRateLimiter({ limit, windowMs, maxKeys = 10_000 }: RateLimitOptions): RateLimiter {
  if (limit < 1 || windowMs <= 0) throw new Error("Rate limit needs a positive limit and window");
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number) => (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  const result = (log: number[], now: number, ok: boolean): RateLimitResult => ({
    ok,
    limit,
    remaining: Math.max(0, limit - log.length),
    retryAfterMs: ok ? 0 : Math.max(0, log[0] + windowMs - now),
  });

  const evict = (now: number) => {
    if (hits.size <= maxKeys) return;
    for (const [k, log] of hits) if (!log.some((t) => now - t < windowMs)) hits.delete(k);
    // Still over: drop the oldest-inserted keys (Map keeps insertion order).
    for (const k of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(k);
    }
  };

  return {
    async consume(key, now = Date.now()) {
      const log = recent(key, now);
      if (log.length >= limit) {
        hits.set(key, log);
        return result(log, now, false);
      }
      log.push(now);
      hits.delete(key); // re-insert so recently active keys are evicted last
      hits.set(key, log);
      evict(now);
      return result(log, now, true);
    },
    async peek(key, now = Date.now()) {
      const log = recent(key, now);
      return result(log, now, log.length < limit);
    },
    async reset(key) {
      hits.delete(key);
    },
  };
}

const HOUR = 60 * 60 * 1000;

/** Limits per public form, per salted IP hash. `signIn` is the network throttle used by auth/lockout.ts; `staffSignIn` guards /admin/login. */
export const RATE_LIMITS = {
  contactSales: { limit: 5, windowMs: HOUR },
  /** /contact/support, /contact/partners and /contact/enterprise share one window per network */
  contact: { limit: 5, windowMs: HOUR },
  signup: { limit: 10, windowMs: HOUR },
  signIn: { limit: 30, windowMs: 15 * 60 * 1000 },
  /** every staff console sign-in step (password, new password, authenticator codes) per network */
  staffSignIn: { limit: 20, windowMs: 15 * 60 * 1000 },
  /** live site check, per site (the key is the site id, not an IP) */
  siteAudit: { limit: 5, windowMs: HOUR },
  /** tracker scan, per site (the key is the site id) */
  trackerScan: { limit: 6, windowMs: HOUR },
} as const satisfies Record<string, RateLimitOptions>;

export type RateLimitName = keyof typeof RATE_LIMITS;

type Factory = (name: RateLimitName, opts: RateLimitOptions) => RateLimiter;

// Held on globalThis so dev reloads and separately bundled server actions share one window.
const g = globalThis as typeof globalThis & {
  __ptRateLimiters?: Map<RateLimitName, RateLimiter>;
  __ptRateLimiterFactory?: Factory;
};

/** Swap the backing store (e.g. DynamoDB). Clears limiters already created. */
export function setRateLimiterFactory(factory: Factory) {
  g.__ptRateLimiterFactory = factory;
  g.__ptRateLimiters = new Map();
}

/** A DynamoDB-backed limiter, loaded on first use so this module stays free of AWS imports. */
function lazyDynamoLimiter(name: RateLimitName, opts: RateLimitOptions): RateLimiter {
  let impl: Promise<RateLimiter> | undefined;
  const get = () => (impl ??= import("./rate-limit-dynamo").then((m) => m.createDynamoRateLimiter(name, opts)));
  return {
    consume: async (key, now) => (await get()).consume(key, now),
    peek: async (key, now) => (await get()).peek(key, now),
    reset: async (key) => (await get()).reset(key),
  };
}

const defaultFactory: Factory = (name, opts) => (process.env.STORE_DRIVER === "dynamodb" ? lazyDynamoLimiter(name, opts) : createMemoryRateLimiter(opts));

export function rateLimiter(name: RateLimitName): RateLimiter {
  g.__ptRateLimiters ??= new Map();
  let limiter = g.__ptRateLimiters.get(name);
  if (!limiter) {
    const factory = g.__ptRateLimiterFactory ?? defaultFactory;
    limiter = factory(name, RATE_LIMITS[name]);
    g.__ptRateLimiters.set(name, limiter);
  }
  return limiter;
}

/** "about 1 minute", "about 42 minutes" */
export function retryAfterText(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
