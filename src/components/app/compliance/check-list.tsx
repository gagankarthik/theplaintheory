import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconClose } from "@/components/icons";
import type { Severity } from "@/lib/fairness";

export interface CheckRow {
  id: string;
  severity: Severity;
  title: string;
  detail: ReactNode;
  /** small tag shown after the title, e.g. "GDPR" */
  tag?: string;
  /** legal reference shown under the detail */
  ref?: string;
  fix?: { label: string; href?: string; onClick?: () => void };
}

const ICON: Record<Severity, { el: ReactNode; cls: string; sr: string }> = {
  fail: { el: <IconClose size={14} />, cls: "bg-rose text-white", sr: "Fails" },
  warn: { el: <IconAlert size={14} />, cls: "bg-amber-wash text-amber ring-1 ring-inset ring-amber-bright", sr: "Needs attention" },
  pass: { el: <IconCheck size={14} />, cls: "bg-jade-wash text-jade", sr: "Passes" },
};

const ORDER: Record<Severity, number> = { fail: 0, warn: 1, pass: 2 };

/** List of pass/warn/fail checks. Status is carried by an icon and screen-reader text, never colour alone. */
export function CheckList({ rows, sort = true, dense }: { rows: CheckRow[]; sort?: boolean; dense?: boolean }) {
  const list = sort ? [...rows].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]) : rows;
  return (
    <ul className="divide-y divide-line">
      {list.map((r) => {
        const i = ICON[r.severity];
        return (
          <li key={r.id} className={`flex gap-3 ${dense ? "py-3" : "py-4"}`}>
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${i.cls}`} aria-hidden>
              {i.el}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
                <span className="sr-only">{i.sr}: </span>
                {r.title}
                {r.tag ? <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">{r.tag}</span> : null}
              </p>
              <p className="mt-0.5 text-sm text-ink-2">{r.detail}</p>
              {r.ref ? <p className="mt-1 text-xs text-ink-3">{r.ref}</p> : null}
            </div>
            {r.fix && r.severity !== "pass" ? (
              <div className="shrink-0 self-center">
                {r.fix.href ? (
                  <Link href={r.fix.href} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]">
                    {r.fix.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={r.fix.onClick}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]"
                  >
                    {r.fix.label}
                  </button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Circular score with the number as text; the ring is decorative. */
export function ScoreRing({ value, label, size = 64 }: { value: number; label: string; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = value >= 90 ? "var(--color-jade)" : value >= 60 ? "var(--color-amber-bright)" : "var(--color-rose)";
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums" aria-hidden>
        {value}%
      </span>
    </div>
  );
}
