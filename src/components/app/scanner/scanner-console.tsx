"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { cancelScan, getScanStatus, pollScanStatus, scanTrackers } from "@/app/app/sites/[propertyId]/tracker-actions";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DataTable, type Column } from "@/components/app/ui/data-table";
import { DateText } from "@/components/app/ui/date-text";
import { TextField } from "@/components/app/ui/field";
import { EmptyState } from "@/components/app/ui/empty-state";
import { Progress } from "@/components/app/ui/progress";
import { Sheet } from "@/components/app/ui/sheet";
import { StatusDot } from "@/components/app/ui/status-dot";
import { useToast } from "@/components/app/ui/toast";
import { IconAlert, IconCheck, IconCookie, IconRadar, IconStop } from "@/components/icons";
import { mergePolledLog } from "@/lib/scan-poll";
import { PHASE_LABEL, clock, remainingLabel, scanEta, type ScanPhase } from "@/lib/scan-eta";
import { isScanActive, SCAN_LOG_KEEP, type Finding, type ScanLogLine, type ScanReport, type ScanStatus } from "@/lib/trackers";
import { formatDuration } from "./format";

export type CrawlerEngineMode = "headless-sqs" | "headless-local" | "fetch";

/** One row of scan history: enough to list it; the full report is fetched on demand. */
export interface ScanHistoryRow {
  id: string;
  status: ScanStatus;
  engine: "headless" | "fetch";
  startedAt: string;
  finishedAt: string;
  pages: number;
  findings: number;
  unknown: number;
  preConsent: number;
  error?: string;
}

