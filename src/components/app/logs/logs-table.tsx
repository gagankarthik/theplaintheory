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

const columns = (propertyId: string): Column<ConsentReceipt>[] => [
  {
    id: "seq",
    header: "Receipt",
    sortValue: (r) => r.seq,
    cell: (r) => (
      <>
        {/* The link's ::after covers the whole row, so any click on it opens the receipt; it is the row's one tab stop. */}
        <Link
          href={`/app/sites/${propertyId}/logs/${r.seq}`}
          className="inline-flex min-h-6 items-center gap-1 rounded font-semibold tabular-nums text-ink after:absolute after:inset-0 after:content-[''] hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          #{formatNumber(r.seq)}
          <span className="sr-only">, open proof of consent</span>
          <IconChevronRight size={14} aria-hidden className="text-ink-3" />
        </Link>
        <DateText iso={r.timestamp} mode="datetime" className="block text-xs text-ink-3" />
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
            <Badge tone={r.categories[c] ? "released" : "held"} icon={<span aria-hidden className="text-2xs">{r.categories[c] ? "✓" : "–"}</span>}>
              {CAT_SHORT[c]}
              <span className="sr-only">{r.categories[c] ? " allowed" : " held"}</span>
            </Badge>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "notice",
    header: "Notice",
    sortValue: (r) => r.framework,
    cell: (r) => (
      <>
        <span>{FRAMEWORK_META[r.framework].name}</span>
        {r.language || r.gpc || r.automated ? (
          <span className="block text-xs text-ink-3">
            {[r.language ? `Shown in ${r.language}` : "", r.gpc ? "GPC honoured" : "", r.automated ? "Automated browser" : ""].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </>
    ),
  },
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

export function LogsTable({ propertyId, rows, footer, empty = "No receipts in this range." }: { propertyId: string; rows: ConsentReceipt[]; footer: React.ReactNode; empty?: React.ReactNode }) {
  const cols = useMemo(() => columns(propertyId), [propertyId]);
  return (
    <DataTable
      caption="Consent receipts, newest first"
      rows={rows}
      columns={cols}
      rowKey={(r) => r.id}
      minWidth={880}
      empty={empty}
      footer={footer}
      rowClassName={() => "relative cursor-pointer"}
    />
  );
}

/**
 * Re-hashes the whole chain on demand. The result is saved on the site as its last check, so the
 * "Chain" number above the log updates on refresh; a toast says what was found. It is the consent
 * log's one primary action: checking the chain is what the log is for.
 */
/** Primary only when there is a chain to check; with no receipts it's a quiet, disabled action. */
export function VerifyChainButton({ propertyId, receipts }: { propertyId: string; receipts: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant={receipts ? "primary" : "ghost"}
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
