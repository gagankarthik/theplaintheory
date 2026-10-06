import { after } from "next/server";
import { ConsentInput, ipHashFor, recordConsent } from "@/lib/consent";
import { apiError, json, outcomeError, parseBody, preflight, rateLimited } from "@/lib/public-api";

export const OPTIONS = preflight;

/** POST /api/v1/consent — record a consent decision as a hash-chained receipt. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, ConsentInput);
  if (!parsed.ok) return parsed.response;
  if (rateLimited(`consent:${ipHashFor(req.headers)}`)) return apiError("rate_limited", "Too many consent requests. Try again in a minute.");

  const result = await recordConsent(parsed.data, req.headers);
  if (!result.ok) return outcomeError(result.reason);
  const { followUp, ...receipt } = result.value;
  // Webhook propagation never delays the visitor's page.
  after(() => followUp().catch((e) => console.error("[webhooks] consent follow-up failed", e)));
  return json(receipt, { status: 201 });
}
