import type { SVGProps } from "react";

/** Regulation marks for the coverage strip. 24px grid, 1.6 stroke, matching the product icon set. */
type P = SVGProps<SVGSVGElement>;

function Frame({ children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Twelve five-point stars in a ring. */
function starPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

export function IconEuStars(p: P) {
  const d = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return starPath(12 + Math.cos(a) * 8.6, 12 + Math.sin(a) * 8.6, 2.3);
  }).join("");
  return (
    <Frame {...p}>
      <path d={d} fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** A cross within a square: the flag motif, without reproducing the flag. */
export function IconUkCross(p: P) {
  return (
    <Frame {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14M3 12h18" />
      <path d="M3.8 5.8 9 9.8M20.2 18.2 15 14.2M20.2 5.8 15 9.8M3.8 18.2 9 14.2" strokeOpacity=".55" />
    </Frame>
  );
}

/** A state-level law: a folded map with a location pin. */
export function IconCalifornia(p: P) {
  return (
    <Frame {...p}>
      <path d="M3 6.5 8.5 4.5l7 2 5.5-2v13l-5.5 2-7-2-5.5 2z" />
      <path d="M8.5 4.5v13M15.5 6.5v6" strokeOpacity=".5" />
      <path d="M15.5 21s-3.2-2.9-3.2-5.3a3.2 3.2 0 0 1 6.4 0c0 2.4-3.2 5.3-3.2 5.3z" fill="var(--color-surface)" />
      <circle cx="15.5" cy="15.6" r="1.1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** A spoked wheel, drawn with 12 spokes so it stays legible at icon size. */
export function IconChakra(p: P) {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `M${(12 + Math.cos(a) * 2.6).toFixed(2)} ${(12 + Math.sin(a) * 2.6).toFixed(2)}L${(12 + Math.cos(a) * 8.4).toFixed(2)} ${(12 + Math.sin(a) * 8.4).toFixed(2)}`;
  }).join("");
  return (
    <Frame {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d={spokes} strokeWidth={1.1} />
    </Frame>
  );
}

/** Two switches: consent signals sent to tags. */
export function IconConsentMode(p: P) {
  return (
    <Frame {...p}>
      <rect x="3" y="4.5" width="18" height="6.5" rx="3.25" />
      <circle cx="17.75" cy="7.75" r="1.9" fill="currentColor" stroke="none" />
      <rect x="3" y="13" width="18" height="6.5" rx="3.25" />
      <circle cx="6.25" cy="16.25" r="1.9" />
    </Frame>
  );
}

/** A browser window sending a privacy signal. */
export function IconBrowserSignal(p: P) {
  return (
    <Frame {...p}>
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M2.5 7.5h15" />
      <path d="M19.5 12.5a3 3 0 0 1 0 4M21.5 10.5a6 6 0 0 1 0 8" />
      <path d="M7 20h6" />
    </Frame>
  );
}
