import type { Metadata } from "next";
import Link from "next/link";
import { Breakdowns, CategoryConsent, DecisionsChart, MetricOverview, type PreviousRates } from "@/components/app/analytics/charts";
import { RangePicker } from "@/components/app/analytics/range-picker";
import { NextSteps, SiteHealth, type NextStep } from "@/components/app/analytics/site-status";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishBadge } from "@/components/app/ui/badge";
import { Card } from "@/components/app/ui/card";
import { EmptyState } from "@/components/app/ui/empty-state";
import { SetupGuide } from "@/components/app/sites/setup-guide";
import { SitePreview } from "@/components/app/sites/site-preview";
import { StatusDot } from "@/components/app/ui/status-dot";
import { ButtonLink } from "@/components/app/ui/button";
import { CardBody } from "@/components/app/ui/card";
import { toPublicConfig } from "@/lib/public-config";
import type { Framework } from "@/lib/types";
import { IconOverview } from "@/components/icons";
import { formatInt, isoDaysAgo, rangeDays, summarizeRollups } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import { evaluateFairness } from "@/lib/fairness";
import { planById } from "@/lib/plans";
import { dpdpReadiness } from "@/lib/readiness";
import { mergeRollups, rollupsFromReceipts } from "@/lib/rollups";
import { setupProgress } from "@/lib/setup";
import { loadSetupSignals } from "@/lib/setup-signals";
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
  const [rolled, counters, leaks, [lastScan], signals] = await Promise.all([
    store.listDecisionRollups(property.id, both[0], both[both.length - 1]),
    store.listCounters(property.id, both[0], both[both.length - 1]),
    store.listLeaks(property.id, isoDaysAgo(7)),
    store.listScans(property.id, 1),
    loadSetupSignals(store, property, org),
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
  const setup = setupProgress(signals);
  const inSetup = !setup.complete;
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
  if (fairness.failures.length && !inSetup)
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

  // The site at a glance, as a hosting dashboard shows a project: what visitors see, where, and its state.
  const shownConfig = property.published?.config ?? property.config;
  const preview = toPublicConfig({ ...property, config: shownConfig }, org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined);
  const laws = (Object.keys(FRAMEWORK_META) as Framework[]).filter((f) => f !== "generic" && shownConfig.regions[f]?.enabled);
  const firstLaw = laws[0] ?? "generic";
  const lastViewDay = counters.filter((c) => c.views > 0).map((c) => c.day).sort().at(-1);
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const summary = (
    <Card aria-labelledby="site-h" className="overflow-hidden">
      <CardBody className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
        <SitePreview config={preview} framework={firstLaw} domain={property.domain} />
        <div className="min-w-0">
          <h2 id="site-h" className="sr-only">
            {property.domain} at a glance
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Banner</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium text-ink">
                <StatusDot tone={published && !dirty ? "ok" : "warn"} label="" />
                {published ? (dirty ? `v${property.publishedVersion} live · newer draft` : `v${property.publishedVersion} live`) : "Not published yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Script on the site</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium text-ink">
                <StatusDot tone={signals.seen ? "ok" : "warn"} label="" />
                {signals.seen ? (lastViewDay ? `Seen ${fmtDay(lastViewDay)}` : "Seen") : "Not seen yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Laws covered</dt>
              <dd className="mt-1 font-medium text-ink">{laws.length ? laws.map((f) => FRAMEWORK_META[f].name).join(" · ") : "Default notice only"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Last published</dt>
              <dd className="mt-1 font-medium text-ink">{property.publishedAt ? fmtDay(property.publishedAt) : "Never"}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            {canWrite ? (
              <ButtonLink href={`${base}/banner`} variant="secondary" size="sm">
                Edit banner
              </ButtonLink>
            ) : null}
            <ButtonLink href={`${base}/install`} variant="ghost" size="sm">
              Install
            </ButtonLink>
            <a href={`https://${property.domain}`} target="_blank" rel="noreferrer" className="btn btn-link text-sm">
              Visit {property.domain}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader
        live
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
        {summary}
        {inSetup ? <SetupGuide domain={property.domain} progress={setup} canWrite={canWrite} /> : null}
        <NextSteps steps={steps} />

        {hasData ? <MetricOverview current={s} previous={previous} range={range} /> : null}

        {/* While setting up, the checklist is the page: no empty charts or health scores yet. */}
        {inSetup && !hasData ? null : (
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
        )}

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
