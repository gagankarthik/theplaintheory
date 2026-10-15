"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { runSiteAudit } from "@/app/app/sites/[propertyId]/actions";
import { IconAlert, IconCheck, IconChevronRight, IconClose, IconExternal, IconInfo, IconScan } from "@/components/icons";
import { Alert } from "@/components/app/ui/alert";
import { Button, ButtonLink } from "@/components/app/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/app/ui/card";
import { EmptyState } from "@/components/app/ui/empty-state";
import { Spinner } from "@/components/app/ui/spinner";
import { siteAuditFixHref, type SiteAuditReport, type SiteCheck, type SiteCheckStatus } from "@/lib/site-audit/types";

const STEPS = ["Fetching homepage", "Finding policy pages", "Checking"] as const;

const ICON: Record<SiteCheckStatus, { el: ReactNode; cls: string; sr: string }> = {
  fail: { el: <IconClose size={14} />, cls: "bg-destructive-wash text-destructive", sr: "Failing" },
  warn: { el: <IconAlert size={14} />, cls: "bg-warning-wash text-warning", sr: "Needs review" },
  pass: { el: <IconCheck size={14} />, cls: "bg-success-wash text-success", sr: "Passing" },
  unknown: { el: <IconInfo size={14} />, cls: "bg-raised text-ink-3 ring-1 ring-inset ring-line", sr: "Couldn't check" },
};

const GROUPS: { status: SiteCheckStatus; title: string; hint?: string }[] = [
  { status: "fail", title: "Failing" },
  { status: "warn", title: "Needs review" },
  { status: "pass", title: "Passing" },
  { status: "unknown", title: "Couldn't check", hint: "We couldn't read enough of your site to decide. This isn't a failure." },
];

