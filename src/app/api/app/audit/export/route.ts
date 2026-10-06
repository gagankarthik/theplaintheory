import { z } from "zod";
import { recordAudit, verifyAuditChain } from "@/lib/audit";
import { guardOrg } from "@/lib/auth/route-guard";
import { csvResponse, csvRow } from "@/lib/csv";
import { getStore } from "@/lib/store";

const query = z.object({
  action: z.string().regex(/^[a-z_.]{1,40}$/).optional(),
  actor: z.string().max(80).optional(),
});

const HEADER = ["seq", "event_id", "timestamp_utc", "actor_user_id", "actor_email", "action", "target_type", "target_id", "target_label", "metadata", "ip_hash", "user_agent", "prev_hash", "hash"];

/** The organization's audit trail as CSV, oldest first, with the chain verdict as a trailing comment. */
export async function GET(request: Request) {
  const g = await guardOrg("audit:read");
  if (!g.ok) return g.response;
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Unknown filter." }, { status: 400 });
  const store = await getStore();
  const all = await store.listAudit(g.org.id);
  const check = verifyAuditChain(all);
  const rows = all
    .filter((e) => !parsed.data.action || e.action === parsed.data.action || e.action.startsWith(`${parsed.data.action}.`))
    .filter((e) => !parsed.data.actor || e.actorUserId === parsed.data.actor)
    .sort((a, b) => a.seq - b.seq);

  await recordAudit({
    orgId: g.org.id,
    actor: { userId: g.user.id, email: g.user.email },
    action: "audit.exported",
    target: { type: "org", id: g.org.id, label: g.org.name },
    metadata: { rows: rows.length, action: parsed.data.action ?? null, actor: parsed.data.actor ?? null, chainOk: check.ok },
  });

  const lines = rows.map((e) =>
    csvRow([
      e.seq,
      e.id,
      e.createdAt,
      e.actorUserId,
      e.actorEmail,
      e.action,
      e.target.type,
      e.target.id,
      e.target.label,
      e.metadata ? JSON.stringify(e.metadata) : "",
      e.ipHash,
      e.userAgent,
      e.prevHash,
      e.hash,
    ]),
  );
  const verdict = check.ok ? `chain intact; head ${check.head}` : `chain BROKEN at seq ${check.brokenAt}`;
  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`audit-log-${day}.csv`, HEADER, lines, `${verdict}; ${check.checked} events verified at ${new Date().toISOString()}`);
}
