"use client";

import { useState, useTransition } from "react";
import { verifyAuditTrail, type AuditChainCheck } from "@/app/app/audit/actions";
import { Badge, type BadgeTone } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { IconChain } from "@/components/icons";

export interface AuditRow {
  seq: number;
  createdAt: string;
  actor: string;
  system: boolean;
  action: string;
  label: string;
  target: string;
  details: string;
  hash: string;
}

const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }) + " UTC";

const tone = (action: string): BadgeTone =>
  action === "auth.login_failed" || action === "auth.locked" || action.endsWith("deleted") || action.endsWith("removed") || action === "auth.mfa_disabled"
    ? "declined"
    : action.startsWith("auth.")
      ? "neutral"
      : "brand";

export function AuditTable({ rows, footer }: { rows: AuditRow[]; footer: React.ReactNode }) {
  const columns: Column<AuditRow>[] = [
    {
      id: "event",
      header: "Event",
      cell: (r) => (
        <>
          <Badge tone={tone(r.action)}>{r.label}</Badge>
          <span className="mt-1 block font-mono text-[11px] text-ink-3">
            #{r.seq} · {r.action}
          </span>
        </>
      ),
    },
    {
      id: "actor",
      header: "Who",
      cell: (r) => <span className={r.system ? "text-ink-3" : "text-ink"}>{r.actor}</span>,
    },
    {
      id: "target",
      header: "On",
      cell: (r) => (
        <>
          <span className="text-ink">{r.target}</span>
          {r.details ? <span className="block text-xs text-ink-3">{r.details}</span> : null}
        </>
      ),
    },
    { id: "time", header: "When (UTC)", cell: (r) => <span className="whitespace-nowrap tabular-nums text-ink-2">{time(r.createdAt)}</span> },
    {
      id: "hash",
      header: "Hash",
      hideOnMobile: true,
      cell: (r) => (
        <span className="font-mono text-[11px] text-ink-3" title={r.hash}>
          {r.hash.slice(0, 12)}…
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption="Audit events, newest first"
      rows={rows}
      columns={columns}
      rowKey={(r) => String(r.seq)}
      footer={footer}
      minWidth={760}
      empty={<p className="px-5 py-10 text-center text-sm text-ink-3">No events match these filters.</p>}
    />
  );
}

export function VerifyAuditChain() {
  const [result, setResult] = useState<AuditChainCheck | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button variant="ghost" loading={pending} loadingLabel="Verifying" onClick={() => start(async () => setResult(await verifyAuditTrail()))}>
        <IconChain size={18} />
        Verify chain
      </Button>
      <p aria-live="polite" className="text-sm">
        {result ? (
          result.ok ? (
            <span className="text-jade">
              <strong>Intact.</strong> All {result.checked.toLocaleString("en-GB")} events link correctly; none were altered or removed.
            </span>
          ) : result.error ? (
            <span className="text-rose">{result.error}</span>
          ) : (
            <span className="text-rose">
              <strong>Broken at event #{result.brokenAt}.</strong> An event was changed or removed after it was written. Export the log and treat this as a security incident.
            </span>
          )
        ) : null}
      </p>
    </div>
  );
}
