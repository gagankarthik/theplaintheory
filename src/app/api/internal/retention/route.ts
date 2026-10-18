import { cronAuthorised, cronConfigured } from "@/lib/cron-auth";
import { runRetention } from "@/lib/retention";
import { getStore } from "@/lib/store";

/**
 * Daily retention job, called by Vercel Cron (GET, see vercel.json), another scheduler (POST) or `npm run retention`.
 * Auth: `Authorization: Bearer <secret>`, where the secret is INTERNAL_CRON_SECRET or Vercel's CRON_SECRET.
 * Add `?dryRun=1` to report without deleting.
 */
// The job works within a 240 s budget (lib/retention.ts); allow the function the platform maximum.
export const maxDuration = 300;

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!cronConfigured()) return Response.json({ error: "INTERNAL_CRON_SECRET is not configured." }, { status: 503 });
  if (!cronAuthorised(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runRetention(await getStore(), { dryRun });
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
