import { after } from "next/server";
import { LeakInput, ipHashFor, recordLeak } from "@/lib/consent";
import { apiError, json, outcomeError, parseBody, preflight, rateLimited } from "@/lib/public-api";

export const OPTIONS = preflight;

/**
 * POST /api/v1/leak — the SDK saw a tracker request after its category was declined.
 * Sent with sendBeacon (text/plain) so it survives navigation; at most 5 per page view client-side.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, LeakInput);
  if (!parsed.ok) return parsed.response;
  if (rateLimited(`leak:${ipHashFor(req.headers)}`, 20)) return apiError("rate_limited", "Too many leak reports. Try again in a minute.");

  const result = await recordLeak(parsed.data, req.headers);
  if (!result.ok) return outcomeError(result.reason);
  after(() => result.value.followUp().catch((e) => console.error("[webhooks] leak follow-up failed", e)));
  return json({ id: result.value.id }, { status: 201 });
}
