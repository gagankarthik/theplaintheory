import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { REGION_CHOICES, SUPPORT_SEVERITIES, TOPIC_LABEL, labelOf } from "@/lib/lead-options";
import { shortDuration, type Breakdown, type LeadMetrics } from "@/lib/platform/lead-metrics";
import { fmtDay, fmtInt } from "./format";

const DAY_MS = 86_400_000;

const SITES_LABEL: Record<string, string> = { "1": "1 site", "2-10": "2 to 10", "11-50": "11 to 50", "50+": "More than 50" };
const PAGEVIEWS_LABEL: Record<string, string> = { "<100k": "Under 100k", "100k-1m": "100k to 1M", "1m-10m": "1M to 10M", "10m+": "Over 10M" };

function trend(now: number, before: number) {
  if (!before) return now ? "None in the 30 days before" : "None in the 30 days before either";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : ""}${pct}% on the 30 days before (${fmtInt(before)})`;
}

/** Labelled bars: the numbers are text, the bar only reinforces them. */
function Bars({ rows, label }: { rows: { key: string; label: string; count: number; note?: React.ReactNode; tone?: "bad" | "warn" }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-ink-3">Nothing yet.</p>;
  return (
    <ul aria-label={label} className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-2">{r.label}</span>
            <span className="tabular-nums text-ink-3">
              <span className={`font-semibold ${r.tone === "bad" && r.count ? "text-destructive" : r.tone === "warn" && r.count ? "text-warning" : "text-ink"}`}>{fmtInt(r.count)}</span>
              {` · ${Math.round((r.count / total) * 100)}%`}
              {r.note ? <> · {r.note}</> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line" aria-hidden>
            <div
              className={`h-full rounded-full ${r.tone === "bad" && r.count ? "bg-destructive" : r.tone === "warn" && r.count ? "bg-warning" : "bg-ink-2"}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const asRows = (b: Breakdown[], labels: Record<string, string>) => b.map((x) => ({ key: x.key, label: labels[x.key] ?? x.key, count: x.count }));

/**
 * Contact-form demand and inbox health for the staff console: what needs a reply now, how volume is
 * moving, which teams it lands on, and who is asking (prospect size, regions, support severity).
 */
