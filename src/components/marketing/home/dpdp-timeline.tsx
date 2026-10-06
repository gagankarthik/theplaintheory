"use client";

import { useNow } from "@/hooks/use-now";

const MILESTONES = [
  { at: "2025-11-13T00:00:00+05:30", date: "13 Nov 2025", title: "Rules notified" },
  { at: "2026-11-13T00:00:00+05:30", date: "13 Nov 2026", title: "Consent Manager registration opens" },
  { at: "2027-05-13T00:00:00+05:30", date: "13 May 2027", title: "Notice, consent and withdrawal duties apply" },
];

/** DPDP Rules milestones. Which one is "next" follows the visitor's clock (India time cut-over). */
export function DpdpTimeline({ buildTime }: { buildTime: number }) {
  const now = useNow(buildTime);
  const next = MILESTONES.findIndex((m) => Date.parse(m.at) > now);

  return (
    <ol aria-label="DPDP Rules timeline" className="grid gap-4 sm:grid-cols-3">
      {MILESTONES.map((m, i) => {
        const past = next === -1 || i < next;
        const isNext = i === next;
        return (
          <li key={m.at} className={`rounded-[12px] p-4 ring-1 ring-inset ${isNext ? "bg-brand text-white ring-brand" : "bg-surface ring-line"}`}>
            <p className={`text-xs font-medium ${isNext ? "text-white/80" : past ? "text-ink-3" : "text-brand"}`}>
              <time dateTime={m.at.slice(0, 10)}>{m.date}</time>
              {isNext ? ", next" : past ? ", in effect" : ""}
            </p>
            <p className={`mt-1.5 text-sm font-medium ${isNext ? "text-white" : "text-ink"}`}>{m.title}</p>
          </li>
        );
      })}
    </ol>
  );
}
