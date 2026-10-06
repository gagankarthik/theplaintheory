import type { SVGProps } from "react";
import { AppIcon, Lockup } from "../brand/logo";

/**
 * The Plain Theory icon set. Drawn on a 24px grid, 1.75 stroke, round joins.
 * Every icon is decorative by default (aria-hidden); pass `title` to make one meaningful.
 */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 20, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------- Brand ---------- */
// The identity lives in components/brand/logo.tsx; these wrappers keep the original API.

/** App-icon tile. Pass `tone="ink"` for dark surfaces. */
export function LogoMark({ size = 28, tone = "brand", ...rest }: IconProps & { tone?: "brand" | "ink" }) {
  return <AppIcon size={size} tone={tone} {...rest} />;
}

/**
 * Horizontal lockup. `mono` inherits text colour; `reverse` (or a `text-white` class) is for dark surfaces.
 */
export function Logo({ className, mono, reverse, size }: { className?: string; mono?: boolean; reverse?: boolean; size?: number }) {
  const variant = mono ? "mono" : reverse || className?.includes("text-white") ? "reverse" : "color";
  return <Lockup variant={variant} size={size} className={className} />;
}

/* ---------- Consent states ---------- */

/** A script held back: pause bars inside a dashed ring. */
export const IconHeld = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />
    <path d="M10 9v6M14 9v6" />
  </Svg>
);

/** A script released by consent: play wedge escaping a solid ring. */
export const IconReleased = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 9.5A9 9 0 1 0 21 12" />
    <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" />
    <path d="M18 4.5l3 1-1 3" />
  </Svg>
);

export const IconDeclined = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 18L18 6" />
  </Svg>
);

/* ---------- Categories ---------- */

export const IconEssential = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" />
  </Svg>
);
export const IconPreferences = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconAnalytics = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M7.5 15l3.5-4 3 2.5 5-6.5" />
    <circle cx="19" cy="7" r="1" fill="currentColor" />
  </Svg>
);
export const IconMarketing = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);

/* ---------- Product concepts ---------- */

/** Consent receipt: torn-edge slip with a hash line. */
export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
    <path d="M9 8h6M9 11.5h6" />
    <path d="M9 15h2.5" strokeDasharray="1 1.6" />
  </Svg>
);

/** Hash chain: two interlocking links, each receipt holding the next. */
export const IconChain = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.2 13.8a3.8 3.8 0 0 1 0-5.4l2.6-2.6a3.8 3.8 0 0 1 5.4 5.4l-1.4 1.4" />
    <path d="M13.8 10.2a3.8 3.8 0 0 1 0 5.4l-2.6 2.6a3.8 3.8 0 0 1-5.4-5.4l1.4-1.4" />
  </Svg>
);

/** Region routing: globe with a pin sitting on a meridian. */
export const IconRegion = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.6 10.5A9 9 0 1 0 12 21" />
    <path d="M3.5 9h17M3.5 15H11M12 3c-2.4 2.6-3.5 5.6-3.5 9s1.1 6.4 3.5 9M12 3c1.6 1.7 2.7 3.7 3.2 6" />
    <path d="M18 22s-4-3.2-4-6a4 4 0 0 1 8 0c0 2.8-4 6-4 6z" />
    <circle cx="18" cy="16" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

/** Lightweight: a feather resting on a scale line. */
export const IconFeather = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 4c-6 0-11 4.5-11 11v3" />
    <path d="M19 4c0 6-3.5 10.5-9.5 11.5" />
    <path d="M12.5 11.5L8 16" />
    <path d="M3 20.5h18" />
  </Svg>
);

/** Edge delivery: lightning through a network node. */
export const IconEdge = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M13 6.5L9.5 12.5h5L11 17.5" />
  </Svg>
);

/** Scanner: radar sweep finding a tracker blip. */
export const IconScan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 9 9" />
    <path d="M12 7a5 5 0 1 0 5 5" />
    <path d="M12 12l7-7" />
    <circle cx="16.5" cy="15" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

