"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { Segmented } from "./segmented";

export type CompareValue = boolean | string;
export interface CompareGroup {
  name: string;
  rows: { feature: string; values: CompareValue[] }[];
}

export function CompareCell({ value }: { value: CompareValue }) {
  if (value === true)
    return (
      <>
        <IconCheck size={18} className="text-ink" />
        <span className="sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <span aria-hidden className="block h-px w-3 bg-line-strong" />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className="text-sm text-ink">{value}</span>;
}

/** Small screens: pick one plan at a time instead of five long stacked lists. */
export function CompareByPlan({ plans, groups }: { plans: { id: string; name: string }[]; groups: CompareGroup[] }) {
  const [active, setActive] = useState(plans.find((p) => p.id === "growth")?.id ?? plans[0].id);
  const index = plans.findIndex((p) => p.id === active);
  const plan = plans[index];
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Segmented label="Plan to compare" size="sm" value={active} onChange={setActive} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
      </div>
      <section aria-labelledby="compare-plan-title" className="mt-6">
        <h3 id="compare-plan-title" className="text-lg font-semibold">
          {plan.name}
        </h3>
        {groups.map((g) => (
          <div key={g.name} className="mt-5">
            <p className="text-sm font-medium text-ink-3">{g.name}</p>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {g.rows.map((r) => (
                <li key={r.feature} className="flex min-h-11 items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-ink-2">{r.feature}</span>
                  <span className="shrink-0 text-right">
                    <CompareCell value={r.values[index]} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
