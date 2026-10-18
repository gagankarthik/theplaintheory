"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Badge } from "@/components/app/ui/badge";
import { ButtonLink } from "@/components/app/ui/button";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { Segmented } from "@/components/app/ui/tabs";
import { formatInt, type LeakGroup } from "@/lib/analytics";
import { FRAMEWORK_META } from "@/lib/defaults";
import { AddLeakTracker } from "./add-leak-tracker";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The leaks, one row per request URL, category and page: what fired, where, how often, and the fix. */
export function LeaksTable({ propertyId, groups, canWrite, footer }: { propertyId: string; groups: LeakGroup[]; canWrite: boolean; footer?: React.ReactNode }) {
  const columns = useMemo<Column<LeakGroup>[]>(
    () => [
      {
        id: "request",
        header: "Request",
        cell: (g) => (
          <div className="min-w-0 max-w-[28rem]">
            <span className="block truncate font-mono text-xs text-ink" title={g.url}>
              {g.url}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-3" title={g.page}>
              on {g.page}
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">
              {g.preloadOnly
                ? `Downloaded by the browser before consent, but never ran. Mark this tag type="text/plain" data-consent="${g.category}" so it isn't fetched.`
                : g.matchedTracker
                  ? `Listed as "${g.matchedTracker.name}", but ran before plain-consent.js`
                  : "Not on your tracker list"}
            </span>
          </div>
        ),
      },
      {
        id: "category",
        header: "Declined",
        sortValue: (g) => g.category,
        cell: (g) => <Badge tone="danger">{cap(g.category)}</Badge>,
      },
      {
        id: "visitors",
        header: "Visitors",
        cell: (g) => (
          <span className="text-ink-2">
            {g.frameworks.map((f) => FRAMEWORK_META[f].name).join(", ")}
            {g.countries.length ? <span className="block text-xs text-ink-3">{g.countries.slice(0, 4).join(", ")}{g.countries.length > 4 ? ` +${g.countries.length - 4}` : ""}</span> : null}
          </span>
        ),
      },
      { id: "count", header: "Times", numeric: true, sortValue: (g) => g.count, cell: (g) => formatInt(g.count) },
      { id: "last", header: "Last seen", numeric: true, sortValue: (g) => g.lastSeen, cell: (g) => <DateText iso={g.lastSeen} mode="relative" className="whitespace-nowrap" /> },
      {
        id: "fix",
        header: <span className="sr-only">Fix</span>,
        mobileLabel: "Fix",
        align: "right",
        cell: (g) =>
          g.preloadOnly ? (
            <ButtonLink size="sm" variant="secondary" href="/docs#blocking">
              How to mark the tag
            </ButtonLink>
          ) : g.matchedTracker ? (
            <ButtonLink size="sm" variant="secondary" href={`/app/sites/${propertyId}/install`}>
              Check install order
            </ButtonLink>
          ) : canWrite ? (
            <AddLeakTracker propertyId={propertyId} host={g.host} category={g.category} />
          ) : null,
      },
    ],
    [propertyId, canWrite],
  );
  return <DataTable caption="Leaks, newest first" rows={groups} columns={columns} rowKey={(g) => g.key} minWidth={860} footer={footer} />;
}

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

/** The leaks page's time range, kept in the URL. */
export function LeaksRange({ range }: { range: 7 | 30 }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <Segmented
      label="Time range"
      value={String(range) as "7" | "30"}
      options={[...RANGES]}
      onChange={(v) => {
        start(() => router.replace(`?range=${v}`, { scroll: false }));
      }}
    />
  );
}
