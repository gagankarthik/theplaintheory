import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { guardProperty } from "@/lib/auth/route-guard";
import { verifyChain } from "@/lib/crypto";
import type { CategoryId, ConsentReceipt } from "@/lib/types";

const query = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

const CATS: CategoryId[] = ["essential", "functional", "analytics", "marketing"];
const HEADER = ["seq", "receipt_id", "timestamp_utc", "visitor_id", "action", "framework", ...CATS.map((c) => `consent_${c}`), "country", "device", "browser", "ip_hash", "config_version", "prev_hash", "hash"];

/** RFC 4180 quoting; also neutralises spreadsheet formula injection. */
function cell(v: string | number | boolean) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (r: ConsentReceipt) =>
  [r.seq, r.id, r.timestamp, r.visitorId, r.action, r.framework, ...CATS.map((c) => (r.categories[c] ? "yes" : "no")), r.country, r.device, r.browser, r.ipHash, r.configVersion, r.prevHash, r.hash]
    .map(cell)
    .join(",");

export async function GET(request: Request, ctx: RouteContext<"/api/app/logs/[propertyId]/export">) {
  const { propertyId } = await ctx.params;
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "from and to must be dates like 2026-10-01." }, { status: 400 });

  const g = await guardProperty(propertyId, "logs:export", "Your role can't export logs.");
  if (!g.ok) return g.response;
  const { property, store, user } = g;

  // Verify against the full chain, then emit the requested window oldest-first.
  const all = (await store.listReceipts(propertyId)).sort((a, b) => a.seq - b.seq);
  const check = verifyChain(all, property.retentionCheckpoint);
  const { from, to } = parsed.data;
  const rows = all.filter((r) => (!from || r.timestamp >= `${from}T00:00:00.000Z`) && (!to || r.timestamp <= `${to}T23:59:59.999Z`));
  await recordAudit({
    orgId: property.orgId,
    actor: { userId: user.id, email: user.email },
    action: "logs.exported",
    target: { type: "property", id: property.id, label: property.domain },
    metadata: { rows: rows.length, from: from ?? null, to: to ?? null, chainOk: check.ok },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("﻿" + HEADER.join(",") + "\n"));
      for (let i = 0; i < rows.length; i += 500) {
        controller.enqueue(encoder.encode(rows.slice(i, i + 500).map(line).join("\n") + "\n"));
      }
      const verdict = check.ok ? `chain intact; head ${check.head ?? "none"}` : `chain BROKEN at seq ${check.brokenAt}`;
      controller.enqueue(encoder.encode(`# ${verdict}; ${check.checked} receipts verified at ${new Date().toISOString()}\n`));
      controller.close();
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="consent-log-${property.domain}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
