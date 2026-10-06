import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Shared plumbing for the public SDK API (/api/v1/*).
 * Every error uses one envelope: { error: { code, message, fields? } }.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Expose-Headers": "x-plain-country, x-plain-region",
  "Access-Control-Max-Age": "86400",
} as const;

export type ApiErrorCode =
  | "bad_request"
  | "invalid_body"
  | "not_found"
  | "not_published"
  | "forbidden_origin"
  | "rate_limited";

export interface ApiError {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> };
}

export function json<T>(body: T, init: ResponseInit = {}) {
  return NextResponse.json<T>(body, { ...init, headers: { ...CORS_HEADERS, ...(init.headers ?? {}) } });
}

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  invalid_body: 400,
  not_found: 404,
  not_published: 404,
  forbidden_origin: 403,
  rate_limited: 429,
};

export function apiError(code: ApiErrorCode, message: string, fields?: Record<string, string[]>) {
  const headers: HeadersInit = code === "rate_limited" ? { "Retry-After": "60" } : {};
  return json<ApiError>({ error: { code, message, ...(fields ? { fields } : {}) } }, { status: STATUS[code], headers });
}

const OUTCOME_MESSAGES = {
  not_found: "Unknown site key. Check data-site on the script tag.",
  not_published: "This site isn't published yet. Publish the banner from the dashboard.",
  forbidden_origin: "This website isn't allowed to use that site key. Check the domain in the dashboard.",
} as const;

/** Map a failed domain outcome (see lib/consent.ts) to the standard error response. */
export const outcomeError = (reason: keyof typeof OUTCOME_MESSAGES) => apiError(reason, OUTCOME_MESSAGES[reason]);

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

const MAX_BODY = 8_000;

/**
 * Read and validate a JSON body, whether it arrived as application/json (fetch) or text/plain (sendBeacon).
 * Returns the typed data or a ready-to-return error response.
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse<ApiError> }> {
  const text = await req.text();
  if (text.length > MAX_BODY) return { ok: false, response: apiError("bad_request", "Request body is too large.") };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, response: apiError("bad_request", "Request body must be JSON.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields = z.flattenError(result.error).fieldErrors as Record<string, string[]>;
    return { ok: false, response: apiError("invalid_body", "Some fields are missing or invalid.", fields) };
  }
  return { ok: true, data: result.data };
}

/** Fixed-window limiter, per server instance. Production should also front the API with AWS WAF rate rules. */
const windows = new Map<string, { start: number; count: number }>();
export function rateLimited(key: string, limit = 30, windowMs = 60_000, now = Date.now()) {
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    if (windows.size > 50_000) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  w.count += 1;
  return w.count > limit;
}