/** Plain language: speech bubble with straight lines (no squiggles). */
export const IconPlainText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9h8M8 12.5h5" />
  </Svg>
);

/** Fair choice: balanced scale, equal pans. */
export const IconBalance = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v16M7 20h10M5 7h14" />
    <path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    <path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
  </Svg>
);

/** DPO: person with an ID badge. */
export const IconDpo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 10.5-5.1" />
    <rect x="15" y="14" width="6" height="7" rx="1.2" />
    <path d="M17 17h2" />
  </Svg>
);

export const IconRevoke = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6" />
    <path d="M4 4v3.5h3.5" />
    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
  </Svg>
);

export const IconFingerprint = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6.5A7.8 7.8 0 0 1 19.8 12" />
    <path d="M4.2 10a7.8 7.8 0 0 0 .3 5" />
    <path d="M8 18c1-1.6 1.5-3.6 1.5-6a2.5 2.5 0 0 1 5 0c0 1.2-.1 2.3-.3 3.4" />
    <path d="M12 12c0 3.5-.8 6.3-2.5 8.5M16.8 17.5c-.4 1-.9 2-1.5 2.9M19.5 15.5c-.1.6-.2 1.1-.4 1.6" />
  </Svg>
);

export const IconShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2.5" />
  </Svg>
);

export const IconServer = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="7" rx="1.5" />
    <rect x="3.5" y="13" width="17" height="7" rx="1.5" />
    <path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" />
  </Svg>
);

export const IconCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />
  </Svg>
);

export const IconPlug = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3v4M15 3v4" />
    <path d="M6.5 7h11v3a5.5 5.5 0 0 1-11 0z" />
    <path d="M12 15.5V21" />
  </Svg>
);

export const IconMobileApp = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </Svg>
);

export const IconDesktop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="19" height="12.5" rx="1.8" />
    <path d="M8 20.5h8M12 16.5v4" />
  </Svg>
);

export const IconTablet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="2.5" width="16" height="19" rx="2.2" />
    <path d="M11 18.5h2" />
  </Svg>
);

/* ---------- Banner layouts (used in the builder) ---------- */

export const IconLayoutBar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="3" y="15" width="18" height="5" rx="1" fill="currentColor" fillOpacity=".25" />
  </Svg>
);
export const IconLayoutModal = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="7" y="8" width="10" height="8" rx="1.5" fill="currentColor" fillOpacity=".25" />
  </Svg>
);
export const IconLayoutToast = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="5" y="13" width="7" height="5" rx="1" fill="currentColor" fillOpacity=".25" />
  </Svg>
);

/* ---------- App navigation ---------- */

export const IconOverview = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
  </Svg>
);
export const IconBrush = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 4.5l5 5-8 8-5-5z" />
    <path d="M6.5 12.5c-2 0-3 1.5-3 3.5 0 1.5-.5 2.5-1 3 3 .5 6.5-.5 6.5-4" />
  </Svg>
);
export const IconLogs = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.5" />
  </Svg>
);
export const IconInstall = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
  </Svg>
);
export const IconTeam = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5a6 6 0 0 1 12 0" />
    <path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14a6 6 0 0 1 3.5 5.5" />
  </Svg>
);
export const IconBilling = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9.5h19M6 15h4" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
export const IconSites = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 8.5h18" />
    <path d="M6 6.25h.01M8.5 6.25h.01" strokeWidth="2.2" />
  </Svg>
);

/* ---------- Utility ---------- */

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" />
  </Svg>
);
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M5.5 7l1 12.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9 7V4.5h6V7" />
  </Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Svg>
);
export const IconSignOut = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4.5M12 17h.01" />
  </Svg>
);
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </Svg>
);

export const CATEGORY_ICONS = {
  essential: IconEssential,
  functional: IconPreferences,
  analytics: IconAnalytics,
  marketing: IconMarketing,
} as const;
