import type { SVGProps } from "react";

/**
 * Plain Theory identity: the "I/O" mark.
 *
 * The P is built from the two halves of the power symbol: I (on) and O (off).
 * Consent is an on/off decision, and the letter carries that without needing a tagline.
 *
 * Geometry on a 24-unit artboard (documented on /brand):
 *   Stem (I)   x 3.7–7.3, y 3–21, full-round ends (r 1.8)
 *   Ring (O)   centre (14.3, 9), outer r 6, inner r 2.6, so weight 3.4 (optically equal to the 3.6 stem)
 *   Gap        1u between stem and ring
 *   Alignment  ring top = stem top; bounds 16.6 × 18 centred on (12, 12)
 */
export const MARK = {
  stem: { x: 3.7, y: 3, w: 3.6, h: 18, r: 1.8 },
  ring: { cx: 14.3, cy: 9, outer: 6, inner: 2.6 },
} as const;

/** Single filled path (even-odd) built from MARK, so the mark exports cleanly and prints in one colour. */
export const MARK_PATH =
  "M3.7 4.8a1.8 1.8 0 0 1 3.6 0v14.4a1.8 1.8 0 0 1-3.6 0z" + // stem
  "M20.3 9a6 6 0 1 1-12 0 6 6 0 1 1 12 0z" + // ring, outer
  "M16.9 9a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 1 1 5.2 0z"; // ring, counter

/** App-tile corner radius: 22.5% of the side, the proportion iOS and macOS use. */
export const TILE_RADIUS = 0.225;

export const BRAND = {
  ultramarine: "#2E2BD6",
  ultramarineOnInk: "#8E8CFF",
  ink: "#0B1020",
  paper: "#F4F5F8",
  white: "#FFFFFF",
} as const;

export type MarkVariant = "color" | "mono" | "reverse";

const MARK_FILL: Record<MarkVariant, string> = {
  color: BRAND.ultramarine,
  mono: "currentColor",
  reverse: BRAND.white,
};

type SvgProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; title?: string };

/** The bare mark. Decorative unless `title` is given. */
export function BrandMark({ size = 24, variant = "color", title, ...rest }: SvgProps & { variant?: MarkVariant }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={MARK_PATH} fill={MARK_FILL[variant]} fillRule="evenodd" />
    </svg>
  );
}

/** App icon / favicon tile. `brand`: white mark on ultramarine. `ink`: dark-mode tile. */
export function AppIcon({ size = 32, tone = "brand", title, ...rest }: SvgProps & { tone?: "brand" | "ink" }) {
  const bg = tone === "ink" ? BRAND.ink : BRAND.ultramarine;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx={32 * TILE_RADIUS} fill={bg} />
      <path d={MARK_PATH} transform="translate(4 4)" fill={BRAND.white} fillRule="evenodd" />
    </svg>
  );
}

/** Wordmark: Geist Semibold, tracked −3.5%. Inherits text colour. */
export function Wordmark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`whitespace-nowrap font-semibold leading-none ${className ?? ""}`}
      style={{ fontSize: size, letterSpacing: "-0.035em" }}
    >
      Plain Theory
    </span>
  );
}

/**
 * Lockups. Horizontal: mark height = 1.6 × wordmark size, gap = 0.5 × wordmark size.
 * Stacked: mark centred above the wordmark, for square placements.
 */
export function Lockup({
  layout = "horizontal",
  variant = "color",
  size = 18,
  className,
}: {
  layout?: "horizontal" | "stacked";
  variant?: MarkVariant;
  size?: number;
  className?: string;
}) {
  const stacked = layout === "stacked";
  return (
    <span
      className={`inline-flex items-center ${stacked ? "flex-col" : ""} ${className ?? ""}`}
      style={{ gap: Math.round(size * (stacked ? 0.7 : 0.5)) }}
    >
      <BrandMark size={Math.round(size * (stacked ? 2.6 : 1.6))} variant={variant} />
      <Wordmark size={size} />
    </span>
  );
}
