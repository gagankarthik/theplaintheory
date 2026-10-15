import type { Metadata } from "next";
import Link from "next/link";
import { LeaksRange, LeaksTable } from "@/components/app/leaks/leaks-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip, type Stat } from "@/components/app/ui/stat-strip";
import { relativeTime, utcShort } from "@/components/app/logs/receipt-labels";
import { ButtonLink } from "@/components/app/ui/button";
import { IconShieldCheck } from "@/components/icons";
import { formatInt, groupLeaks, isoDaysAgo } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { heldTrackers } from "@/lib/trackers";

export const metadata: Metadata = { title: "Leaks" };

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
      <PageHeader
        live
        title="Leaks"
        description={
          <>
            Tracker requests that fired after a visitor declined their category.{" "}
            <Link href="/docs#blocking" className="font-medium text-ink underline underline-offset-2 hover:no-underline">
              How blocking works
            </Link>
          </>
        }
        actions={<LeaksRange range={range} />}
      />

      <StatStrip label={`Leaks, last ${range} days`} stats={stats} />

      {detectionOff ? (
        <Alert
          tone="warning"
          title="Leak detection is off"
          className="mb-6"
          actions={
            canWrite ? (
              <ButtonLink size="sm" variant="secondary" href={`/app/sites/${property.id}/regions#notice`}>
                Turn it on
              </ButtonLink>
            ) : undefined
          }
        >
          New leaks on this site aren&apos;t being reported.
        </Alert>
      ) : null}

      {groups.length === 0 ? (
        property.publishedVersion === 0 ? (
          // nothing can leak (or be watched) until the banner is live, so don't claim a clean bill of health
          <EmptyState
            icon={<IconShieldCheck size={24} />}
            title="Leak detection starts when your banner is live"
            action={canWrite ? <ButtonLink href={`/app/sites/${property.id}/banner`}>Review and publish</ButtonLink> : undefined}
          >
            Once visitors see the published banner, any tracker request that fires after someone declines shows up here.
          </EmptyState>
        ) : (
          <EmptyState icon={<IconShieldCheck size={24} />} title={`No leaks in the last ${range} days`}>
            {detectionOff
              ? "Leak detection is off, so this can't tell you much."
              : "Every tracker on this site waited for consent. Any request that fires after a decline will be listed here."}
          </EmptyState>
        )
      ) : (
        <LeaksTable
          propertyId={property.id}
          groups={groups}
          canWrite={canWrite}
          footer="Reports hold the request host and path (no query strings), the page, the notice and the country. No visitor ids or IP addresses. Kept 90 days."
        />
      )}
    </>
  );
}
