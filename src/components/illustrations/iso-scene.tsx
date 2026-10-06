import { BRAND_FACE, BRAND_FACE_DARK, Edge, IsoBox, Node, iso, type Vec3 } from "./iso";

type Face = "top" | "left" | "right";
export type SceneItem =
  | { kind: "box"; o: Vec3; s: Vec3; fill?: Partial<Record<Face, string>>; hidden?: boolean }
  | { kind: "edge"; a: Vec3; b: Vec3; dashed?: boolean }
  | { kind: "node"; p: Vec3 };

function corners(item: SceneItem): Vec3[] {
  if (item.kind === "edge") return [item.a, item.b];
  if (item.kind === "node") return [item.p];
  const [x, y, z] = item.o;
  const [w, d, h] = item.s;
  const out: Vec3[] = [];
  for (const dx of [0, w]) for (const dy of [0, d]) for (const dz of [0, h]) out.push([x + dx, y + dy, z + dz]);
  return out;
}

/** Renders scene items back-to-front with a viewBox fitted to their projected bounds. */
export function IsoScene({ items, label, className, pad = 8 }: { items: SceneItem[]; label: string; className?: string; pad?: number }) {
  const projected = items.flatMap(corners).map(iso);
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;

  return (
    <svg viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`} className={className} role="img" aria-label={label}>
      {items.map((it, i) =>
        it.kind === "box" ? (
          <IsoBox key={i} o={it.o} s={it.s} fill={it.fill} hidden={it.hidden} />
        ) : it.kind === "edge" ? (
          <Edge key={i} a={it.a} b={it.b} dashed={it.dashed} />
        ) : (
          <Node key={i} p={it.p} />
        ),
      )}
    </svg>
  );
}

/* ---------- Product illustrations ---------- */

const B = BRAND_FACE;
const BD = BRAND_FACE_DARK;

/** A page with the consent banner lifted off its lower edge. */
export const BANNER_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [110, 80, 3] },
  { kind: "edge", a: [0, 80, 3], b: [0, 80, 26], dashed: true },
  { kind: "edge", a: [110, 80, 3], b: [110, 80, 26], dashed: true },
  { kind: "edge", a: [110, 58, 3], b: [110, 58, 26], dashed: true },
  { kind: "box", o: [0, 58, 26], s: [110, 22, 3], fill: { top: B, left: BD, right: BD } },
  { kind: "node", p: [0, 0, 3] },
  { kind: "node", p: [110, 0, 3] },
];

/** Three tracker blocks: one released (solid, brand), two held (dashed outlines). */
export const BLOCKING_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [120, 40, 2] },
  { kind: "box", o: [8, 8, 2], s: [24, 24, 24], hidden: true },
  { kind: "box", o: [48, 8, 2], s: [24, 24, 24], fill: { right: B, left: BD } },
  { kind: "box", o: [88, 8, 2], s: [24, 24, 24], hidden: true },
];

/** Receipts stacked into a chain; the newest on top in brand. */
export const LEDGER_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [70, 50, 5] },
  { kind: "box", o: [0, 0, 14], s: [70, 50, 5] },
  { kind: "box", o: [0, 0, 28], s: [70, 50, 5] },
  { kind: "box", o: [0, 0, 42], s: [70, 50, 5], fill: { top: B, left: BD, right: BD } },
  { kind: "edge", a: [70, 50, 5], b: [70, 50, 14], dashed: true },
  { kind: "edge", a: [70, 50, 19], b: [70, 50, 28], dashed: true },
  { kind: "edge", a: [70, 50, 33], b: [70, 50, 42], dashed: true },
  { kind: "edge", a: [0, 50, 5], b: [0, 50, 14], dashed: true },
  { kind: "edge", a: [0, 50, 19], b: [0, 50, 28], dashed: true },
  { kind: "edge", a: [0, 50, 33], b: [0, 50, 42], dashed: true },
];

/** Three regions at different heights on one grid: a notice per jurisdiction. */
export const REGIONS_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [100, 100, 2], hidden: true },
  { kind: "edge", a: [50, 0, 2], b: [50, 100, 2], dashed: true },
  { kind: "edge", a: [0, 50, 2], b: [100, 50, 2], dashed: true },
  { kind: "box", o: [6, 6, 2], s: [38, 38, 16] },
  { kind: "box", o: [56, 6, 2], s: [38, 38, 30] },
  { kind: "box", o: [6, 56, 2], s: [38, 38, 8] },
  { kind: "box", o: [56, 56, 2], s: [38, 38, 48], fill: { right: B, left: BD, top: "var(--color-surface)" } },
];

/** A scanning plane passing through a page and catching two trackers. */
export const SCAN_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [100, 70, 3] },
  { kind: "box", o: [14, 12, 3], s: [14, 14, 14], hidden: true },
  { kind: "box", o: [70, 40, 3], s: [14, 14, 14], hidden: true },
  { kind: "box", o: [44, 0, 3], s: [2, 70, 44], fill: { right: B, left: BD, top: BD } },
];

/** A wireframe cube with one brand face: the API every surface is built on. */
export const API_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [60, 60, 60], hidden: true },
  { kind: "edge", a: [30, 0, 60], b: [30, 60, 60], dashed: true },
  { kind: "edge", a: [0, 30, 60], b: [60, 30, 60], dashed: true },
  { kind: "edge", a: [60, 30, 0], b: [60, 30, 60], dashed: true },
  { kind: "edge", a: [60, 0, 30], b: [60, 60, 30], dashed: true },
  { kind: "box", o: [0, 59, 0], s: [60, 1, 60], fill: { left: B, top: B, right: B } },
  { kind: "node", p: [0, 0, 60] },
  { kind: "node", p: [60, 0, 60] },
  { kind: "node", p: [60, 60, 60] },
  { kind: "node", p: [60, 0, 0] },
  { kind: "node", p: [60, 60, 0] },
];

/** Many client sites on one account, one of them selected. */
export const SITES_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [34, 26, 3] },
  { kind: "box", o: [42, 0, 0], s: [34, 26, 3] },
  { kind: "box", o: [84, 0, 0], s: [34, 26, 3] },
  { kind: "box", o: [0, 34, 0], s: [34, 26, 3] },
  { kind: "box", o: [42, 34, 0], s: [34, 26, 14], fill: { top: B, left: BD, right: BD } },
  { kind: "box", o: [84, 34, 0], s: [34, 26, 3] },
];

/** An archive drawer: years of receipts kept in order. */
export const ARCHIVE_SCENE: SceneItem[] = [
  { kind: "box", o: [0, 0, 0], s: [56, 44, 20] },
  { kind: "box", o: [0, 0, 22], s: [56, 44, 20] },
  { kind: "box", o: [0, 0, 44], s: [56, 44, 20] },
  { kind: "box", o: [8, 44, 47], s: [40, 18, 14], fill: { top: B, left: BD, right: B } },
];
