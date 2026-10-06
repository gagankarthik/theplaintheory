import { anchorsFor } from "@/lib/anchors";
import { SiteKey } from "@/lib/consent";
import { apiError, json, outcomeError, preflight } from "@/lib/public-api";
import { getStore } from "@/lib/store";

export const OPTIONS = preflight;

/**
 * GET /api/v1/anchors/:siteKey — daily chain anchors for the last 30 days plus the current head.
 * Public by design: hashes reveal nothing about visitors, and anyone (an auditor, the Board) can
 * record them to check later that the log was never rewritten.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await ctx.params;
  if (!SiteKey.safeParse(siteKey).success) return apiError("bad_request", "That isn't a valid site key.");
  const property = await (await getStore()).getPropertyBySiteKey(siteKey);
  if (!property) return outcomeError("not_found");

  const { head, anchors } = await anchorsFor(property.id, 30);
  return json(
    { site: property.domain, algorithm: "sha256-chain", generatedAt: new Date().toISOString(), head, anchors },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
