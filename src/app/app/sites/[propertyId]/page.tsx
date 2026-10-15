import type { Metadata } from "next";
import Link from "next/link";
import { Breakdowns, CategoryConsent, DecisionsChart, MetricOverview, type PreviousRates } from "@/components/app/analytics/charts";
import { RangePicker } from "@/components/app/analytics/range-picker";
import { NextSteps, SiteHealth, type NextStep } from "@/components/app/analytics/site-status";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishBadge } from "@/components/app/ui/badge";
import { Card } from "@/components/app/ui/card";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SetupGuide, setupComplete, type SetupState } from "@/components/app/sites/setup-guide";
import { IconOverview } from "@/components/icons";
import { formatInt, isoDaysAgo, rangeDays, summarizeRollups } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { evaluateFairness } from "@/lib/fairness";
import { planById } from "@/lib/plans";
import { dpdpReadiness } from "@/lib/readiness";
import { mergeRollups, rollupsFromReceipts } from "@/lib/rollups";
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
  const [rolled, counters, leaks, [lastScan]] = await Promise.all([
    store.listDecisionRollups(property.id, both[0], both[both.length - 1]),
    store.listCounters(property.id, both[0], both[both.length - 1]),
    store.listLeaks(property.id, isoDaysAgo(7)),
    store.listScans(property.id, 1),
  ]);
  // Daily rollups cover receipts from rolled.fromSeq on. Receipts stored before rollups existed are
  // counted from the receipts themselves (only those: the query starts below fromSeq), so the sum is
  // exact on the cut-over day too. No backfill is needed; these reads fade out as the window moves.
  const legacy =
    rolled.fromSeq === 1
      ? []
      : await store.listReceipts(property.id, { from: `${both[0]}T00:00:00.000Z`, ...(rolled.fromSeq ? { before: rolled.fromSeq } : {}) });
  const rollups = mergeRollups(rolled.rollups, rollupsFromReceipts(legacy));
  const fairness = evaluateFairness(property.config, { dpoEmail: org.dpo?.email });
  const readiness = dpdpReadiness(property, org, planById(org.plan));
  const inWindow = (d: string, w: string[]) => d >= w[0] && d <= w[w.length - 1];
  const s = summarizeRollups(
    rollups.filter((r) => inWindow(r.day, days)),
    counters.filter((c) => inWindow(c.day, days)),
    days,
  );
  const p = summarizeRollups(
    rollups.filter((r) => inWindow(r.day, prevDays)),
    counters.filter((c) => inWindow(c.day, prevDays)),
    prevDays,
  );
  const previous: PreviousRates = {
    optIn: p.decisions ? p.optInRate : null,
    optOut: p.decisions ? p.optOutRate : null,
    partial: p.decisions ? p.partialRate : null,
    bounce: p.views ? p.bounceRate : null,
  };
  const base = `/app/sites/${property.id}`;
  const dirty = property.config.version !== property.publishedVersion;
  const published = property.publishedVersion > 0;
  const trackers = heldTrackers(property.trackers).length;
  const canWrite = can(role, "property:write");
  const setup: SetupState = {
    propertyId: property.id,
    domain: property.domain,
    bannerEdited: property.config.version > 1,
    trackers,
    published,
    seen: s.views + p.views > 0 || s.decisions + p.decisions > 0,
    decisions: s.decisions + p.decisions,
    canWrite,
  };
  const inSetup = !setupComplete(setup);
  const hasData = s.decisions > 0 || s.views > 0;
  const frameworkLabels = Object.fromEntries(Object.entries(FRAMEWORK_META).map(([k, v]) => [k, v.name]));
  const leakPages = new Set(leaks.map((l) => l.page)).size;
  const preConsent = lastScan?.preConsent?.length ?? 0;

  // What needs doing, in the order it matters. Unpublished sites are the setup guide's job.
  const steps: NextStep[] = [];
  if (leaks.length)
    steps.push({
      id: "leaks",
      tone: "danger",
      tag: "Leak",
      title: `${formatInt(leaks.length)} ${leaks.length === 1 ? "tracker fired" : "trackers fired"} after a refusal`,
      detail: `Seen on ${leakPages} ${leakPages === 1 ? "page" : "pages"} in the last 7 days. Each one needs blocking.`,
      href: `${base}/leaks?range=7`,
      cta: "View leaks",
    });
  if (fairness.failures.length)
    steps.push({
      id: "fairness",
      tone: "danger",
      tag: "Blocks publishing",
      title: `${fairness.failures.length} fairness ${fairness.failures.length === 1 ? "check fails" : "checks fail"}`,
      detail: fairness.failures[0]?.title ?? "The banner can't be published until this is fixed.",
      href: `${base}/banner`,
      cta: "Fix in banner",
    });
  if (preConsent)
    steps.push({
      id: "pre-consent",
      tone: "danger",
      tag: "Before consent",
      title: `${preConsent} ${preConsent === 1 ? "tracker loads" : "trackers load"} before a choice`,
      detail: "The last scan found trackers set before the visitor decided.",
      href: `${base}/scanner`,
      cta: "Review scan",
    });
  if (published && dirty && !inSetup)
    steps.push({
      id: "publish",
      tone: "warning",
      tag: "Draft",
      title: "Unpublished changes",
      detail: "Visitors still see the last published banner.",
      href: `${base}/banner`,
      cta: "Review and publish",
    });
  if (lastScan?.status === "failed")
    steps.push({
      id: "scan",
      tone: "warning",
      tag: "Scan",
      title: "The last tracker scan failed",
      detail: lastScan.error ?? "Run it again, or check that the site is reachable.",
      href: `${base}/scanner`,
      cta: "Open scanner",
    });

  return (
    <>
      <PageHeader
        live
        crumbs={[{ href: "/app", label: "Sites" }, { label: property.name }]}
        title={property.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {property.domain}
            {/* the top bar shows publish status from md up; phones see it here */}
            <span className="md:hidden">
              <PublishBadge dirty={dirty} published={published} />
            </span>
          </span>
        }
        actions={<RangePicker value={range} options={RANGES} />}
      />

      <div className="space-y-6">
        {inSetup ? <SetupGuide {...setup} /> : null}
        <NextSteps steps={steps} />

        {hasData ? <MetricOverview current={s} previous={previous} range={range} /> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          {hasData ? (
            <CategoryConsent
              granted={s.granted}
              decisions={s.decisions}
              previous={p.decisions ? { functional: p.granted.functional / p.decisions, analytics: p.granted.analytics / p.decisions, marketing: p.granted.marketing / p.decisions } : null}
              range={range}
            />
          ) : (
            <Card className="grid place-items-center">
              <EmptyState bare icon={<IconOverview size={22} />} title={inSetup ? "Numbers appear after the first decisions" : `No banner activity in the last ${range} days`}>
                {inSetup ? (
                  "Once the banner is live and visitors choose, consent rates and trends show here."
                ) : (
                  <>
                    Try a longer range, or check the{" "}
                    <Link href={`${base}/install`} className="text-ink-2 underline underline-offset-4 hover:text-ink">
                      install
                    </Link>{" "}
                    if you expected visitors.
                  </>
                )}
              </EmptyState>
            </Card>
          )}
          <SiteHealth
            base={base}
            scan={lastScan ? { status: lastScan.status, at: lastScan.finishedAt || lastScan.startedAt, preConsent } : null}
            trackers={trackers}
            fairness={{ score: fairness.score, failures: fairness.failures.length, warnings: fairness.warnings.length }}
            readiness={{ percent: readiness.percent, passed: readiness.passed, total: readiness.total, failing: readiness.items.some((i) => i.severity === "fail") }}
            gpc={s.gpc}
            decisions={s.decisions}
            range={range}
            leaks={leaks.length}
            leakPages={leakPages}
          />
        </div>

        {hasData ? (
          <>
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
                {formatInt(s.revoked)} {s.revoked === 1 ? "visitor" : "visitors"} withdrew consent in this period.{" "}
                <Link href={`${base}/logs`} className="text-ink-2 underline underline-offset-4 hover:text-ink">
                  See the consent log
                </Link>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
