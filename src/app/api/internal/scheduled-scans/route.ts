import { cronAuthorised, cronConfigured } from "@/lib/cron-auth";
import { drainWebhookRetries } from "@/lib/webhooks";
import { runScheduledScans } from "@/lib/scheduled-scans";
import { getStore } from "@/lib/store";

/**
 * Daily scheduled tracker scans, called by Vercel Cron (GET, see vercel.json) or another scheduler (POST).
 * Auth: `Authorization: Bearer <secret>`, where the secret is INTERNAL_CRON_SECRET or Vercel's CRON_SECRET.
 * Starts a scan for every site whose weekly or monthly schedule is due, then moves its next due time on.
 * Add `?dryRun=1` to list the due sites without starting anything.
 */

// fetch-engine scans run in-process; lib/scheduled-scans.ts stops starting new ones before this
export const maxDuration = 300;

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!cronConfigured()) return Response.json({ error: "INTERNAL_CRON_SECRET is not configured." }, { status: 503 });
  if (!cronAuthorised(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runScheduledScans(await getStore(), { dryRun });
  // Backstop for the webhook retry outbox when no per-minute scheduler is configured.
  const webhooks = await drainWebhookRetries({ budgetMs: 30_000 }).catch((e) => ({ error: String(e) }));
  return Response.json({ ...report, webhooks }, { headers: { "cache-control": "no-store" } });
}
