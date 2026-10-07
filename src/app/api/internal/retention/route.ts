import { timingSafeEqual } from "node:crypto";
import { runRetention } from "@/lib/retention";
import { getStore } from "@/lib/store";

/**
 * Daily retention job, called by Vercel Cron (GET, see vercel.json), another scheduler (POST) or `npm run retention`.
 * Auth: `Authorization: Bearer <secret>`, where the secret is INTERNAL_CRON_SECRET or Vercel's CRON_SECRET.
 * Add `?dryRun=1` to report without deleting.
 */
function secret() {
  const s = process.env.INTERNAL_CRON_SECRET;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-cron-secret";
}

function authorised(request: Request) {
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  // Vercel Cron sends its own CRON_SECRET; other schedulers use ours
  return [secret(), process.env.CRON_SECRET].some((expected) => {
    if (!expected) return false;
    const b = Buffer.from(expected);
    return given.length === b.length && timingSafeEqual(given, b);
  });
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!secret() && !process.env.CRON_SECRET) return Response.json({ error: "INTERNAL_CRON_SECRET is not configured." }, { status: 503 });
  if (!authorised(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runRetention(await getStore(), { dryRun });
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
