/**
 * Hero background: an isometric lattice with a few nodes and highlighted paths, like the edge network
 * the consent script is served from. Pure SVG, decorative, no motion.
 */
import { useId } from "react";

const STEP = 96;
const TAN30 = Math.tan(Math.PI / 6);

export function Lattice({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const fadeId = `lattice-fade-${uid}`;
  const maskId = `lattice-mask-${uid}`;
  const w = 1600;
  const h = 1000;
  // horizontal run of a 30° line across the full height
  const run = h / TAN30;
  const lines: string[] = [];
  for (let x = -run; x < w + run; x += STEP * 2 * Math.cos(Math.PI / 6)) {
    lines.push(`M${x.toFixed(1)} 0L${(x + run).toFixed(1)} ${h}`);
    lines.push(`M${(x + run).toFixed(1)} 0L${x.toFixed(1)} ${h}`);
  }
  for (let x = 0; x <= w; x += STEP * 2) lines.push(`M${x} 0V${h}`);

  // highlighted route: a few connected segments with square nodes
  const route = [
    [180, 420],
    [180, 230],
    [345, 135],
    [345, 325],
  ];
  const route2 = [
    [1250, 610],
    [1415, 515],
    [1415, 325],
  ];
  const nodes = [...route, ...route2];

  return (
    <svg aria-hidden className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={fadeId} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="var(--color-white)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--color-white)" stopOpacity="0.15" />
        </radialGradient>
        <mask id={maskId}>
          <rect width={w} height={h} fill={`url(#${fadeId})`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <path d={lines.join("")} stroke="var(--color-white)" strokeOpacity="0.09" strokeWidth="1" fill="none" />
        <path d={`M${route.map((p) => p.join(" ")).join("L")}`} stroke="var(--color-white)" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
        <path d={`M${route2.map((p) => p.join(" ")).join("L")}`} stroke="var(--color-white)" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
        {nodes.map(([x, y], i) => (
          <rect key={i} x={x - 4} y={y - 4} width="8" height="8" fill="var(--color-white)" fillOpacity="0.75" />
        ))}
      </g>
    </svg>
  );
}
