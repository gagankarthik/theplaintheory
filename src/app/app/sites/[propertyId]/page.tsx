import type { Metadata } from "next";
import Link from "next/link";
import { Breakdowns, DecisionsChart, MetricOverview, type PreviousRates } from "@/components/app/analytics/charts";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishBadge } from "@/components/app/ui/badge";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { SetupGuide, setupComplete, type SetupState } from "@/components/app/sites/setup-guide";
import { formatInt, isoDaysAgo, outcomeOf, rangeDays, summarize } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { evaluateFairness } from "@/lib/fairness";
import { planById } from "@/lib/plans";
import { dpdpReadiness } from "@/lib/readiness";
import { heldTrackers } from "@/lib/trackers";

export const metadata: Metadata = { title: "Overview" };

const RANGES = [7, 30, 90] as const;

export default async function OverviewPage(props: PageProps<"/app/sites/[propertyId]">) {
  const { propertyId } = await props.params;
  const sp = await props.searchParams;
  const range = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const { property, store, role, org } = await requireProperty(propertyId);

  // Current window plus the equal-length window before it, for deltas.
  const both = rangeDays(range * 2);
  const prevDays = both.slice(0, range);
  const days = both.slice(range);
  const [receipts, counters, leaks] = await Promise.all([
    store.listReceipts(property.id, { from: `${both[0]}T00:00:00.000Z` }),
    store.listCounters(property.id, both[0], both[both.length - 1]),
    store.listLeaks(property.id, isoDaysAgo(7)),
  ]);
  const fairness = evaluateFairness(property.config, { dpoEmail: org.dpo?.email });
  const readiness = dpdpReadiness(property, org, planById(org.plan));
  // Decisions only: a withdrawal is a receipt but not a choice on the banner.
  const windowReceipts = receipts.filter((r) => r.timestamp.slice(0, 10) >= both[range] && outcomeOf(r.action));
  const gpcHonoured = windowReceipts.filter((r) => r.gpc).length;
  const inWindow = (d: string, w: string[]) => d >= w[0] && d <= w[w.length - 1];
  const s = summarize(
    receipts.filter((r) => inWindow(r.timestamp.slice(0, 10), days)),
    counters.filter((c) => inWindow(c.day, days)),
    days,
  );
  const p = summarize(
    receipts.filter((r) => inWindow(r.timestamp.slice(0, 10), prevDays)),
    counters.filter((c) => inWindow(c.day, prevDays)),
    prevDays,
  );
  const previous: PreviousRates = {
    optIn: p.decisions ? p.optInRate : null,
    optOut: p.decisions ? p.optOutRate : null,
    partial: p.decisions ? p.partialRate : null,
    bounce: p.views ? p.bounceRate : null,
  };
  const dirty = property.config.version !== property.publishedVersion;
  const setup: SetupState = {
    propertyId: property.id,
    domain: property.domain,
    bannerEdited: property.config.version > 1,
    trackers: heldTrackers(property.trackers).length,
    published: property.publishedVersion > 0,
    seen: s.views + p.views > 0 || s.decisions + p.decisions > 0,
    decisions: s.decisions + p.decisions,
    canWrite: can(role, "property:write"),
  };
  const frameworkLabels = Object.fromEntries(Object.entries(FRAMEWORK_META).map(([k, v]) => [k, v.name]));

  return (
    <>
      <PageHeader live
        crumbs={[{ href: "/app", label: "Sites" }, { label: property.name }]}
        title={property.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {property.domain}
            {/* the top bar shows publish status from md up; phones see it here */}
            <span className="md:hidden">
              <PublishBadge dirty={dirty} published={property.publishedVersion > 0} />
            </span>
          </span>
        }
      />

      <nav aria-label="Date range" className="mb-5 flex flex-wrap items-center gap-3">
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
        <span className="text-xs text-ink-3">Days are in UTC.</span>
      </nav>

      <StatStrip
        label="Compliance at a glance"
        stats={[
          {
            href: `/app/sites/${property.id}/banner`,
            label: "Fairness check",
            value: fairness.failures.length ? `${fairness.failures.length} failing` : `${fairness.score}%`,
            note: fairness.failures.length ? "Blocks publishing" : fairness.warnings.length ? `${fairness.warnings.length} to review` : "All checks pass",
            tone: fairness.failures.length > 0 ? "bad" : fairness.warnings.length ? "warn" : undefined,
          },
          {
            href: `/app/sites/${property.id}/dpdp`,
            label: "DPDP readiness",
            value: `${readiness.percent}%`,
            note: `${readiness.passed} of ${readiness.total} checks pass`,
            tone: readiness.items.some((i) => i.severity === "fail") ? "bad" : undefined,
          },
          {
            href: `/app/sites/${property.id}/leaks?range=7`,
            label: "Leaks, last 7 days",
            value: formatInt(leaks.length),
            note: leaks.length ? `${new Set(leaks.map((l) => l.page)).size} pages affected` : "Nothing fired after a refusal",
            tone: leaks.length > 0 ? "bad" : undefined,
          },
          {
            href: `/app/sites/${property.id}/logs?gpc=1`,
            label: "GPC honoured",
            value: formatInt(gpcHonoured),
            note: `of ${formatInt(windowReceipts.length)} decisions, last ${range} days`,
          },
        ]}
      />

      {!setupComplete(setup) ? (
        <div className={s.decisions === 0 && s.views === 0 ? "" : "mb-8"}>
          <SetupGuide {...setup} />
        </div>
      ) : null}
      {s.decisions === 0 && s.views === 0 ? null : (
        <div className="space-y-6">
          <MetricOverview current={s} previous={previous} range={range} />
          <DecisionsChart series={s.series} />
          <Breakdowns
            groups={[
              { title: "Country", rows: s.byCountry },
              { title: "Legal framework", rows: s.byFramework, labelFor: frameworkLabels },
              { title: "Device", rows: s.byDevice },
              { title: "Browser", rows: s.byBrowser },
            ]}
          />
          {s.revoked ? (
            <p className="text-sm text-ink-3">
              {formatInt(s.revoked)} visitor{s.revoked > 1 ? "s" : ""} withdrew consent in this period. Each withdrawal is a receipt in the consent log.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
