"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cancelScan, getScanStatus, scanTrackers } from "@/app/app/sites/[propertyId]/tracker-actions";
import { Alert } from "@/components/app/ui/alert";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DateText } from "@/components/app/ui/date-text";
import { EmptyState } from "@/components/app/ui/empty-state";
import { Progress } from "@/components/app/ui/progress";
import { Sheet } from "@/components/app/ui/sheet";
import { StatusDot } from "@/components/app/ui/status-dot";
import { useToast } from "@/components/app/ui/toast";
import { IconCookie, IconRadar, IconStop } from "@/components/icons";
import { isScanActive, type Finding, type ScanLogLine, type ScanReport, type ScanStatus } from "@/lib/trackers";
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
      <ol className="divide-y divide-line text-[0.8125rem]">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`} className="flex gap-3 px-5 py-2">
            <time dateTime={l.at} className="shrink-0 font-mono text-xs leading-5 text-ink-3">
              {new Date(l.at).toISOString().slice(11, 19)}
            </time>
            <div className="min-w-0 flex-1">
              <p className={`[overflow-wrap:anywhere] ${l.level === "error" ? "text-rose" : l.level === "warn" ? "text-amber" : "text-ink-2"}`}>
                {l.level !== "info" ? <span className="mr-1.5 font-medium uppercase">{l.level}</span> : null}
                {l.message}
              </p>
              {l.url && !l.message.includes(l.url) ? <p className="truncate font-mono text-xs text-ink-3">{l.url}</p> : null}
              {l.detail ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">Details</summary>
                  <pre className="mt-1 overflow-x-auto rounded-[6px] bg-paper px-3 py-2 text-xs leading-relaxed text-ink-2">{l.detail}</pre>
                </details>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
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
}: {
  propertyId: string;
  domain: string;
  mode: CrawlerEngineMode;
  limits: { defaultPages: number; maxPages: number; defaultDepth: number; maxDepth: number };
  canWrite: boolean;
  /** the active scan if one is running, else the newest one */
  initial: ScanReport | null;
  history: ScanHistoryRow[];
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

  // Follow a running crawl: poll every 1.5 s until it leaves queued/running.
  const reportId = report?.id;
  useEffect(() => {
    if (!reportId || !active) return;
    let stopped = false;
    const t = setInterval(async () => {
      const next = await getScanStatus(propertyId, reportId);
      if (stopped || !next) return;
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

  const status = report ? STATUS_COPY[report.status] : null;
  const scanned = report?.progress?.pagesScanned ?? report?.pages.length ?? 0;
  const queued = report?.progress?.pagesQueued ?? 0;
  const total = Math.max(report?.limits?.maxPages ?? (headless ? maxPages : 10), scanned + queued, 1);
  const found = report?.progress?.findings ?? report?.findings.length ?? 0;
  const byKind = (report?.findings ?? []).reduce<Record<string, number>>((m, f) => ((m[f.kind] = (m[f.kind] ?? 0) + 1), m), {});

  return (
    <div className="space-y-6">
      <Card aria-labelledby="scan-h">
        <CardHeader
          titleId="scan-h"
          title={`Scan ${domain}`}
          description={
            headless
              ? "Visits your site in a real browser as a first-time visitor, and records every cookie (including HttpOnly), storage key, script, embed and pixel."
              : "Reads up to 10 pages of your site's HTML and checks every script, embed, pixel and cookie against the tracker database."
          }
          actions={
            canWrite ? (
              active ? (
                <Button variant="ghost" onClick={cancel} loading={cancelling} loadingLabel="Stopping">
                  <IconStop size={15} aria-hidden /> Stop scan
                </Button>
              ) : (
                <Button onClick={start} loading={starting} loadingLabel="Starting">
                  <IconRadar size={16} aria-hidden /> Scan now
                </Button>
              )
            ) : undefined
          }
        />
        <CardBody className="space-y-4">
          {canWrite && headless && !active ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <label className="flex items-center gap-2 text-ink-2">
                Max pages
                <input
                  type="number"
                  min={1}
                  max={limits.maxPages}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Math.max(1, Math.min(limits.maxPages, Number(e.target.value) || 1)))}
                  className="field h-8 w-20"
                />
              </label>
              <label className="flex items-center gap-2 text-ink-2">
                Link depth
                <input
                  type="number"
                  min={1}
                  max={limits.maxDepth}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Math.max(1, Math.min(limits.maxDepth, Number(e.target.value) || 1)))}
                  className="field h-8 w-16"
                />
              </label>
              <span className="text-xs text-ink-3">Same-site links only. robots.txt is respected.</span>
            </div>
          ) : null}

          {report ? (
            <div className="space-y-2" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {status ? <StatusDot tone={status.tone} label={status.label} showLabel /> : null}
                <span className="text-xs text-ink-3">
                  {report.status === "queued" ? "Waiting for a crawler worker" : `${scanned} of ${total} pages`} · {found} found
                  {report.finishedAt ? <> · {formatDuration(Date.parse(report.finishedAt) - Date.parse(report.startedAt))}</> : null}
                </span>
              </div>
              <Progress
                label="Scan progress"
                value={report.status === "queued" ? undefined : report.status === "ok" ? total : scanned}
                max={total}
                valueText={`${scanned} of ${total} pages`}
                tone={report.status === "failed" ? "bad" : report.status === "ok" ? "ok" : "brand"}
              />
              <p className="text-xs text-ink-3">
                Started <DateText iso={report.startedAt} mode="datetime" /> · {report.engine === "headless" ? "headless browser" : "HTML scan"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-3">No scans yet. Start one to build the cookie catalog.</p>
          )}

          {error || report?.status === "failed" ? (
            <Alert tone="danger" title={error ? "The scan didn't start." : "The scan didn't finish."}>
              {error ?? report?.error ?? "Unknown error."}
            </Alert>
          ) : null}

          {report?.preConsent?.length ? (
            <Alert tone="warning" title={`${report.preConsent.length} tracker${report.preConsent.length === 1 ? " was" : "s were"} set before consent`}>
              These ran before the visitor chose anything: <span className="font-mono text-ink">{report.preConsent.slice(0, 8).join(", ")}</span>
              {report.preConsent.length > 8 ? ` and ${report.preConsent.length - 8} more` : ""}. Check the{" "}
              <Link href={`/app/sites/${propertyId}/install`} className="text-brand underline underline-offset-4">
                install instructions
              </Link>
              .
            </Alert>
          ) : null}

          {report?.status === "ok" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line px-4 py-3 text-sm">
              <span className="flex flex-wrap gap-x-5 gap-y-1 text-ink-2">
                {(Object.keys(KIND_LABEL) as Finding["kind"][]).map((k) => (
                  <span key={k}>
                    {KIND_LABEL[k]} <span className="font-medium text-ink">{byKind[k] ?? 0}</span>
                  </span>
                ))}
              </span>
              <ButtonLink href={`/app/sites/${propertyId}/trackers`} variant="ghost" size="sm">
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

      <Card aria-labelledby="hist-h">
        <CardHeader titleId="hist-h" title="Scan history" description={history.length ? `The last ${history.length} scans, newest first.` : undefined} />
        {history.length === 0 ? (
          <EmptyState bare icon={<IconRadar size={22} />} title="No scans yet">
            Your scans will be listed here.
          </EmptyState>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">Scan history, newest first</caption>
              <thead className="border-b border-line text-xs text-ink-3">
                <tr>
                  <th scope="col" className="h-10 px-5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    Started
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Duration
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Pages
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Found
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Before consent
                  </th>
                  <th scope="col" className="pr-5">
                    <span className="sr-only">Log</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((h) => {
                  const s = STATUS_COPY[h.status];
                  return (
                    <tr key={h.id}>
                      <td className="px-5 py-3">
                        <StatusDot tone={s.tone} label={s.label} showLabel />
                      </td>
                      <td className="px-3 py-3 text-ink-2">
                        <DateText iso={h.startedAt} mode="datetime" />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-2">{h.finishedAt ? formatDuration(Date.parse(h.finishedAt) - Date.parse(h.startedAt)) : "–"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{h.pages}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{h.findings}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${h.preConsent ? "text-amber" : "text-ink-3"}`}>{h.preConsent}</td>
                      <td className="py-3 pr-5 text-right">
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={async () => {
                            const full = await getScanStatus(propertyId, h.id);
                            if (full) setInspect(full);
                          }}
                        >
                          View log
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                <p className="mb-2 text-sm font-medium">Pages visited</p>
                <ul className="divide-y divide-line rounded-[10px] border border-line text-xs">
                  {inspect.pages.map((p) => (
                    <li key={p.url} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate font-mono text-ink-2">{p.url}</span>
                      <span className={p.status !== null && p.status < 400 ? "text-jade" : "text-rose"}>{p.status ?? p.note ?? "skipped"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
