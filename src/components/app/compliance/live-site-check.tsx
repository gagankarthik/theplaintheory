"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { runSiteAudit } from "@/app/app/sites/[propertyId]/actions";
import { IconAlert, IconCheck, IconClose, IconExternal, IconInfo, IconScan } from "@/components/icons";
import { Button } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { Spinner } from "@/components/app/ui/spinner";
import { siteAuditFixHref, type SiteAuditReport, type SiteCheck, type SiteCheckStatus } from "@/lib/site-audit/types";

const STEPS = ["Fetching homepage", "Finding policy pages", "Checking"] as const;

const ICON: Record<SiteCheckStatus, { el: ReactNode; cls: string; sr: string }> = {
  fail: { el: <IconClose size={14} />, cls: "bg-rose text-white", sr: "Failing" },
  warn: { el: <IconAlert size={14} />, cls: "bg-amber-wash text-amber ring-1 ring-inset ring-amber-bright", sr: "Needs review" },
  pass: { el: <IconCheck size={14} />, cls: "bg-jade-wash text-jade", sr: "Passing" },
  unknown: { el: <IconInfo size={14} />, cls: "bg-paper text-ink-3 ring-1 ring-inset ring-line", sr: "Couldn't check" },
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
            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-jade-wash text-jade" : current ? "text-ink" : "bg-paper text-ink-3 ring-1 ring-inset ring-line"}`} aria-hidden>
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
    <figure className="mt-2.5 rounded-md border-l-2 border-line-strong bg-paper px-3.5 py-2.5">
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
              <li key={it} className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-2 ring-1 ring-inset ring-line">
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
              <Link
                href={siteAuditFixHref(propertyId, check.action.target)}
                className="inline-flex h-8 shrink-0 items-center self-start rounded-md px-2.5 text-xs font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)] max-sm:h-11"
              >
                {check.action.label}
              </Link>
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
            <li key={n.id} className="flex gap-2.5 rounded-md bg-paper px-3.5 py-2.5 text-sm text-ink-2 ring-1 ring-inset ring-line">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-ink-3" />
              {n.text}
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
                  <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">
                    ›
                  </span>
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
    <Button variant={report ? "ghost" : "primary"} size={report ? "sm" : "md"} loading={pending} loadingLabel="Checking" onClick={run}>
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
        <p role="alert" className="py-3 text-sm text-rose">
          {error}
        </p>
      ) : null}
    </div>
  );

  if (!report) {
    return (
      <div className="mt-8">
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
            We read the public pages of {domain}, the homepage and the privacy, grievance and contact pages it links to, and check what they actually say: a grievance contact, the 90-day answer
            time, rights, and trackers that load before consent. Takes up to 20 seconds.
          </p>
        </EmptyState>
      </div>
    );
  }

  const s = report.summary;
  return (
    <section aria-labelledby="live-h" className="mt-8 overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 id="live-h" className="text-base font-semibold">
            Live site check
          </h2>
          <p className="mt-0.5 max-w-[68ch] text-sm text-ink-3">
            What visitors to {domain} actually see, read from your public pages. Last checked{" "}
            <time dateTime={report.finishedAt} suppressHydrationWarning>
              {when(report.finishedAt)}
            </time>
            : {s.fail} failing, {s.warn} to review, {s.pass} passing{s.unknown ? `, ${s.unknown} couldn't check` : ""}.
          </p>
        </div>
        {button ? <div className="shrink-0">{button}</div> : null}
      </div>
      <div className="px-5 sm:px-6">
        {status}
        <Report report={report} propertyId={propertyId} />
      </div>
      <p className="border-t border-line bg-paper/60 px-5 py-3 text-xs text-ink-3 sm:px-6">
        This reads the HTML your server sends, without running JavaScript or clicking your banner, so it can miss things a browser would show. It isn&apos;t legal advice.
      </p>
    </section>
  );
}
