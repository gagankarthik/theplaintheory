import { z } from "zod";
import { guardOrg } from "@/lib/auth/route-guard";
import { getStripe, priceIdFor } from "@/lib/billing";
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
  const stripe = getStripe();
  const parsed = body.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ error: "Unknown plan." }, { status: 400 });
  const plan = planById(parsed.data.plan);
  const price = priceIdFor(plan, parsed.data.interval);
  if (!stripe || !price) return Response.redirect(absoluteUrl("/app/billing?error=not-configured"), 303);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Each price carries EUR, GBP and INR as Stripe currency options; USD is the default.
    currency: parsed.data.currency,
    line_items: [{ price, quantity: 1 }],
    customer: g.org.stripeCustomerId,
    customer_email: g.org.stripeCustomerId ? undefined : g.user.email,
    client_reference_id: g.org.id,
    metadata: { orgId: g.org.id },
    subscription_data: { metadata: { orgId: g.org.id } },
    allow_promotion_codes: true,
    success_url: absoluteUrl("/app/billing?checkout=success"),
    cancel_url: absoluteUrl("/app/billing?checkout=cancelled"),
  });
  return Response.redirect(session.url!, 303);
}
