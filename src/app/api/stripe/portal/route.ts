import { guardOrg } from "@/lib/auth/route-guard";
import { getStripe } from "@/lib/billing";
import { portalConfigurationId } from "@/lib/stripe-catalog";
import { absoluteUrl } from "@/lib/site";

/** Opens the Stripe customer portal for invoices, payment methods and cancellation. */
export async function POST() {
  const g = await guardOrg("billing:manage");
  if (!g.ok) return g.response;
  const stripe = getStripe();
  if (!stripe || !g.org.stripeCustomerId) return Response.redirect(absoluteUrl("/app/billing?error=no-customer"), 303);
  const portal = await stripe.billingPortal.sessions.create({
    customer: g.org.stripeCustomerId,
    // Plain Theory's own portal set-up (plan switching, invoices, cancellation), from stripe-sync.
    configuration: await portalConfigurationId(),
    return_url: absoluteUrl("/app/billing"),
  });
  return Response.redirect(portal.url, 303);
}
