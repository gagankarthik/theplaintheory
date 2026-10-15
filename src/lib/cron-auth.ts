import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Bearer auth for the internal job routes (/api/internal/*), called by Vercel Cron (GET) or another
 * scheduler (POST). The secret is INTERNAL_CRON_SECRET or Vercel's own CRON_SECRET.
 * In development, without INTERNAL_CRON_SECRET, "dev-only-cron-secret" is accepted.
 */
export function cronSecret() {
  const s = process.env.INTERNAL_CRON_SECRET;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-cron-secret";
}

export function cronConfigured() {
  return Boolean(cronSecret() || process.env.CRON_SECRET);
}

export function cronAuthorised(request: Request) {
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  // Vercel Cron sends its own CRON_SECRET; other schedulers use ours
  return [cronSecret(), process.env.CRON_SECRET].some((expected) => {
    if (!expected) return false;
    const b = Buffer.from(expected);
    return given.length === b.length && timingSafeEqual(given, b);
  });
}
