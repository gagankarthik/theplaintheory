import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { AppIcon } from "@/components/brand/logo";
import { sdkSizeLabel } from "@/lib/sdk-size";
import { IconBrowserSignal, IconCalifornia, IconChakra, IconConsentMode, IconEuStars, IconUkCross } from "./coverage-icons";

interface Coverage {
  name: string;
  region: string;
  model: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** What one installation covers. Real standards only; no customer logos we don't have. */
const COVERAGE: Coverage[] = [
  { name: "GDPR", region: "EU and EEA", model: "Opt-in", href: "/compliance/gdpr", icon: IconEuStars },
  { name: "UK GDPR", region: "United Kingdom", model: "Opt-in", href: "/compliance/gdpr", icon: IconUkCross },
  { name: "CCPA/CPRA", region: "California", model: "Opt-out", href: "/compliance/ccpa", icon: IconCalifornia },
  { name: "DPDPA", region: "India", model: "Opt-in with DPO notice", href: "/compliance/dpdpa", icon: IconChakra },
  { name: "Consent Mode v2", region: "Google tags", model: "Signals sent", href: "/docs#consent-mode", icon: IconConsentMode },
  { name: "Global Privacy Control", region: "Browser signal", model: "Honoured", href: "/compliance/ccpa", icon: IconBrowserSignal },
];

/*
 * Desktop geometry, in px. Rows are a fixed height so the connector SVG matches the cards exactly
 * (no stretched strokes): three rows of ROW with GAP between, and a HUB_W-wide middle column.
 */
const ROW = 120;
const GAP = 16;
const HUB_W = 300;
const H = ROW * 3 + GAP * 2;
const CY = H / 2;
const rowY = (i: number) => ROW / 2 + i * (ROW + GAP);

/** A connector from the hub out to card `i` (0-2 left, 3-5 right). */
function connector(i: number) {
  const left = i < 3;
  const y = rowY(i % 3);
  const x0 = HUB_W / 2 + (left ? -44 : 44);
  const x1 = left ? 0 : HUB_W;
  const mid = (x0 + x1) / 2;
  return `M${x0} ${CY} C ${mid} ${CY}, ${mid} ${y}, ${x1} ${y}`;
}

function Card({ c, i }: { c: Coverage; i: number }) {
  const Icon = c.icon;
  return (
    <li data-cov={i} className="lg:h-[120px]">
      <Link
        href={c.href}
        className="group flex h-full items-center gap-4 rounded-[18px] bg-surface p-5 ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(11,16,32,0.35)] hover:ring-brand/30"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-paper text-ink ring-1 ring-inset ring-line transition-colors duration-200 group-hover:bg-brand-wash group-hover:text-brand group-hover:ring-brand/20">
          <Icon />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">{c.name}</span>
          <span className="mt-0.5 block text-[13px] text-ink-3">{c.region}</span>
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors group-hover:bg-brand-wash group-hover:text-brand-ink group-hover:ring-brand/20">
          {c.model}
        </span>
      </Link>
    </li>
  );
}

/** The hub: our mark inside soft rings, with the script it stands for. */
function Hub() {
  return (
    <div className="relative grid place-items-center">
      <span aria-hidden className="pt-ring absolute size-[120px] rounded-full ring-1 ring-brand/25" />
      <span aria-hidden className="pt-ring absolute size-[120px] rounded-full ring-1 ring-brand/25" style={{ animationDelay: "1.6s" }} />
      <span aria-hidden className="absolute size-[104px] rounded-full bg-brand-wash/70 ring-1 ring-brand/15" />
      <span className="relative rounded-[20px] shadow-[0_16px_32px_-14px_rgba(46,43,214,0.55)]">
        <AppIcon size={64} title="Plain Theory" />
      </span>
    </div>
  );
}

export function CoverageStrip() {
  const left = COVERAGE.slice(0, 3);
  const right = COVERAGE.slice(3);

  return (
    <section aria-labelledby="coverage-title" className="bg-surface py-20 md:py-28">
      <div className="container-page">
        <div className="max-w-[44rem]">
          <h2 id="coverage-title" className="display text-[2rem] sm:text-[2.5rem]">
            One installation covers every notice you need
          </h2>
          <p className="mt-4 text-lg text-ink-2">
            The same {sdkSizeLabel()} script decides which law applies to each visitor and sends the signals your tags expect.
          </p>
        </div>

        {/* Desktop: hub in the middle, connectors out to each standard */}
        <div className="pt-coverage relative mt-14 hidden lg:grid" style={{ gridTemplateColumns: `minmax(0,1fr) ${HUB_W}px minmax(0,1fr)` }}>
          <ul aria-label="Laws and signals covered" className="grid gap-4" style={{ gridTemplateRows: `repeat(3, ${ROW}px)` }}>
            {left.map((c, i) => (
              <Card key={c.name} c={c} i={i} />
            ))}
          </ul>

          <div className="relative" style={{ height: H }}>
            <svg aria-hidden width={HUB_W} height={H} viewBox={`0 0 ${HUB_W} ${H}`} className="absolute inset-0 overflow-visible">
              {COVERAGE.map((_, i) => (
                <g key={i}>
                  <path d={connector(i)} pathLength={100} className="pt-line-base" data-line={i} />
                  <path d={connector(i)} pathLength={100} className="pt-line-flow" style={{ animationDelay: `${i * 0.45}s` }} />
                  <circle cx={i < 3 ? 0 : HUB_W} cy={rowY(i % 3)} r={3.5} className="pt-line-node" data-line={i} />
                </g>
              ))}
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <Hub />
            </div>
          </div>

          <ul aria-label="Signals covered" className="grid gap-4" style={{ gridTemplateRows: `repeat(3, ${ROW}px)` }}>
            {right.map((c, i) => (
              <Card key={c.name} c={c} i={i + 3} />
            ))}
          </ul>
        </div>

        {/* Smaller screens: hub on top, the standards in a grid below */}
        <div className="mt-12 lg:hidden">
          <div className="flex justify-center py-6">
            <Hub />
          </div>
          <ul aria-label="Laws and signals covered" className="mt-8 grid gap-3 sm:grid-cols-2">
            {COVERAGE.map((c, i) => (
              <Card key={c.name} c={c} i={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
