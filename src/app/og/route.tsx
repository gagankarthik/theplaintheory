import { ImageResponse } from "next/og";
import { DEFAULT_KICKER, OG_SIZE, OgCard } from "@/lib/og-card";

/**
 * Per-page social preview: /og?title=Pricing&kicker=... Text is length-capped so the endpoint
 * can't be used to render arbitrary long content, and responses are cached at the edge.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clean = (v: string | null, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const title = clean(params.get("title"), 90) || "Consent people understand. Proof auditors accept.";
  const kicker = clean(params.get("kicker"), 90) || DEFAULT_KICKER;
  return new ImageResponse(<OgCard title={title} kicker={kicker} />, {
    ...OG_SIZE,
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
  });
}
