import { getPublishedConfig } from "@/lib/consent";
import { json, outcomeError, preflight } from "@/lib/public-api";

export const OPTIONS = preflight;

/**
 * GET /api/v1/config/:siteKey — the published banner config.
 * Local stand-in for CloudFront's c/<siteKey>.json, with the same geo headers the edge function adds.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/config/[siteKey]">) {
  const { siteKey } = await ctx.params;
  const result = await getPublishedConfig(siteKey, req.headers, new URL(req.url));
  if (!result.ok) return outcomeError(result.reason);

  const { config, country, region } = result.value;
  return json(config, {
    headers: {
      "x-plain-country": country,
      "x-plain-region": region,
      "Cache-Control": "public, max-age=60, stale-while-revalidate=86400",
      Vary: "cloudfront-viewer-country, cloudfront-viewer-country-region",
    },
  });
}
