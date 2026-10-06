import { timingSafeEqual } from "node:crypto";
import { runRetention } from "@/lib/retention";
import { getStore } from "@/lib/store";

/**
 * Daily retention job, called by a scheduler (EventBridge, Vercel cron) or `npm run retention`.
 * Auth: `Authorization: Bearer $INTERNAL_CRON_SECRET`. Add `?dryRun=1` to report without deleting.
 */
function secret() {
  const s = process.env.INTERNAL_CRON_SECRET;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-cron-secret";
}

function authorised(request: Request) {
  const expected = secret();
  if (!expected) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secret()) return Response.json({ error: "INTERNAL_CRON_SECRET is not configured." }, { status: 503 });
  if (!authorised(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runRetention(await getStore(), { dryRun });
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
