"use client";

import { useId, useState } from "react";
import { MARK, MARK_PATH } from "./logo";

type Layer = "grid" | "keylines" | "fill";

const LAYERS: { id: Layer; label: string }[] = [
  { id: "grid", label: "Grid" },
  { id: "keylines", label: "Keylines" },
  { id: "fill", label: "Fill" },
];

const { stem, ring } = MARK;
const KEY = "var(--color-rose)";

/** Interactive construction drawing of the I/O mark. Layers toggle with accessible switches. */
export function ConstructionGrid() {
  const [on, setOn] = useState<Record<Layer, boolean>>({ grid: true, keylines: true, fill: true });
  const descId = useId();

  return (
    <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div role="group" aria-label="Diagram layers" className="flex flex-wrap gap-2 border-b border-line p-3">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="switch"
            aria-checked={on[l.id]}
            onClick={() => setOn((s) => ({ ...s, [l.id]: !s[l.id] }))}
            className="group inline-flex min-h-9 items-center gap-2.5 rounded-full px-3 text-sm font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-ink)] aria-checked:text-ink"
          >
            <span aria-hidden className="relative h-4 w-7 rounded-full bg-line-strong transition-colors group-aria-checked:bg-brand">
              <span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-200 group-aria-checked:translate-x-3" />
            </span>
            {l.label}
          </button>
        ))}
      </div>

      <svg viewBox="-1.5 -1.5 27 27" className="block aspect-square w-full bg-paper" role="img" aria-describedby={descId}>
        <title>Construction of the Plain Theory mark</title>
        {on.grid && (
          <g stroke="var(--color-line-strong)" vectorEffect="non-scaling-stroke">
            {Array.from({ length: 25 }, (_, i) => (
              <g key={i} strokeWidth={i % 6 === 0 ? 0.05 : 0.025}>
                <line x1={i} y1={0} x2={i} y2={24} />
                <line x1={0} y1={i} x2={24} y2={i} />
              </g>
            ))}
          </g>
        )}

        <path
          d={MARK_PATH}
          fillRule="evenodd"
          fill={on.fill ? "var(--color-brand)" : "none"}
          fillOpacity={on.keylines && on.fill ? 0.92 : 1}
          stroke={on.fill ? "none" : "var(--color-ink)"}
          strokeWidth={0.06}
        />

        {on.keylines && (
          <g fill="none" stroke={KEY} strokeWidth={0.05}>
            {/* stem end circles and ring circles */}
            <circle cx={stem.x + stem.r} cy={stem.y + stem.r} r={stem.r} strokeDasharray=".22 .18" />
            <circle cx={stem.x + stem.r} cy={stem.y + stem.h - stem.r} r={stem.r} strokeDasharray=".22 .18" />
            <circle cx={ring.cx} cy={ring.cy} r={ring.outer} strokeDasharray=".22 .18" />
            <circle cx={ring.cx} cy={ring.cy} r={ring.inner} strokeDasharray=".22 .18" />
            <circle cx={ring.cx} cy={ring.cy} r={0.14} fill={KEY} stroke="none" />
            {/* shared top line */}
            <line x1={2} y1={stem.y} x2={22} y2={stem.y} strokeDasharray=".4 .25" />

            <g stroke="var(--color-ink)" strokeWidth={0.045}>
              {/* stem width */}
              <line x1={stem.x} y1={22.6} x2={stem.x + stem.w} y2={22.6} />
              {/* gap */}
              <line x1={stem.x + stem.w} y1={9} x2={ring.cx - ring.outer} y2={9} />
              {/* ring weight */}
              <line x1={ring.cx + ring.inner} y1={16.4} x2={ring.cx + ring.outer} y2={16.4} />
            </g>
            <g fill="var(--color-ink)" stroke="none" fontSize={0.62} fontWeight={600} fontFamily="var(--font-sans)">
              <text x={stem.x + stem.w / 2} y={23.55} textAnchor="middle">
                3.6
              </text>
              <text x={(stem.x + stem.w + ring.cx - ring.outer) / 2} y={8.6} textAnchor="middle">
                1
              </text>
              <text x={ring.cx + (ring.inner + ring.outer) / 2} y={17.35} textAnchor="middle">
                3.4
              </text>
            </g>
          </g>
        )}
      </svg>
      <figcaption id={descId} className="border-t border-line px-5 py-4 text-sm text-ink-2">
        The stem is 3.6 units wide with fully rounded ends. The ring is 3.4 units thick, a touch lighter so it looks equal
        to the stem, and its top sits on the same line. One unit separates I from O.
      </figcaption>
    </figure>
  );
}
