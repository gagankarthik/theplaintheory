import { z } from "zod";
import { guardOrg } from "@/lib/auth/route-guard";
import { createCheckoutUrl } from "@/lib/billing";
import { planById } from "@/lib/plans";
import { absoluteUrl } from "@/lib/site";

const body = z.object({
  plan: z.enum(["starter", "growth", "business"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
  currency: z.enum(["usd", "eur", "gbp", "inr"]).default("usd"),
});

/** Form POST from the billing page; redirects to Stripe Checkout. */
export async function POST(request: Request) {
  const g = await guardOrg("billing:manage");
  if (!g.ok) return g.response;
  const parsed = body.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ error: "Unknown plan." }, { status: 400 });
  const url = await createCheckoutUrl({
    org: g.org,
    email: g.user.email,
    plan: planById(parsed.data.plan),
    interval: parsed.data.interval,
    currency: parsed.data.currency,
  });
  if (!url) return Response.redirect(absoluteUrl("/app/billing?error=not-configured"), 303);
  return Response.redirect(url, 303);
}
