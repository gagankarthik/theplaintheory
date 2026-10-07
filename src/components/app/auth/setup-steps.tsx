import { IconCheck } from "@/components/icons";

const SETUP = ["Account", "Verify email", "Workspace", "Plan"] as const;

/**
 * Where someone is in getting started: create the account, confirm the email, then set up the
 * workspace (with its first site) and choose a plan in onboarding. Finished steps show a tick.
 */
export function SetupSteps({ current = 0 }: { current?: number }) {
  return (
    <nav aria-label="Setup progress" className="mb-9 short:mb-6">
      <ol className="flex items-start">
        {SETUP.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex flex-1 items-start last:flex-none" aria-current={active ? "step" : undefined}>
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className={`grid size-7 place-items-center rounded-full text-xs font-semibold transition-colors ${
                    done ? "bg-brand-wash text-brand ring-1 ring-inset ring-brand/25" : active ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(46,43,214,0.7)]" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : i + 1}
                </span>
                <span className={`max-w-[5.5rem] text-2xs font-medium leading-tight sm:text-xs ${active ? "text-ink" : "text-ink-3"}`}>
                  <span className="sr-only">
                    Step {i + 1} of {SETUP.length}
                    {done ? ", done" : active ? ", current" : ""}:{" "}
                  </span>
                  {s}
                </span>
              </div>
              {i < SETUP.length - 1 ? (
                <span aria-hidden className="mx-1.5 mt-3.5 h-px flex-1 bg-line sm:mx-2">
                  <span className={`block h-full bg-brand ${done ? "w-full" : "w-0"}`} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
