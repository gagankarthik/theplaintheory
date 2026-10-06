import { ipHashFor, SiteKey, VisitorId, visitorReceipts } from "@/lib/consent";
import { apiError, json, outcomeError, preflight, rateLimited } from "@/lib/public-api";

export const OPTIONS = preflight;

/**
 * GET /api/v1/receipts/:visitorId?siteKey=… — a visitor's own consent history (DPDPA summary).
 * The visitor id is a random 128-bit value held only in that browser, so it acts as a bearer token.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/receipts/[visitorId]">) {
  const { visitorId } = await ctx.params;
  const key = SiteKey.safeParse(new URL(req.url).searchParams.get("siteKey"));
  const vid = VisitorId.safeParse(visitorId);
  if (!key.success || !vid.success) return apiError("bad_request", "Pass ?siteKey= and a valid visitor id.");
  if (rateLimited(`receipts:${ipHashFor(req.headers)}`, 20)) return apiError("rate_limited", "Too many requests. Try again in a minute.");

  const result = await visitorReceipts(key.data, vid.data);
  if (!result.ok) return outcomeError(result.reason);
  return json(result.value, { headers: { "Cache-Control": "no-store" } });
}
