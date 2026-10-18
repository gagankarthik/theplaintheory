import { after } from "next/server";
import { callerKeyFor, ConsentInput, recordConsent } from "@/lib/consent";
import { anyRateLimited, apiError, json, outcomeError, parseBody, preflight } from "@/lib/public-api";

export const OPTIONS = preflight;

/** POST /api/v1/consent — record a consent decision as a hash-chained receipt. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, ConsentInput);
  if (!parsed.ok) return parsed.response;
  // Per visitor (stops one page spamming) and per address on this site (stops floods, with room for
  // a whole carrier-NAT pool behind one IP). The SDK retries a 429, so a receipt is delayed, not lost.
  const { siteKey, visitorId } = parsed.data;
  const caller = callerKeyFor(req.headers);
  if (await anyRateLimited([[`consent:v:${siteKey}:${visitorId}`, 10], [`consent:ip:${siteKey}:${caller}`, 600]])) {
    return apiError("rate_limited", "Too many consent requests. Try again in a minute.");
  }

  const result = await recordConsent(parsed.data, req.headers);
  if (!result.ok) return outcomeError(result.reason);
  const { followUp, ...receipt } = result.value;
  // Webhook propagation never delays the visitor's page.
  after(() => followUp().catch((e) => console.error("[webhooks] consent follow-up failed", e)));
  return json(receipt, { status: 201 });
}
