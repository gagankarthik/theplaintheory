import Link from "next/link";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Progress } from "@/components/app/ui/progress";
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
  /** the public docs section that explains this step */
  docs: string;
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
      docs: "/docs#banner",
    },
    {
      id: "trackers",
      title: "List the trackers on your site",
      done: s.trackers > 0,
      why: `Scan ${s.domain} or add them by hand. Each one is held until the visitor allows its category.`,
      cta: "Scan for trackers",
      href: `${base}/trackers`,
      icon: IconScan,
      docs: "/docs#scanner",
    },
    {
      id: "publish",
      title: "Publish the banner",
      done: s.published,
      why: "Publishing pushes your banner to our CDN. Visitors only ever see the published version, never a draft.",
      cta: "Review and publish",
      href: `${base}/banner`,
      icon: IconSpark,
      docs: "/docs#banner",
    },
    {
      id: "install",
      title: "Add the script to your site",
      done: s.seen,
      why: "One script tag in your site's <head>. This step completes when the banner loads on your site for the first time.",
      cta: "Get the snippet",
      href: `${base}/install`,
      icon: IconInstall,
      docs: "/docs#install",
    },
    {
      id: "decision",
      title: "Record the first consent decision",
      done: s.decisions > 0,
      why: "Open your site in a private window and choose on the banner. Every choice becomes a tamper-evident receipt.",
      cta: "Open the consent log",
      href: `${base}/logs`,
      icon: IconReceipt,
      docs: "/docs#analytics",
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
    <Card aria-labelledby="setup-h" className="overflow-hidden">
      <CardHeader
        titleId="setup-h"
        title={`Set up ${state.domain}`}
        description="Five steps to a live, compliant banner."
        actions={
          <div className="w-full sm:w-48">
            <p className="mb-1.5 flex justify-between text-xs text-ink-3">
              <span>Progress</span>
              <span className="font-medium tabular-nums text-ink">
                {done} of {list.length}
              </span>
            </p>
            <Progress label="Setup progress" value={done} max={list.length} valueText={`${done} of ${list.length} steps done`} size="sm" />
          </div>
        }
      />

      <ol className="divide-y divide-line">
        {list.map((x, i) => {
          const current = i === next;
          const Icon = x.icon;
          return (
            <li key={x.id} aria-current={current ? "step" : undefined} className={`relative flex gap-4 px-5 sm:px-6 ${current ? "bg-raised py-5" : "py-3.5"}`}>
              {/* current step: the marker bar on the leading edge, as in the nav */}
              {current ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-marker" /> : null}
              {/* the step marker: a tick when done, the number otherwise */}
              <span
                aria-hidden
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  x.done ? "bg-selected text-on-selected" : current ? "bg-surface text-ink ring-2 ring-inset ring-marker" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong"
                }`}
              >
                {x.done ? <IconCheck size={14} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-2 text-sm ${x.done ? "text-ink-3" : current ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                  {current ? <Icon size={16} className="text-ink-2" /> : null}
                  {x.title}
                  <span className="sr-only">{x.done ? " (done)" : current ? " (next step)" : " (to do)"}</span>
                </p>
                {current ? (
                  <>
                    <p className="mt-1 max-w-[60ch] text-sm text-ink-2">{x.why}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {state.canWrite || x.id === "decision" || x.id === "install" ? (
                        <ButtonLink href={x.href}>
                          {x.cta}
                          <IconArrowRight size={16} />
                        </ButtonLink>
                      ) : (
                        <p className="text-xs text-ink-3">An owner, admin or editor can do this step.</p>
                      )}
                      <Link href={x.docs} className="btn btn-link text-sm">
                        Learn more<span className="sr-only"> about this step</span>
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
              {!current && !x.done ? (
                <Link href={x.href} className="btn btn-link hidden shrink-0 self-center text-xs sm:inline-flex">
                  Go to step<span className="sr-only">: {x.title}</span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