export function RequestMetrics({ m }: { m: LeadMetrics }) {
  const busiest = m.days.reduce((a, d) => (d.total > a.total ? d : a), m.days[0]);
  const peak = Math.max(1, busiest?.total ?? 0);
  const overdue = m.oldestWaitingMs !== null && m.oldestWaitingMs > DAY_MS;
  const handled = m.total ? Math.round((m.closed / m.total) * 100) : 0;

  return (
    <section aria-labelledby="req-metrics-h" className="mb-8">
      <h2 id="req-metrics-h" className="sr-only">
        Request metrics
      </h2>

      <h3 className="eyebrow mb-2">Needs a reply</h3>
      <StatStrip
        label="Inbox figures"
        className="mb-4"
        stats={[
          { label: "New, unanswered", value: fmtInt(m.unanswered), tone: m.unanswered ? "warn" : undefined, note: m.unanswered ? "Nobody has picked these up" : "Inbox zero", href: "/admin/requests?status=new" },
          {
            label: "Oldest waiting",
            value: m.oldestWaitingMs === null ? "None" : shortDuration(m.oldestWaitingMs),
            tone: overdue ? "bad" : m.oldestWaitingMs !== null ? "warn" : undefined,
            note: overdue ? "Past the one-business-day reply promise" : "We promise a reply within one business day",
            href: "/admin/requests?status=new",
          },
          { label: "In progress", value: fmtInt(m.open), note: "Status Open", href: "/admin/requests?status=open" },
          { label: "Urgent or high support", value: fmtInt(m.urgentOpen), tone: m.urgentOpen ? "bad" : undefined, note: "Support tickets not yet closed", href: "/admin/requests?topic=support" },
        ]}
      />

      <h3 className="eyebrow mb-2">Volume and handling</h3>
      <StatStrip
        label="Volume figures"
        className="mb-6"
        stats={[
          { label: "Requests, 30 days", value: fmtInt(m.last30), note: trend(m.last30, m.prev30) },
          { label: "All time", value: fmtInt(m.total), note: "Every contact-form request", href: "/admin/requests" },
          { label: "Closed", value: `${handled}%`, note: `${fmtInt(m.closed)} of ${fmtInt(m.total)}`, href: "/admin/requests?status=closed" },
          { label: "Median time to close", value: m.medianCloseMs === null ? "None yet" : shortDuration(m.medianCloseMs), note: "From received to Closed" },
        ]}
      />

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card aria-labelledby="req-days-h" className="min-w-0">
          <CardHeader titleId="req-days-h" title="Requests by day" description={`Last ${m.days.length} days, UTC.`} />
          <CardBody>
            <p className="mb-4 text-sm text-ink-2">
              <span className="font-semibold tabular-nums text-ink">{fmtInt(m.last30)}</span> request{m.last30 === 1 ? "" : "s"} in 30 days
              {busiest?.total ? `; busiest day ${fmtDay(busiest.day)} with ${busiest.total}` : ""}.
            </p>
            {/* a picture of the table below it, which screen readers get instead */}
            <div className="flex h-40 items-end gap-[3px]" aria-hidden>
              {m.days.map((d) => (
                <div
                  key={d.day}
                  title={`${fmtDay(d.day)}: ${d.total}`}
                  className={`flex-1 rounded-t-sm ${d.total ? "bg-ink-2" : "bg-line"}`}
                  style={{ height: d.total ? `${Math.max(6, (d.total / peak) * 100)}%` : "2px" }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-3" aria-hidden>
              <span>{fmtDay(m.days[0].day)}</span>
              <span>{fmtDay(m.days[m.days.length - 1].day)}</span>
            </div>
            <table className="sr-only">
              <caption>Requests per day, days with requests only</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Requests</th>
                </tr>
              </thead>
              <tbody>
                {m.days
                  .filter((d) => d.total)
                  .map((d) => (
                    <tr key={d.day}>
                      <td>{fmtDay(d.day)}</td>
                      <td>{d.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card aria-labelledby="req-topics-h" className="min-w-0">
          <CardHeader titleId="req-topics-h" title="By topic" description="All time, with new requests waiting per team." />
          <CardBody>
            <Bars
              label="Requests by topic"
              rows={m.topics.map((t) => ({
                key: t.topic,
                label: TOPIC_LABEL[t.topic],
                count: t.total,
                note: t.waiting ? (
                  <Link href={`/admin/requests?status=new&topic=${t.topic}`} className="font-medium text-warning underline-offset-2 hover:underline">
                    {t.waiting} waiting
                  </Link>
                ) : (
                  `${t.last30} in 30 days`
                ),
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card aria-labelledby="req-sites-h" className="min-w-0">
          <CardHeader titleId="req-sites-h" title="Sales: websites" description="How many sites each prospect runs." />
          <CardBody>
            <Bars label="Sales enquiries by number of websites" rows={asRows(m.salesSites, SITES_LABEL)} />
          </CardBody>
        </Card>
        <Card aria-labelledby="req-pv-h" className="min-w-0">
          <CardHeader titleId="req-pv-h" title="Sales: monthly pageviews" description="Traffic band, a proxy for plan size." />
          <CardBody>
            <Bars label="Sales enquiries by monthly pageviews" rows={asRows(m.salesPageviews, PAGEVIEWS_LABEL)} />
          </CardBody>
        </Card>
        <Card aria-labelledby="req-sev-h" className="min-w-0">
          <CardHeader titleId="req-sev-h" title="Open support by severity" description="Tickets not yet closed." />
          <CardBody>
            <Bars
              label="Open support tickets by severity"
              rows={m.supportSeverity.map((s) => ({
                key: s.key,
                label: labelOf(SUPPORT_SEVERITIES, s.key),
                count: s.count,
                tone: s.key === "urgent" ? "bad" : s.key === "high" ? "warn" : undefined,
              }))}
            />
          </CardBody>
        </Card>
        <Card aria-labelledby="req-reg-h" className="min-w-0">
          <CardHeader titleId="req-reg-h" title="Visitor regions" description="Sales and enterprise; one request can name several." />
          <CardBody>
            <Bars label="Sales and enterprise requests by visitor region" rows={m.regions.map((r) => ({ key: r.key, label: labelOf(REGION_CHOICES, r.key), count: r.count }))} />
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
