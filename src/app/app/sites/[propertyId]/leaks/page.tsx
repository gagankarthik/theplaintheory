import type { Metadata } from "next";
import Link from "next/link";
import { AddLeakTracker } from "@/components/app/leaks/add-leak-tracker";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { ButtonLink } from "@/components/app/ui/button";
import { IconAlert, IconShieldCheck } from "@/components/icons";
import { formatInt, groupLeaks, isoDaysAgo } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";

export const metadata: Metadata = { title: "Leaks" };

const RANGES = [7, 30] as const;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

export default async function LeaksPage(props: PageProps<"/app/sites/[propertyId]/leaks">) {
  const { propertyId } = await props.params;
  const sp = await props.searchParams;
  const range = sp.range === "7" ? 7 : 30;
  const { property, store, role } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const since = isoDaysAgo(range);
  const leaks = await store.listLeaks(property.id, since);
  const groups = groupLeaks(leaks, property.trackers);
  const pages = new Set(groups.map((g) => g.page)).size;
  const hosts = new Set(groups.map((g) => g.host)).size;
  const loadOrder = groups.filter((g) => g.matchedTracker).length;
  const detectionOff = property.config.leakDetection === false;

  return (
    <>
      <PageHeader
        title="Leaks"
        description="Tracker requests seen in visitors' browsers after they declined that category. Each one is processing without consent, so fix them before anyone else finds them."
        actions={
          <div role="group" aria-label="Time range" className="inline-flex rounded-md border border-line bg-paper p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`?range=${r}`}
                aria-current={r === range ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-bold ${r === range ? "bg-surface text-ink shadow-[0_1px_2px_rgb(11_16_32/.14)]" : "text-ink-3 hover:text-ink"}`}
              >
                Last {r} days
              </Link>
            ))}
          </div>
        }
      />

      {detectionOff ? (
        <p className="mb-6 flex items-start gap-2 rounded-md bg-amber-wash px-4 py-3 text-sm text-amber">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <span>
            Leak detection is off for this site, so new leaks aren&apos;t being reported.{" "}
            <Link href={`/app/sites/${property.id}/regions#notice`} className="font-bold underline underline-offset-2">
              Turn it on
            </Link>
          </span>
        </p>
      ) : null}

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        {[
          ["Leaked requests", formatInt(leaks.length)],
          ["Pages affected", formatInt(pages)],
          ["Hosts involved", formatInt(hosts)],
          ["Load-order issues", formatInt(loadOrder)],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-5 py-4">
            <dt className="text-sm text-ink-3">{k}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>

      {groups.length === 0 ? (
        <EmptyState icon={<IconShieldCheck size={28} />} title={`No leaks in the last ${range} days`}>
          {detectionOff
            ? "Leak detection is off, so this can't tell you much. Turn it on in Regions."
            : "Every tracker on this site waited for consent. We'll list any request that fires after a decline here."}
        </EmptyState>
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line" aria-label={`Leaks in the last ${range} days`}>
            {groups.map((g) => (
              <li key={g.key} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-mono text-[13px] text-ink">{g.url}</span>
                    <span className="rounded-full bg-rose-wash px-2 py-0.5 text-[11px] font-bold text-rose">
                      {g.category[0].toUpperCase() + g.category.slice(1)} declined
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    <span className="font-medium text-ink">{formatInt(g.count)}</span> time{g.count === 1 ? "" : "s"} on <span className="font-medium text-ink">{g.page}</span>,{" "}
                    {g.frameworks.map((f) => FRAMEWORK_META[f].name).join(", ")} visitors{g.countries.length ? ` from ${g.countries.slice(0, 4).join(", ")}${g.countries.length > 4 ? "…" : ""}` : ""}. Last seen{" "}
                    {ago(g.lastSeen)}.
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
