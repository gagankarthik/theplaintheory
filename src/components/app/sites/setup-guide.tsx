import Link from "next/link";
import { ButtonLink } from "@/components/app/ui/button";
import { Card, CardHeader } from "@/components/app/ui/card";
import { Progress } from "@/components/app/ui/progress";
import { IconArrowRight, IconBrush, IconCheck, IconCookie, IconInstall, IconRadar, IconReceipt, IconSpark } from "@/components/icons";
import type { SetupProgress, SetupStepId } from "@/lib/setup";

const ICON: Record<SetupStepId, typeof IconBrush> = {
  scan: IconRadar,
  review: IconCookie,
  banner: IconBrush,
  publish: IconSpark,
  install: IconInstall,
  decision: IconReceipt,
};

/** Steps anyone in the organization can take; the rest need an owner, admin or editor. */
const OPEN_TO_ALL: SetupStepId[] = ["install", "decision"];

/**
 * Getting started, as a checklist: what's done, the one thing to do next (expanded, with the page's
 * only primary button), and what comes after as quiet rows. Shown on a site's overview until every
 * step is done; the sidebar's progress card points here.
 */
export function SetupGuide({ domain, progress, canWrite }: { domain: string; progress: SetupProgress; canWrite: boolean }) {
  const { steps, done, total, next } = progress;
  return (
    <Card aria-labelledby="setup-h" className="overflow-hidden">
      <CardHeader
        titleId="setup-h"
        title={`Get ${domain} live`}
        description={`${total} steps, in order. Each one ticks itself off when it's done.`}
        actions={
          <div className="w-full sm:w-48">
            <p className="mb-1.5 flex justify-between text-xs text-ink-3">
              <span>Progress</span>
              <span className="font-medium tabular-nums text-ink">
                {done} of {total}
              </span>
            </p>
            <Progress label="Setup progress" value={done} max={total} valueText={`${done} of ${total} steps done`} size="sm" />
          </div>
        }
      />

      <ol className="divide-y divide-line">
        {steps.map((x, i) => {
          const current = x === next;
          const Icon = ICON[x.id];
          return (
            <li key={x.id} aria-current={current ? "step" : undefined} className={`relative flex gap-4 px-5 sm:px-6 ${current ? "bg-raised py-5" : "py-3.5"}`}>
              {current ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-marker" /> : null}
              <span
                aria-hidden
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  x.done ? "bg-success-wash text-success" : current ? "bg-surface text-ink ring-2 ring-inset ring-marker" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong"
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
                      {canWrite || OPEN_TO_ALL.includes(x.id) ? (
                        <ButtonLink href={x.href}>
                          {x.cta}
                          <IconArrowRight size={16} />
                        </ButtonLink>
                      ) : (
                        <p className="text-xs text-ink-3">An owner, admin or editor can do this step.</p>
                      )}
                      <Link href={x.docs} className="btn btn-link text-sm">
                        How this works<span className="sr-only">: {x.title}</span>
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
              {!current ? (
                <Link href={x.href} className="btn btn-link hidden shrink-0 self-center text-xs sm:inline-flex">
                  {x.done ? "Open" : "Go to step"}
                  <span className="sr-only">: {x.title}</span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