/** "acme.in/privacy" from a full URL */
function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Pending state: a run takes up to 20 seconds, so show where it is. The steps are estimates. */
function Progress({ step }: { step: number }) {
  return (
    <ol className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-0" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex items-center gap-2 sm:after:mx-3 sm:after:h-px sm:after:w-6 sm:after:bg-line sm:last:after:hidden">
            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-success-wash text-success" : current ? "text-ink" : "bg-raised text-ink-3 ring-1 ring-inset ring-line"}`} aria-hidden>
              {done ? <IconCheck size={12} /> : current ? <Spinner size={16} /> : null}
            </span>
            <span className={current ? "font-medium text-ink" : done ? "text-ink-2" : "text-ink-3"}>
              {label}
              <span className="sr-only">{done ? " (done)" : current ? " (in progress)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Evidence({ check }: { check: SiteCheck }) {
  const ev = check.evidence;
  if (!ev) return null;
  return (
    <figure className="mt-2.5 rounded-md border-l-2 border-line-strong bg-raised px-3.5 py-2.5">
      {ev.quote ? <blockquote className="text-sm leading-relaxed text-ink-2">&ldquo;{ev.quote}&rdquo;</blockquote> : null}
      <figcaption className={`text-xs text-ink-3 ${ev.quote ? "mt-1.5" : ""}`}>
        <a href={ev.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
          {shortUrl(ev.url)}
          <IconExternal size={12} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}

function Row({ check, propertyId }: { check: SiteCheck; propertyId: string }) {
  const i = ICON[check.status];
  const showFix = check.status !== "pass" && (check.fix || check.action);
  return (
    <li className="flex gap-3 py-4">
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${i.cls}`} aria-hidden>
        {i.el}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold text-ink">
          <span className="sr-only">{i.sr}: </span>
          {check.title}
        </h4>
        <p className="mt-0.5 text-sm text-ink-2">{check.finding}</p>
        {check.items?.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Found">
            {check.items.map((it) => (
              <li key={it} className="rounded-full bg-raised px-2 py-0.5 text-xs text-ink-2 ring-1 ring-inset ring-line">
                {it}
              </li>
            ))}
          </ul>
        ) : null}
        <Evidence check={check} />
        {showFix ? (
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            {check.fix ? (
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">Fix: </span>
                {check.fix}
              </p>
            ) : (
              <span />
            )}
            {check.action ? (
              <ButtonLink href={siteAuditFixHref(propertyId, check.action.target)} variant="secondary" size="sm" className="shrink-0 self-start">
                {check.action.label}
                <span className="sr-only">: {check.title}</span>
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
        <p className="mt-1.5 text-xs text-ink-3">{check.ref}</p>
      </div>
    </li>
  );
}

function Report({ report, propertyId }: { report: SiteAuditReport; propertyId: string }) {
  const read = report.pages.filter((p) => p.kind !== "robots");
  return (
    <div>
      {report.notices.length ? (
        <ul className="mb-2 flex flex-col gap-2 pt-4">
          {report.notices.map((n) => (
            <li key={n.id}>
              <Alert tone="info">{n.text}</Alert>
            </li>
          ))}
        </ul>
      ) : null}

      {GROUPS.map((g) => {
        const rows = report.checks.filter((c) => c.status === g.status);
        if (!rows.length) return null;
        const head = (
          <>
            {g.title} <span className="font-normal text-ink-3">({rows.length})</span>
          </>
        );
        const list = (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <Row key={c.id} check={c} propertyId={propertyId} />
            ))}
          </ul>
        );
        return (
          <section key={g.status} aria-label={`${g.title}, ${rows.length}`} className="border-t border-line pt-4 first:border-t-0">
            {g.status === "pass" ? (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <IconChevronRight size={16} aria-hidden className="text-ink-3 transition-transform duration-150 ease-out group-open:rotate-90" />
                  <h3>{head}</h3>
                </summary>
                {list}
              </details>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-ink">{head}</h3>
                {g.hint ? <p className="mt-0.5 text-xs text-ink-3">{g.hint}</p> : null}
                {list}
              </>
            )}
          </section>
        );
      })}

      <details className="border-t border-line py-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-ink-2 hover:text-ink">Pages we read ({read.filter((p) => p.status === 200).length})</summary>
        <ul className="mt-1 flex flex-col gap-1.5 pb-2">
          {read.map((p) => (
            <li key={`${p.kind}-${p.url}`} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="break-all text-ink-2">{shortUrl(p.url)}</span>
              <span className="text-ink-3">{p.status === 200 ? "Read" : (p.note ?? (p.status ? `HTTP ${p.status}` : "Not read"))}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function LiveSiteCheck({ propertyId, domain, initial, canRun }: { propertyId: string; domain: string; initial: SiteAuditReport | null; canRun: boolean }) {
  const [report, setReport] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = () => {
    setError(null);
    setStep(0);
    timers.current.forEach(clearTimeout);
    timers.current = [setTimeout(() => setStep(1), 2500), setTimeout(() => setStep(2), 7000)];
    start(async () => {
      const r = await runSiteAudit(propertyId);
      timers.current.forEach(clearTimeout);
      if (r.ok) setReport(r.report);
      else setError(r.error);
    });
  };

  const button = canRun ? (
    <Button variant={report ? "secondary" : "primary"} size={report ? "sm" : "md"} loading={pending} loadingLabel="Checking" onClick={run}>
      {report ? null : <IconScan size={18} />}
      {report ? "Check again" : "Check my live site"}
    </Button>
  ) : null;

  const status = (
    <div aria-live="polite" className="empty:hidden">
      {pending ? (
        <div className="py-4">
          <Progress step={step} />
        </div>
      ) : null}
      {error ? (
        <div className="py-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </div>
  );

  if (!report) {
    return (
      <div>
        <EmptyState
          icon={<IconScan size={22} />}
          title="Check what visitors see on your live site"
          action={
            <div className="flex flex-col items-start gap-1 sm:items-center">
              {button ?? <p className="text-sm text-ink-3">Ask an owner, admin or editor to run the first check.</p>}
              {status}
            </div>
          }
        >
          <p>
            We read {domain}&apos;s homepage and the privacy, grievance and contact pages it links to, and check what they say: a grievance contact, the 90-day answer time, rights, and trackers
            that load before consent. Takes up to 20 seconds.
          </p>
        </EmptyState>
      </div>
    );
  }

  const s = report.summary;
  return (
    <Card aria-labelledby="live-h">
      <CardHeader
        titleId="live-h"
        title="Live site check"
        description={
          <>
            Checked{" "}
            <time dateTime={report.finishedAt} suppressHydrationWarning>
              {when(report.finishedAt)}
            </time>
            : {s.fail} failing, {s.warn} to review, {s.pass} passing{s.unknown ? `, ${s.unknown} couldn't check` : ""}.
          </>
        }
        actions={button}
      />
      <div className="px-5 sm:px-6">
        {status}
        <Report report={report} propertyId={propertyId} />
      </div>
      <CardFooter align="start" className="text-xs text-ink-3">
        This reads the HTML your server sends, without running JavaScript or clicking your banner, so it can miss things a browser would show. It isn&apos;t legal advice.
      </CardFooter>
    </Card>
  );
}
