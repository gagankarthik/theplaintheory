"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { verifyPropertyChain } from "@/app/app/sites/[propertyId]/actions";
import { Badge } from "@/components/app/ui/badge";
import { Button } from "@/components/app/ui/button";
import { DateText } from "@/components/app/ui/date-text";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { useToast } from "@/components/app/ui/toast";
import { IconChain, IconChevronRight } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { FRAMEWORK_META } from "@/lib/defaults";
import type { CategoryId, ConsentReceipt } from "@/lib/types";
import { ACTION, CAT_SHORT } from "./receipt-labels";

/** The categories a receipt allowed, in plain words. */
const allowed = (r: ConsentReceipt) => {
  const on = (Object.keys(CAT_SHORT) as CategoryId[]).filter((c) => r.categories[c]);
  return on.length === 1 && on[0] === "essential" ? "Essential only" : on.map((c) => CAT_SHORT[c]).join(", ") || "None";
};

const columns = (propertyId: string): Column<ConsentReceipt>[] => [
  {
    id: "seq",
    header: "Receipt",
    sortValue: (r) => r.seq,
    cell: (r) => (
      // The link's ::after covers the whole row, so a click anywhere opens the receipt; it is the
      // row's one tab stop, and its focus ring outlines the row.
      <Link
        href={`/app/sites/${propertyId}/logs/${r.seq}`}
        className="inline-flex min-h-6 items-center gap-1 font-mono text-xs font-medium tabular-nums text-ink after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
      >
        #{formatNumber(r.seq)}
        <span className="sr-only">, open receipt</span>
        <IconChevronRight size={14} aria-hidden className="text-ink-3 sm:hidden" />
      </Link>
    ),
  },
  { id: "action", header: "Decision", cell: (r) => <Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge> },
  { id: "categories", header: "Allowed", cell: (r) => <span className="text-ink-2">{allowed(r)}</span> },
  {
    id: "notice",
    header: "Notice",
    sortValue: (r) => r.framework,
    cell: (r) => (
      <>
        <span>{FRAMEWORK_META[r.framework].name}</span>
        {r.gpc || r.automated ? (
          <span className="block text-xs text-ink-3">{[r.gpc ? "GPC honoured" : "", r.automated ? "Automated browser" : ""].filter(Boolean).join(" · ")}</span>
        ) : null}
      </>
    ),
  },
  {
    id: "where",
    header: "Visitor",
    cell: (r) => (
      <>
        <span className="block font-mono text-xs text-ink" title={r.visitorId}>
          {r.visitorId.slice(0, 10)}
        </span>
        <span className="block text-xs text-ink-3">
          {r.country}, <span className="capitalize">{r.device}</span>
          {r.language ? `, ${r.language}` : ""}
        </span>
      </>
    ),
  },
  {
    id: "hash",
    header: "Hash",
    hideOnMobile: true,
    cell: (r) => (
      <code className="font-mono text-xs text-ink-3" title={`hash ${r.hash}\nprev ${r.prevHash}`}>
        {r.hash.slice(0, 8)}…{r.hash.slice(-4)}
      </code>
    ),
  },
  {
    id: "time",
    header: "Recorded",
    numeric: true,
    sortValue: (r) => r.timestamp,
    cell: (r) => <DateText iso={r.timestamp} mode="datetime" className="whitespace-nowrap text-ink-2" />,
  },
];

export function LogsTable({ propertyId, rows, footer, empty = "No receipts in this range." }: { propertyId: string; rows: ConsentReceipt[]; footer: React.ReactNode; empty?: React.ReactNode }) {
  const cols = useMemo(() => columns(propertyId), [propertyId]);
  return (
    <DataTable
      caption="Consent receipts, newest first"
      rows={rows}
      columns={cols}
      rowKey={(r) => r.id}
      minWidth={920}
      maxHeight="min(70dvh, 760px)"
      empty={empty}
      footer={footer}
      rowClassName={() => "relative cursor-pointer"}
    />
  );
}

/**
 * Re-hashes the whole chain on demand. The result is saved on the site as its last check, so the
 * "Chain" number above the log updates on refresh (and a broken chain shows as an alert there); a
 * toast says what was found. Secondary: the log's main job is reading receipts.
 */
export function VerifyChainButton({ propertyId, receipts }: { propertyId: string; receipts: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={!receipts}
      title={receipts ? undefined : "Nothing to verify until the first receipt is recorded"}
      loading={pending}
      loadingLabel="Verifying"
      onClick={() =>
        start(async () => {
          const r = await verifyPropertyChain(propertyId);
          if (r.ok) toast(`Chain intact. All ${formatNumber(r.checked)} receipts link correctly; none were altered or removed.`);
          else if (r.error) toast(r.error, "error");
          else toast(`Chain broken at receipt #${formatNumber(r.brokenAt ?? 0)}. A record was changed or removed after it was written. Export the log and contact support.`, "error");
          router.refresh();
        })
      }
    >
      <IconChain size={18} aria-hidden />
      Verify chain
    </Button>
  );
}
