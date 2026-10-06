"use client";

import { useState, useTransition } from "react";
import { verifyPropertyChain, type ChainCheck } from "@/app/app/sites/[propertyId]/actions";
import { Badge, type BadgeTone } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { IconChain } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import { FRAMEWORK_META } from "@/lib/defaults";
import type { CategoryId, ConsentAction, ConsentReceipt } from "@/lib/types";

const ACTION: Record<ConsentAction, { label: string; tone: BadgeTone }> = {
  accept_all: { label: "Accepted all", tone: "released" },
  reject_all: { label: "Rejected all", tone: "declined" },
  custom: { label: "Chose some", tone: "neutral" },
  revoke: { label: "Withdrew", tone: "declined" },
  dismiss: { label: "Dismissed", tone: "neutral" },
};
const CAT_SHORT: Record<CategoryId, string> = { essential: "Essential", functional: "Preferences", analytics: "Analytics", marketing: "Marketing" };

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }) + " UTC";

const columns: Column<ConsentReceipt>[] = [
  {
    id: "seq",
    header: "Receipt",
    sortValue: (r) => r.seq,
    cell: (r) => (
      <>
        <span className="font-bold tabular-nums">#{formatInt(r.seq)}</span>
        <time dateTime={r.timestamp} className="block text-xs text-ink-3">
          {time(r.timestamp)}
        </time>
      </>
    ),
  },
  { id: "action", header: "Decision", cell: (r) => <Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge> },
  {
    id: "categories",
    header: "Categories",
    cell: (r) => (
      <ul className="flex flex-wrap gap-1" aria-label="Categories">
        {(Object.keys(CAT_SHORT) as CategoryId[]).map((c) => (
          <li key={c}>
            <Badge tone={r.categories[c] ? "released" : "held"} icon={<span aria-hidden className="text-[10px]">{r.categories[c] ? "✓" : "–"}</span>}>
              {CAT_SHORT[c]}
              <span className="sr-only">{r.categories[c] ? " allowed" : " held"}</span>
            </Badge>
          </li>
        ))}
      </ul>
    ),
  },
  { id: "notice", header: "Notice", sortValue: (r) => r.framework, cell: (r) => FRAMEWORK_META[r.framework].name },
  {
    id: "where",
    header: "Visitor",
    cell: (r) => (
      <>
        <span>
          {r.country}, <span className="capitalize">{r.device}</span>
        </span>
        <span className="block font-mono text-xs text-ink-3" title={r.visitorId}>
          {r.visitorId.slice(0, 10)}
        </span>
      </>
    ),
  },
  {
    id: "hash",
    header: "Hash",
    cell: (r) => (
      <code className="font-mono text-xs text-ink-2" title={`hash ${r.hash}\nprev ${r.prevHash}`}>
        {r.hash.slice(0, 8)}…{r.hash.slice(-4)}
      </code>
    ),
  },
];

export function LogsTable({ rows, footer }: { rows: ConsentReceipt[]; footer: React.ReactNode }) {
  return <DataTable caption="Consent receipts, newest first" rows={rows} columns={columns} rowKey={(r) => r.id} minWidth={880} empty="No receipts in this range." footer={footer} />;
}

export function VerifyChain({ propertyId }: { propertyId: string }) {
  const [result, setResult] = useState<ChainCheck | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button variant="ghost" loading={pending} loadingLabel="Verifying" onClick={() => start(async () => setResult(await verifyPropertyChain(propertyId)))}>
        <IconChain size={18} />
        Verify chain
      </Button>
      <p aria-live="polite" className="text-sm">
        {result ? (
          result.ok ? (
            <span className="text-jade">
              <strong>Intact.</strong> All {formatInt(result.checked)} receipts link correctly; none were altered or removed.
            </span>
          ) : result.error ? (
            <span className="text-rose">{result.error}</span>
          ) : (
            <span className="text-rose">
              <strong>Broken at receipt #{formatInt(result.brokenAt ?? 0)}.</strong> A record was changed or removed after it was written. Export the log and contact support.
            </span>
          )
        ) : null}
      </p>
    </div>
  );
}
