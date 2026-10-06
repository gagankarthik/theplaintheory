/**
 * Isometric line-art kit. True isometric projection (30°), drawn as hairline ink strokes with
 * dotted hidden edges and a single ultramarine face per drawing.
 */

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

export type Vec3 = [x: number, y: number, z: number];

/** Project a 3D point onto the 2D isometric plane. */
export function iso([x, y, z]: Vec3): [number, number] {
  return [(x - y) * COS, (x + y) * SIN - z];
}

export const pts = (...p: Vec3[]) =>
  p
    .map(iso)
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

export const INK = "var(--color-ink)";
export const BRAND_FACE = "var(--color-brand-bright)";
export const BRAND_FACE_DARK = "var(--color-brand)";
export const PAPER_FACE = "var(--color-surface)";

type Face = "top" | "left" | "right";

/**
 * A box from origin `o` with size `s`. Visible faces: top, left (+y side), right (+x side).
 * `fill` colours individual faces; `hidden` draws the three back edges as dotted lines.
 */
export function IsoBox({
  o,
  s,
  fill = {},
  hidden = false,
  strokeWidth = 1,
}: {
  o: Vec3;
  s: Vec3;
  fill?: Partial<Record<Face, string>>;
  hidden?: boolean;
  strokeWidth?: number;
}) {
  const [x, y, z] = o;
  const [w, d, h] = s;
  const top = pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]);
  const left = pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]);
  const right = pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]);
  const back = [
    [[x, y, z], [x + w, y, z]],
    [[x, y, z], [x, y + d, z]],
    [[x, y, z], [x, y, z + h]],
  ] as [Vec3, Vec3][];

  return (
    <g stroke={INK} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {hidden &&
        back.map(([a, b], i) => {
          const [x1, y1] = iso(a);
          const [x2, y2] = iso(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="2 3" strokeOpacity={0.5} />;
        })}
      <polygon points={left} fill={fill.left ?? (hidden ? "none" : PAPER_FACE)} />
      <polygon points={right} fill={fill.right ?? (hidden ? "none" : PAPER_FACE)} />
      <polygon points={top} fill={fill.top ?? (hidden ? "none" : PAPER_FACE)} />
    </g>
  );
}

/** A small square node marker, as used at lattice intersections. */
export function Node({ p, size = 5 }: { p: Vec3; size?: number }) {
  const [x, y] = iso(p);
  return <rect x={x - size / 2} y={y - size / 2} width={size} height={size} fill={INK} />;
}

export function Edge({ a, b, dashed }: { a: Vec3; b: Vec3; dashed?: boolean }) {
  const [x1, y1] = iso(a);
  const [x2, y2] = iso(b);
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={INK}
      strokeWidth={1}
      strokeDasharray={dashed ? "2 3" : undefined}
      strokeOpacity={dashed ? 0.55 : 1}
      vectorEffect="non-scaling-stroke"
    />
  );
}
