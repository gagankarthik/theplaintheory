import { after } from "next/server";
import { cronAuthorised, cronConfigured } from "@/lib/cron-auth";
import { drainWebhookRetries } from "@/lib/webhooks";

/**
 * Send webhook retries that are due (lib/webhooks.ts outbox). Called every minute by the scheduler
 * (EventBridge, infra), and also after consents and by the daily jobs as a backstop.
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET or CRON_SECRET>`.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!cronConfigured()) return Response.json({ error: "INTERNAL_CRON_SECRET is not configured." }, { status: 503 });
  if (!cronAuthorised(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  // Schedulers wait only a few seconds for an answer (EventBridge: 5 s), so accept now and drain after.
  after(() => drainWebhookRetries({ budgetMs: 45_000 }).catch((e) => console.error("[webhooks] scheduled drain failed", e)));
  return Response.json({ accepted: true }, { status: 202, headers: { "cache-control": "no-store" } });
}