const STATUS_COPY: Record<ScanStatus, { label: string; tone: "live" | "ok" | "warn" | "bad" | "idle" }> = {
  queued: { label: "Queued", tone: "warn" },
  running: { label: "Running", tone: "live" },
  ok: { label: "Completed", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

const KIND_LABEL: Record<Finding["kind"], string> = { script: "Scripts", cookie: "Cookies and storage", iframe: "Embeds", pixel: "Pixels" };

/** A plain list of the crawler's log lines. Errors with a stack trace can be expanded. */
function LogList({ lines, emptyText }: { lines: ScanLogLine[]; emptyText: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines.length]);
  if (!lines.length) return <p className="px-5 py-4 text-sm text-ink-3">{emptyText}</p>;
  return (
    <div ref={box} className="scroll-thin max-h-80 overflow-y-auto" role="log" aria-label="Crawler log" tabIndex={0}>
      <ol className="divide-y divide-line text-sm">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`} className="flex gap-3 px-5 py-2">
            <time dateTime={l.at} className="shrink-0 font-mono text-xs leading-5 text-ink-3">
              {new Date(l.at).toISOString().slice(11, 19)}
            </time>
            <div className="min-w-0 flex-1">
              <p className={`[overflow-wrap:anywhere] ${l.level === "error" ? "text-destructive" : l.level === "warn" ? "text-warning" : "text-ink-2"}`}>
                {l.level !== "info" ? <span className="mr-1.5 font-medium uppercase">{l.level}</span> : null}
                {l.message}
              </p>
              {l.url && !l.message.includes(l.url) ? <p className="truncate font-mono text-xs text-ink-3">{l.url}</p> : null}
              {l.detail ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">Details</summary>
                  <pre className="mt-1 overflow-x-auto rounded-sm bg-raised px-3 py-2 text-xs leading-relaxed text-ink-2">{l.detail}</pre>
                </details>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const PHASES: ScanPhase[] = ["starting", "crawling", "finishing"];

/**
 * A scan in flight, in words people trust: which phase it's in, a running clock, roughly how long is
 * left, and that it's fine to leave. Ticks every second; the numbers come from the polled report.
 */
function LiveScanStatus({ report }: { report: ScanReport }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const eta = scanEta(report, now);
  const at = PHASES.indexOf(eta.phase);
  const left = remainingLabel(eta.remainingMs);
  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Scan steps">
        {PHASES.map((p, i) => {
          const state = i < at ? "done" : i === at ? "now" : "later";
          return (
            <li
              key={p}
              aria-current={state === "now" ? "step" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-inset ${
                state === "now" ? "bg-raised font-semibold text-ink ring-line-strong" : state === "done" ? "text-ink-3 ring-line" : "text-ink-3 ring-line"
              }`}
            >
              <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full text-2xs ${state === "done" ? "bg-success-wash text-success" : state === "now" ? "bg-surface ring-2 ring-marker" : "ring-1 ring-line-strong"}`}>
                {state === "done" ? <IconCheck size={11} /> : state === "now" ? <span className="size-1.5 animate-pulse rounded-full bg-ink motion-reduce:animate-none" /> : i + 1}
              </span>
              {PHASE_LABEL[p]}
              {p === "crawling" && state === "now" ? <span className="ml-auto font-normal tabular-nums text-ink-3">{eta.pagesDone}/{eta.pagesPlanned}</span> : null}
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-2" aria-live="off">
        <span className="font-semibold tabular-nums text-ink">{clock(eta.elapsedMs)}</span>
        <span>elapsed</span>
        {left ? <span className="text-ink-3">· {left}</span> : null}
      </p>
      {eta.slow ? (
        <Alert tone="warning" title="Taking longer than usual">
          Scanners start on demand, and this one is slow to start. It keeps trying for up to 15 minutes; if it still hasn&apos;t started by then it stops, and you can run it again.
        </Alert>
      ) : (
        <p className="text-xs text-ink-3">
          {eta.phase === "starting"
            ? "A fresh browser starts just for your site, which takes about a minute. "
            : "A real browser is opening your pages as a first-time visitor. "}
          You can leave this page; the scan keeps running and your overview updates when it&apos;s done.
        </p>
      )}
    </div>
  );
}

export function ScannerConsole({
  propertyId,
  domain,
  mode,
  limits,
  canWrite,
  initial,
  history,
  description,
  schedule,
}: {
  propertyId: string;
  domain: string;
  mode: CrawlerEngineMode;
  limits: { defaultPages: number; maxPages: number; defaultDepth: number; maxDepth: number };
  canWrite: boolean;
  /** the active scan if one is running, else the newest one */
  initial: ScanReport | null;
  history: ScanHistoryRow[];
  /** the page description, shown in the page header next to Scan now */
  description?: ReactNode;
  /** the automatic-scans card, shown beside the scan */
  schedule?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<ScanReport | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [maxPages, setMaxPages] = useState(limits.defaultPages);
  const [maxDepth, setMaxDepth] = useState(limits.defaultDepth);
  const [inspect, setInspect] = useState<ScanReport | null>(null);
  const [loadingLog, setLoadingLog] = useState<string | null>(null);
  const headless = mode !== "fetch";
  const active = report ? isScanActive(report) : false;

  const finished = useCallback(
    (r: ScanReport) => {
      if (r.status === "ok") toast(`Scan finished: ${r.findings.length} found on ${r.pages.length} page${r.pages.length === 1 ? "" : "s"}.`);
      else if (r.status === "failed") toast(r.error ?? "The scan failed.", "error");
      else if (r.status === "cancelled") toast("Scan cancelled.");
      router.refresh();
    },
    [router, toast],
  );

  // Follow a running crawl: poll every 1.5 s until it leaves queued/running. Each poll asks only for
  // the log lines after the newest one on screen and appends them.
  const reportId = report?.id;
  const shownLog = useRef<ScanLogLine[] | undefined>(report?.log);
  useEffect(() => {
    shownLog.current = report?.log;
  }, [report]);
  useEffect(() => {
    if (!reportId || !active) return;
    let stopped = false;
    let inFlight = false;
    const t = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      const last = shownLog.current?.at(-1);
      const polled = await pollScanStatus(propertyId, reportId, last ? { at: last.at, message: last.message } : null).finally(() => (inFlight = false));
      if (stopped || !polled) return;
      const next: ScanReport = { ...polled, log: mergePolledLog(shownLog.current, polled, SCAN_LOG_KEEP) };
      delete (next as Partial<typeof polled>).logMode;
      shownLog.current = next.log;
      setReport(next);
      if (!isScanActive(next)) {
        clearInterval(t);
        finished(next);
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [reportId, active, propertyId, finished]);

  const start = () =>
    startTransition(async () => {
      setError(null);
      const r = await scanTrackers(propertyId, headless ? { maxPages, maxDepth } : undefined);
      if (!r.ok) {
        setError(r.error);
        if (r.report) setReport(r.report);
        return;
      }
      setReport(r.report);
      if (!r.queued) finished(r.report);
    });

  const cancel = async () => {
    if (!report) return;
    setCancelling(true);
    const r = await cancelScan(propertyId, report.id);
    setCancelling(false);
    if (r?.error) toast(r.error, "error");
    const next = await getScanStatus(propertyId, report.id);
    if (next) setReport(next);
  };

  const openLog = async (id: string) => {
    setLoadingLog(id);
    const full = await getScanStatus(propertyId, id).finally(() => setLoadingLog(null));
    if (full) setInspect(full);
    else toast("That scan's log couldn't be loaded.", "error");
  };

  const status = report ? STATUS_COPY[report.status] : null;
  const scanned = report?.progress?.pagesScanned ?? report?.pages.length ?? 0;
  const queued = report?.progress?.pagesQueued ?? 0;
  const total = Math.max(report?.limits?.maxPages ?? (headless ? maxPages : 10), scanned + queued, 1);
  const found = report?.progress?.findings ?? report?.findings.length ?? 0;
  const byKind = (report?.findings ?? []).reduce<Record<string, number>>((m, f) => ((m[f.kind] = (m[f.kind] ?? 0) + 1), m), {});

  const historyColumns: Column<ScanHistoryRow>[] = [
    {
      id: "status",
      header: "Status",
      cell: (h) => <StatusDot tone={STATUS_COPY[h.status].tone} label={STATUS_COPY[h.status].label} showLabel />,
    },
    { id: "started", header: "Started", sortValue: (h) => Date.parse(h.startedAt), cell: (h) => <DateText iso={h.startedAt} mode="datetime" className="text-ink-2" /> },
    {
      id: "duration",
      header: "Duration",
      numeric: true,
      hideOnMobile: true,
      cell: (h) => <span className="text-ink-2">{h.finishedAt ? formatDuration(Date.parse(h.finishedAt) - Date.parse(h.startedAt)) : "–"}</span>,
    },
    { id: "pages", header: "Pages", numeric: true, sortValue: (h) => h.pages, cell: (h) => h.pages },
    { id: "found", header: "Found", numeric: true, sortValue: (h) => h.findings, cell: (h) => h.findings },
    {
      id: "pre",
      header: "Before consent",
      numeric: true,
      sortValue: (h) => h.preConsent,
      cell: (h) =>
        h.preConsent ? (
          <span className="inline-flex items-center gap-1 font-medium text-warning">
            <IconAlert size={13} aria-hidden />
            {h.preConsent}
          </span>
        ) : (
          <span className="text-ink-3">0</span>
        ),
    },
    {
      id: "log",
      header: <span className="sr-only">Log</span>,
      mobileLabel: "Log",
      align: "right",
      cell: (h) => (
        <Button variant="quiet" size="sm" onClick={() => openLog(h.id)} loading={loadingLog === h.id} loadingLabel="Opening">
          View log
        </Button>
      ),
    },
  ];

  const scanAction = canWrite ? (
    active ? (
      <Button variant="secondary" onClick={cancel} loading={cancelling} loadingLabel="Stopping">
        <IconStop size={15} aria-hidden /> Stop scan
      </Button>
    ) : (
      <Button onClick={start} loading={starting} loadingLabel="Starting">
        <IconRadar size={16} aria-hidden /> Scan now
      </Button>
    )
  ) : undefined;

  return (
    <>
      <PageHeader title="Scanner" description={description} actions={scanAction} />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="min-w-0 space-y-6">
            <Card aria-labelledby="scan-h">
              <CardHeader
                titleId="scan-h"
                title={active ? `Scanning ${domain}` : report ? "Latest scan" : `Scan ${domain}`}
                description={
                  headless
                    ? "A real browser visits as a first-time visitor and records every cookie, storage key, script, embed and pixel."
                    : "Reads up to 10 pages of HTML and checks them against the tracker database."
                }
                actions={status && report ? <StatusDot tone={status.tone} label={status.label} showLabel pulse={report.status === "running"} /> : undefined}
              />
              <CardBody className="space-y-4">
                {report ? (
                  <div className="space-y-2" aria-live="polite">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-2xl font-semibold tabular-nums tracking-tight">
                        {found}
                        <span className="ml-1.5 text-sm font-normal text-ink-3">found</span>
                      </p>
                      <p className="text-sm tabular-nums text-ink-3">
                        {report.status === "queued" ? "Starting a browser" : `${scanned} of ${total} pages`}
                        {report.finishedAt ? <> · {formatDuration(Date.parse(report.finishedAt) - Date.parse(report.startedAt))}</> : null}
                      </p>
                    </div>
                    <Progress
                      label="Scan progress"
                      value={report.status === "queued" ? undefined : report.status === "ok" ? total : scanned}
                      max={total}
                      valueText={`${scanned} of ${total} pages`}
                      tone={report.status === "failed" ? "bad" : report.status === "ok" ? "ok" : "brand"}
                    />
                    {active ? <LiveScanStatus report={report} /> : null}
                    <p className="text-xs text-ink-3">
                      Started <DateText iso={report.startedAt} mode="datetime" /> · {report.engine === "headless" ? "headless browser" : "HTML scan"}
                    </p>
                  </div>
                ) : (
                  <EmptyState bare headingLevel={3} icon={<IconRadar size={22} />} title="No scans yet">
                    {canWrite ? "Choose Scan now to find what your site sets before visitors consent." : "Scans run by your team appear here."}
                  </EmptyState>
                )}

                {error || report?.status === "failed" ? (
                  <Alert tone="danger" title={error ? "The scan didn't start." : "The scan didn't finish."}>
                    {error ?? report?.error ?? "Unknown error."}
                  </Alert>
                ) : null}

                {report?.preConsent?.length ? (
                  <Alert tone="warning" title={`${report.preConsent.length} tracker${report.preConsent.length === 1 ? " was" : "s were"} set before consent`}>
                    <span className="font-mono text-ink">{report.preConsent.slice(0, 8).join(", ")}</span>
                    {report.preConsent.length > 8 ? ` and ${report.preConsent.length - 8} more` : ""}. Check the{" "}
                    <Link href={`/app/sites/${propertyId}/install`} className="font-medium text-ink underline underline-offset-4">
                      install steps
                    </Link>
                    .
                  </Alert>
                ) : null}

                {report?.status === "ok" ? (
                  <div className="flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
                    <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      {(Object.keys(KIND_LABEL) as Finding["kind"][]).map((k) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-xs text-ink-3">{KIND_LABEL[k]}</dt>
                          <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{byKind[k] ?? 0}</dd>
                        </div>
                      ))}
                    </dl>
                    <ButtonLink href={`/app/sites/${propertyId}/trackers`} variant="secondary" size="sm" className="shrink-0">
                      <IconCookie size={15} aria-hidden /> Review in catalog
                    </ButtonLink>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card aria-labelledby="log-h">
              <CardHeader titleId="log-h" title="Log" description={active ? "Updates every couple of seconds while the scan runs." : "From the most recent scan."} />
              <LogList lines={report?.log ?? []} emptyText={report ? (active ? "Waiting for the crawler to start…" : "This scan has no log.") : "Nothing yet."} />
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            {headless ? (
              <Card aria-labelledby="scan-settings-h">
                <CardHeader titleId="scan-settings-h" title="Scan settings" description="Same-site links only. robots.txt is respected." />
                <CardBody>
                  <fieldset disabled={!canWrite || active} className="grid min-w-0 grid-cols-2 gap-4">
                    <legend className="sr-only">Scan settings</legend>
                    <TextField
                      id="scan-pages"
                      label="Max pages"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={limits.maxPages}
                      value={maxPages}
                      controlClassName="tabular-nums"
                      hint={`Up to ${limits.maxPages}`}
                      onChange={(e) => setMaxPages(Math.max(1, Math.min(limits.maxPages, Number(e.target.value) || 1)))}
                    />
                    <TextField
                      id="scan-depth"
                      label="Link depth"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={limits.maxDepth}
                      value={maxDepth}
                      controlClassName="tabular-nums"
                      hint={`Up to ${limits.maxDepth}`}
                      onChange={(e) => setMaxDepth(Math.max(1, Math.min(limits.maxDepth, Number(e.target.value) || 1)))}
                    />
                  </fieldset>
                </CardBody>
              </Card>
            ) : null}
            {schedule}
          </div>
        </div>

        <section aria-labelledby="hist-h" className="space-y-3">
          <div>
            <h2 id="hist-h" className="text-base font-semibold">
              History
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">{history.length ? `The last ${history.length} scans, newest first.` : "Every scan is kept here with its log."}</p>
          </div>
          <DataTable<ScanHistoryRow> rows={history} columns={historyColumns} caption="Scan history, newest first" rowKey={(h) => h.id} minWidth={680} empty="No scans yet." />
        </section>

        <Sheet open={inspect !== null} onClose={() => setInspect(null)} title="Scan log" description={inspect ? <DateText iso={inspect.startedAt} mode="datetime" /> : undefined} width={600}>
          {inspect ? (
            <div className="space-y-5">
              {inspect.error ? (
                <Alert tone="danger" title="Failed">
                  {inspect.error}
                </Alert>
              ) : null}
              <div className="-mx-5 border-y border-line">
                <LogList lines={inspect.log ?? []} emptyText="This scan has no log." />
              </div>
              {inspect.pages.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Pages visited</h3>
                  <ul className="divide-y divide-line rounded-md border border-line text-xs">
                    {inspect.pages.map((p) => {
                      const ok = p.status !== null && p.status < 400;
                      return (
                        <li key={p.url} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate font-mono text-ink-2">{p.url}</span>
                          <Badge tone={ok ? "success" : "danger"}>{p.status ?? p.note ?? "skipped"}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </Sheet>
      </div>
    </>
  );
}
