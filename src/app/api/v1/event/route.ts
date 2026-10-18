import { callerKeyFor, EventInput, recordBannerEvent } from "@/lib/consent";
import { apiError, CORS_HEADERS, outcomeError, parseBody, preflight, rateLimited } from "@/lib/public-api";

export const OPTIONS = preflight;

/** POST /api/v1/event — banner impression or bounce, sent with sendBeacon (text/plain body). */
export async function POST(req: Request) {
  const parsed = await parseBody(req, EventInput);
  if (!parsed.ok) return parsed.response;
  if (await rateLimited(`event:${parsed.data.siteKey}:${callerKeyFor(req.headers)}`, 1200)) return apiError("rate_limited", "Too many events. Try again in a minute.");

  const result = await recordBannerEvent(parsed.data, req.headers);
  if (!result.ok) return outcomeError(result.reason);
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
