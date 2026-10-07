import Link from "next/link";
import { buttonClass } from "@/components/app/ui/button";
import { IconArrowRight, IconBrush, IconCheck, IconInstall, IconReceipt, IconScan, IconSpark } from "@/components/icons";

export interface SetupState {
  propertyId: string;
  domain: string;
  /** the banner was saved at least once (config version moved past the default) */
  bannerEdited: boolean;
  trackers: number;
  published: boolean;
  /** the script has loaded on the site at least once */
  seen: boolean;
  decisions: number;
  canWrite: boolean;
}

interface Step {
  id: string;
  title: string;
  done: boolean;
  why: string;
  cta: string;
  href: string;
  icon: typeof IconBrush;
}

function steps(s: SetupState): Step[] {
  const base = `/app/sites/${s.propertyId}`;
  return [
    {
      id: "banner",
      title: "Make the banner yours",
      done: s.bannerEdited,
      why: "Pick the layout, colours and wording visitors see. The fairness check keeps Accept and Reject equally easy.",
      cta: "Open the banner builder",
      href: `${base}/banner`,
      icon: IconBrush,
    },
    {
      id: "trackers",
      title: "List the trackers on your site",
      done: s.trackers > 0,
      why: `Scan ${s.domain} or add them by hand. Each one is held until the visitor allows its category.`,
      cta: "Scan for trackers",
      href: `${base}/trackers`,
      icon: IconScan,
    },
    {
      id: "publish",
      title: "Publish the banner",
      done: s.published,
      why: "Publishing pushes your banner to our CDN. Visitors only ever see the published version, never a draft.",
      cta: "Review and publish",
      href: `${base}/banner`,
      icon: IconSpark,
    },
    {
      id: "install",
      title: "Add the script to your site",
      done: s.seen,
      why: "One script tag in your site's <head>. This step completes when the banner loads on your site for the first time.",
      cta: "Get the snippet",
      href: `${base}/install`,
      icon: IconInstall,
    },
    {
      id: "decision",
      title: "Record the first consent decision",
      done: s.decisions > 0,
      why: "Open your site in a private window and choose on the banner. Every choice becomes a tamper-evident receipt.",
      cta: "Open the consent log",
      href: `${base}/logs`,
      icon: IconReceipt,
    },
  ];
}

export const setupComplete = (s: SetupState) => steps(s).every((x) => x.done);

/**
 * Getting started, as steps: what's done, the one thing to do next (expanded, with its button),
 * and what comes after. Shown on a site's overview until everything is done.
 */
export function SetupGuide(state: SetupState) {
  const list = steps(state);
  const done = list.filter((x) => x.done).length;
  const next = list.findIndex((x) => !x.done);

  return (
    <section aria-labelledby="setup-h" className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <h2 id="setup-h" className="text-base font-semibold">
            Set up {state.domain}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Five steps to a live, compliant banner. Numbers appear here after the first visitors choose.</p>
        </div>
        <div className="w-full sm:w-56">
          <p className="mb-1.5 flex justify-between text-xs text-ink-3">
            <span>Progress</span>
            <span className="font-medium tabular-nums text-ink">
              {done} of {list.length}
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-line" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={done}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(done / list.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="divide-y divide-line">
        {list.map((x, i) => {
          const current = i === next;
          const Icon = x.icon;
          return (
            <li key={x.id} aria-current={current ? "step" : undefined} className={`flex gap-4 px-5 sm:px-6 ${current ? "bg-brand-wash/30 py-5" : "py-3.5"}`}>
              {/* the step marker: a check when done, the number otherwise */}
              <span
                aria-hidden
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  x.done ? "bg-brand text-white" : current ? "bg-surface text-brand ring-2 ring-brand" : "bg-paper text-ink-3 ring-1 ring-inset ring-line"
                }`}
              >
                {x.done ? <IconCheck size={14} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-2 text-sm ${x.done ? "text-ink-3" : current ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                  {current ? <Icon size={16} className="text-brand" /> : null}
                  {x.title}
                  <span className="sr-only">{x.done ? " (done)" : current ? " (next step)" : " (to do)"}</span>
                </p>
                {current ? (
                  <>
                    <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-2">{x.why}</p>
                    {state.canWrite || x.id === "decision" || x.id === "install" ? (
                      <Link href={x.href} className={buttonClass("primary", "md", "mt-4")}>
                        {x.cta}
                        <IconArrowRight size={16} />
                      </Link>
                    ) : (
                      <p className="mt-3 text-xs text-ink-3">An owner, admin or editor can do this step.</p>
                    )}
                  </>
                ) : null}
              </div>
              {!current && !x.done ? (
                <Link href={x.href} className="hidden shrink-0 self-center text-xs font-medium text-ink-3 underline-offset-2 hover:text-brand hover:underline sm:block">
                  Go to step<span className="sr-only">: {x.title}</span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
