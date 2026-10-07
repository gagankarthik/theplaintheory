import type { Metadata } from "next";
import Link from "next/link";
import { AddLeakTracker } from "@/components/app/leaks/add-leak-tracker";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip, type Stat } from "@/components/app/ui/stat-strip";
import { relativeTime, utcShort } from "@/components/app/logs/receipt-labels";
import { ButtonLink } from "@/components/app/ui/button";
import { IconAlert, IconShieldCheck } from "@/components/icons";
import { formatInt, groupLeaks, isoDaysAgo } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { heldTrackers } from "@/lib/trackers";

export const metadata: Metadata = { title: "Leaks" };

const RANGES = [7, 30] as const;

export default async function LeaksPage(props: PageProps<"/app/sites/[propertyId]/leaks">) {
  const { propertyId } = await props.params;
  const sp = await props.searchParams;
  const range = sp.range === "7" ? 7 : 30;
  const { property, store, role } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const since = isoDaysAgo(range);
  const leaks = await store.listLeaks(property.id, since);
  const groups = groupLeaks(leaks, heldTrackers(property.trackers));
  const pages = new Set(groups.map((g) => g.page)).size;
  const detectionOff = property.config.leakDetection === false;
  const live = property.publishedVersion > 0;
  // The source that leaked most: a listed tracker's name when one matches, otherwise its host.
  const bySource = new Map<string, number>();
  for (const g of groups) {
    const name = g.matchedTracker?.name ?? g.host;
    bySource.set(name, (bySource.get(name) ?? 0) + g.count);
  }
  const [worst] = [...bySource].sort((a, b) => b[1] - a[1]);
  const last = groups[0]?.lastSeen;
  // Before publishing, nothing can leak or be watched, so the row says so instead of claiming zero.
  const quiet = detectionOff ? "Leak detection is off" : live ? "None" : undefined;
  const stats: Stat[] = [
    {
      label: `Leaks, last ${range} days`,
      value: live || leaks.length ? formatInt(leaks.length) : "—",
      note: leaks.length
        ? `${formatInt(groups.length)} issue${groups.length === 1 ? "" : "s"} to fix`
        : detectionOff
          ? "Leak detection is off"
          : live
            ? "Nothing fired after a refusal"
            : "Starts when your banner is live",
      tone: leaks.length ? "bad" : undefined,
    },
    {
      label: "Pages affected",
      value: live || leaks.length ? formatInt(pages) : "—",
      note: pages ? "Where a tracker ran without consent" : quiet,
    },
    {
      label: "Top source",
      value: worst ? formatInt(worst[1]) : "—",
      note: worst ? <span className="block truncate" title={worst[0]}>{worst[0]}</span> : quiet,
    },
    {
      label: "Last leak",
      value: last ? relativeTime(last) : "—",
      note: last ? <time dateTime={last}>{utcShort(last)}</time> : quiet,
    },
  ];

  return (
    <>
      <PageHeader live
        title="Leaks"
        description="Tracker requests that fired after a visitor declined their category: processing without consent."
        actions={
          <nav aria-label="Time range">
            <ul className="inline-flex rounded-md border border-line bg-paper p-0.5">
              {RANGES.map((r) => (
                <li key={r}>
                  <Link
                    href={`?range=${r}`}
                    scroll={false}
                    aria-current={r === range ? "page" : undefined}
                    className={`inline-flex h-9 items-center rounded-[7px] px-3 text-xs font-semibold transition-colors max-sm:h-11 ${
                      r === range ? "bg-surface text-ink shadow-[0_1px_2px_rgb(11_16_32/.14)]" : "text-ink-3 hover:bg-line hover:text-ink"
                    }`}
                  >
                    Last {r} days
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        }
      />


      <StatStrip label={`Leaks, last ${range} days`} stats={stats} />

      {detectionOff ? (
        <p className="mb-6 flex items-start gap-2 rounded-md bg-amber-wash px-4 py-3 text-sm text-amber">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <span>
            Leak detection is off for this site, so new leaks aren&apos;t being reported.{" "}
            <Link href={`/app/sites/${property.id}/regions#notice`} className="font-semibold underline underline-offset-2">
              Turn it on
            </Link>
          </span>
        </p>
      ) : null}

      {groups.length === 0 ? (
        property.publishedVersion === 0 ? (
          // nothing can leak (or be watched) until the banner is live, so don't claim a clean bill of health
          <EmptyState icon={<IconShieldCheck size={24} />} title="Leak detection starts when your banner is live" action={canWrite ? <ButtonLink href={`/app/sites/${property.id}/banner`}>Review and publish</ButtonLink> : undefined}>
            Once visitors see the published banner, any tracker request that fires after someone declines shows up here.
          </EmptyState>
        ) : (
          <EmptyState icon={<IconShieldCheck size={24} />} title={`No leaks in the last ${range} days`}>
            {detectionOff
              ? "Leak detection is off, so this can't tell you much. Turn it on in Regions."
              : "Every tracker on this site waited for consent. We'll list any request that fires after a decline here."}
          </EmptyState>
        )
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line" aria-label={`Leaks in the last ${range} days`}>
            {groups.map((g) => (
              <li key={g.key} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-mono text-xs text-ink">{g.url}</span>
                    <span className="rounded-full bg-rose-wash px-2 py-0.5 text-2xs font-semibold text-rose">
                      {g.category[0].toUpperCase() + g.category.slice(1)} declined
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    <span className="font-medium text-ink">{formatInt(g.count)}</span> time{g.count === 1 ? "" : "s"} on <span className="font-medium text-ink">{g.page}</span>,{" "}
                    {g.frameworks.map((f) => FRAMEWORK_META[f].name).join(", ")} visitors{g.countries.length ? ` from ${g.countries.slice(0, 4).join(", ")}${g.countries.length > 4 ? "…" : ""}` : ""}. Last seen{" "}
                    {relativeTime(g.lastSeen)}.
                  </p>
                  <p className="mt-1.5 text-xs text-ink-3">
                    {g.matchedTracker
                      ? `Already listed as "${g.matchedTracker.name}". It ran before plain-consent.js could hold it: make our script the first one in <head>, before any tag manager.`
                      : `Not on your tracker list, so nothing held it. Add the host as a tracker, or mark the script with data-consent="${g.category}".`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {g.matchedTracker ? (
                    <ButtonLink size="sm" variant="ghost" href={`/app/sites/${property.id}/install`}>
                      Check install order
                    </ButtonLink>
                  ) : canWrite ? (
                    <AddLeakTracker propertyId={property.id} host={g.host} category={g.category} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 max-w-[80ch] text-xs text-ink-3">
        Reports contain the request host and path (query strings removed), the page, the notice and the country. No visitor identifiers or IP addresses. Kept for 90 days.
      </p>
    </>
  );
}
