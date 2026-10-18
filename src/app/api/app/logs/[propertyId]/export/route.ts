import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { guardProperty } from "@/lib/auth/route-guard";
import { chainCheckRecord, fullCheckFrom, verifyLedger } from "@/lib/ledger";
import { filterQuery, hasFieldFilters, matchesReceipt, parseReceiptFilters } from "@/lib/receipt-filters";
import type { CategoryId, ConsentReceipt } from "@/lib/types";

const query = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  action: z.enum(["accept_all", "reject_all", "custom", "revoke", "dismiss"]).optional(),
  framework: z.enum(["gdpr", "ccpa", "dpdpa", "generic"]).optional(),
  visitor: z.string().regex(/^[a-fA-F0-9]{4,64}$/).optional(),
  gpc: z.literal("1").optional(),
});

const CATS: CategoryId[] = ["essential", "functional", "analytics", "marketing"];
// gpc, automated and language were added after the first release, so they go last and older parsers keep working.
const HEADER = [
  "seq",
  "receipt_id",
  "timestamp_utc",
  "visitor_id",
  "action",
  "framework",
  ...CATS.map((c) => `consent_${c}`),
  "country",
  "device",
  "browser",
  "ip_hash",
  "config_version",
  "prev_hash",
  "hash",
  "gpc",
  "automated",
  "language",
];

/** RFC 4180 quoting; also neutralises spreadsheet formula injection. */
function cell(v: string | number | boolean) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (r: ConsentReceipt) =>
  [r.seq, r.id, r.timestamp, r.visitorId, r.action, r.framework, ...CATS.map((c) => (r.categories[c] ? "yes" : "no")), r.country, r.device, r.browser, r.ipHash, r.configVersion, r.prevHash, r.hash, r.gpc ? "yes" : "no", r.automated ? "yes" : "no", r.language ?? ""]
    .map(cell)
    .join(",");

// A large ledger streams for a while: give the export room before the platform cuts it off.
export const maxDuration = 300;

export async function GET(request: Request, ctx: RouteContext<"/api/app/logs/[propertyId]/export">) {
  const { propertyId } = await ctx.params;
  // The log's filter form submits every field, so empty values mean "not filtered".
  const params = Object.fromEntries([...new URL(request.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = query.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Check the filters: from and to must be dates like 2026-10-01." }, { status: 400 });

  const g = await guardProperty(propertyId, "logs:export", "Your role can't export logs.");
  if (!g.ok) return g.response;
  const { property, store, user } = g;

  // The whole chain is verified (from the retention checkpoint) while it streams, a page at a time,
  // oldest first; only the requested window is written. Memory stays flat however long the ledger is.
  const filters = parseReceiptFilters(parsed.data);
  const { from, to } = filters;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode("﻿" + HEADER.join(",") + "\n"));
      let rows = 0;
      try {
        const check = await verifyLedger(store, propertyId, fullCheckFrom(property), (page) => {
          const out = page.filter((r) => matchesReceipt(r, filters));
          rows += out.length;
          if (out.length) controller.enqueue(encoder.encode(out.map(line).join("\n") + "\n"));
        });
        const verifiedAt = new Date().toISOString();
        const verdict = check.ok ? `chain intact; head ${check.head?.hash ?? "none"}` : `chain BROKEN at seq ${check.brokenAt}`;
        controller.enqueue(encoder.encode(`# ${verdict}; ${check.checked} receipts verified at ${verifiedAt}\n`));
        await store.updateProperty(property.id, { lastChainCheck: chainCheckRecord(property, check, verifiedAt) });
        await recordAudit({
          orgId: property.orgId,
          actor: { userId: user.id, email: user.email },
          action: "logs.exported",
          target: { type: "property", id: property.id, label: property.domain },
          metadata: { rows, from: from ?? null, to: to ?? null, filters: hasFieldFilters(filters) ? new URLSearchParams(filterQuery(filters)).toString() : null, chainOk: check.ok },
        });
        controller.close();
      } catch (e) {
        console.error("[export] consent log export failed", property.id, e);
        controller.enqueue(encoder.encode("# export interrupted: try again\n"));
        controller.close();
      }
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
