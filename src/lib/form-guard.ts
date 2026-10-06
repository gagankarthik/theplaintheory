import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./auth/token";
import { FORM_TOKEN_FIELD, HONEYPOT_FIELD } from "./form-guard-fields";

/**
 * Spam protection for public forms without a third-party CAPTCHA.
 *
 * 1. Honeypot: an off-screen field people never see. Anything in it means a bot; the caller
 *    pretends the submission worked so the bot learns nothing.
 * 2. Time trap: a token signed at render with HMAC-SHA256 (key derived from SESSION_SECRET). A form
 *    sent sooner than MIN_AGE_MS after render is too fast for a person; one older than MAX_AGE_MS
 *    is stale. The signature covers the form name, so a token for one form can't be replayed on
 *    another, and a token can't be forged or backdated without the secret.
 */
export const MIN_AGE_MS = 2_500;
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** tolerated clock drift for tokens dated slightly in the future (multiple servers) */
const SKEW_MS = 30_000;

export type FormName = "contact-sales" | "signup";

function sign(form: FormName, payload: string) {
  const key = createHmac("sha256", Buffer.from(sessionSecret())).update("form-guard:v1").digest();
  return createHmac("sha256", key).update(`${form}|${payload}`).digest("base64url");
}

export function issueFormToken(form: FormName, now = Date.now()) {
  const payload = `${now.toString(36)}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(form, payload)}`;
}

export type FormTokenCheck = { ok: true; ageMs: number } | { ok: false; reason: "missing" | "invalid" | "too_fast" | "expired" };

export function verifyFormToken(token: unknown, form: FormName, now = Date.now()): FormTokenCheck {
  if (typeof token !== "string" || !token) return { ok: false, reason: "missing" };
  if (token.length > 200) return { ok: false, reason: "invalid" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [ts, nonce, sig] = parts;
  const expected = Buffer.from(sign(form, `${ts}.${nonce}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };

  const issuedAt = parseInt(ts, 36);
  if (!Number.isFinite(issuedAt)) return { ok: false, reason: "invalid" };
  const ageMs = now - issuedAt;
  if (ageMs < -SKEW_MS) return { ok: false, reason: "invalid" };
  if (ageMs < MIN_AGE_MS) return { ok: false, reason: "too_fast" };
  if (ageMs > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true, ageMs };
}

const RETRY_MESSAGES: Record<Exclude<FormTokenCheck, { ok: true }>["reason"], string> = {
  too_fast: "That was quicker than we expected. Wait a few seconds, then send the form again.",
  expired: "This form was open for more than 2 hours, so we refreshed it. Check your details and send it again.",
  invalid: "We couldn't verify this form. Check your details and send it again.",
  missing: "We couldn't verify this form. Check your details and send it again.",
};

export type GuardResult =
  | { status: "ok" }
  /** honeypot filled: respond as if it worked, store nothing */
  | { status: "bot" }
  /** time trap failed: show `error`, keep the values, render `formToken` for the next try */
  | { status: "retry"; error: string; formToken: string };

export function honeypotFilled(form: FormData) {
  const v = form.get(HONEYPOT_FIELD);
  return typeof v === "string" ? v.trim().length > 0 : v != null;
}

export function checkFormGuard(form: FormData, name: FormName, now = Date.now()): GuardResult {
  if (honeypotFilled(form)) return { status: "bot" };
  const check = verifyFormToken(form.get(FORM_TOKEN_FIELD), name, now);
  if (check.ok) return { status: "ok" };
  // Too fast keeps the original token (it will be old enough on the next try); the rest get a new one.
  const token = check.reason === "too_fast" ? String(form.get(FORM_TOKEN_FIELD)) : issueFormToken(name, now);
  return { status: "retry", error: RETRY_MESSAGES[check.reason], formToken: token };
}
