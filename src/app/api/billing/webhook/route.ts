/**
 * The Stripe webhook endpoint registered in the Stripe dashboard points here; the handler lives at
 * /api/stripe/webhook. Same code, same signing secret (STRIPE_WEBHOOK_SECRET).
 */
export { POST } from "@/app/api/stripe/webhook/route";
