import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/app/ui/badge";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardHeader } from "@/components/app/ui/card";
import { DateText } from "@/components/app/ui/date-text";
import { StatusDot, type DotTone } from "@/components/app/ui/status-dot";
import { IconChevronRight } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import type { ScanStatus } from "@/lib/trackers";

/* ---------------- next steps ---------------- */

export interface NextStep {
  id: string;
  tone: Extract<BadgeTone, "danger" | "warning" | "info">;
  /** the badge word, e.g. "Leak" or "Draft" */
  tag: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/**
 * What needs doing on this site, most urgent first. Renders nothing when there is nothing to do,
 * so a healthy site's overview stays quiet. Buttons are secondary: the page's primary action (if
 * any) belongs to the setup guide.
 */
export function NextSteps({ steps }: { steps: NextStep[] }) {
  if (!steps.length) return null;
  const order = { danger: 0, warning: 1, info: 2 } as const;
  const list = [...steps].sort((a, b) => order[a.tone] - order[b.tone]);
  return (
    <Card aria-labelledby="next-h">
      <CardHeader titleId="next-h" title="Needs attention" description={`${list.length} ${list.length === 1 ? "thing" : "things"} to look at on this site.`} />
      <ul className="divide-y divide-line">
        {list.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                <Badge tone={s.tone}>{s.tag}</Badge>
                {s.title}
              </p>
              <p className="mt-1 text-sm text-ink-3">{s.detail}</p>
            </div>
            <ButtonLink href={s.href} variant="secondary" size="sm" className="shrink-0 self-start sm:self-center">
              {s.cta}
              <span className="sr-only">: {s.title}</span>
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- site health ---------------- */

const SCAN: Record<ScanStatus, { label: string; tone: DotTone }> = {
  queued: { label: "Scan queued", tone: "warn" },
  running: { label: "Scan running", tone: "live" },
  ok: { label: "Scan completed", tone: "ok" },
  failed: { label: "Scan failed", tone: "bad" },
  cancelled: { label: "Scan cancelled", tone: "idle" },
};

interface HealthRow {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href: string;
}

/**
 * The checks behind the numbers: crawler, fairness, DPDP readiness, GPC and leaks. Each row links to
 * the page that explains it. Status is words plus a dot shape, never colour alone.
 */
export function SiteHealth({
  base,
  scan,
  trackers,
  fairness,
  readiness,
  gpc,
  decisions,
  range,
  leaks,
  leakPages,
}: {
  base: string;
  scan: { status: ScanStatus; at: string; preConsent: number } | null;
  trackers: number;
  fairness: { score: number; failures: number; warnings: number };
  readiness: { percent: number; passed: number; total: number; failing: boolean };
  gpc: number;
  decisions: number;
  range: number;
  leaks: number;
  leakPages: number;
}) {
  const rows: HealthRow[] = [
    {
      label: "Tracker scan",
      href: `${base}/scanner`,
      value: scan ? (
        <StatusDot tone={SCAN[scan.status].tone} pulse={scan.status === "running"} label={SCAN[scan.status].label} showLabel />
      ) : (
        <StatusDot tone="idle" label="Not scanned yet" showLabel />
      ),
      note: scan ? (
        <>
          <DateText iso={scan.at} mode="relative" /> · {trackers === 1 ? "1 tracker held" : `${trackers} trackers held`}
        </>
      ) : (
        `${trackers === 1 ? "1 tracker" : `${trackers} trackers`} listed by hand`
      ),
    },
    {
      label: "Fairness check",
      href: `${base}/banner`,
      value: fairness.failures ? (
        <Badge tone="danger">{fairness.failures} failing</Badge>
      ) : fairness.warnings ? (
        <Badge tone="warning">{fairness.warnings} to review</Badge>
      ) : (
        <Badge tone="success">Passes</Badge>
      ),
      note: fairness.failures ? "Blocks publishing" : `Score ${fairness.score}%`,
    },
    {
      label: "DPDP readiness",
      href: `${base}/dpdp`,
      value: readiness.failing ? <Badge tone="warning">{readiness.percent}%</Badge> : <span className="font-semibold tabular-nums text-ink">{readiness.percent}%</span>,
      note: `${readiness.passed} of ${readiness.total} checks pass${readiness.failing ? ", some failing" : ""}`,
    },
    {
      label: "Leaks, 7 days",
      href: `${base}/leaks?range=7`,
      value: leaks ? <Badge tone="danger">{leaks}</Badge> : <Badge tone="success">None</Badge>,
      note: leaks ? `On ${leakPages} ${leakPages === 1 ? "page" : "pages"}` : "Nothing fired after a refusal",
    },
    {
      label: "GPC honoured",
      href: `${base}/logs?gpc=1`,
      value: <span className="font-semibold tabular-nums text-ink">{formatInt(gpc)}</span>,
      note: `of ${formatInt(decisions)} decisions, ${range} days`,
    },
  ];

  return (
    <Card aria-labelledby="health-h" className="h-full">
      <CardHeader
        titleId="health-h"
        title="Site health"
        actions={
          <Link href="/docs#scanner" className="btn btn-link text-xs">
            Learn more<span className="sr-only"> about tracker scanning</span>
          </Link>
        }
      />
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <Link href={r.href} className="group flex min-h-14 items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised focus-visible:-outline-offset-2 sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink-2 group-hover:text-ink">{r.label}</span>
                {r.note ? <span className="block text-xs text-ink-3">{r.note}</span> : null}
              </span>
              <span className="shrink-0 text-sm">{r.value}</span>
              <IconChevronRight size={16} aria-hidden className="shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
