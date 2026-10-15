import { pageMetadata } from "@/lib/seo";
import type { CSSProperties, ReactNode } from "react";
import { AppIcon, BRAND, BrandMark, Lockup, MARK, MARK_PATH, Wordmark } from "@/components/brand/logo";
import { ConstructionGrid } from "@/components/brand/construction-grid";
import * as Icons from "@/components/icons";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionIntro } from "@/components/marketing/primitives";

export const metadata = pageMetadata({
  title: "Brand and design system",
  description: "The Plain Theory identity: the I/O mark, its construction, lockups, clear space, colour roles with contrast ratios, type scale, icons and usage rules.",
  path: "/brand",
  socialTitle: "Brand and design system",
});

/* ---------- WCAG 2.x contrast ---------- */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}
const grade = (n: number) => (n >= 7 ? "AAA" : n >= 4.5 ? "AA" : n >= 3 ? "AA large" : "Fails");

const SOOT = "#0F0F0F";

const COLORS = [
  { name: "Soot", hex: SOOT, role: "Opens and closes every web page; text on light grounds; the mark on light grounds." },
  { name: "Lime", hex: "#DAFA9C", role: "The one action colour on the website, and the mark on dark grounds and in the app icon." },
  { name: "Chalk", hex: "#F2F2EF", role: "One step off white for tiles, cards and alternate sections. No lines between surfaces." },
  { name: "Ultramarine", hex: BRAND.ultramarine, role: "The dashboard accent only: focus, selection and the primary action. Never in the mark." },
  { name: "Jade", hex: "#08765A", role: "Released: a tracker allowed by consent. Success." },
  { name: "Amber", hex: "#9A5C06", role: "Held: a tracker waiting for a decision. Warnings." },
  { name: "Rose", hex: "#C2283B", role: "Declined, destructive actions and errors." },
];

const TYPE = [
  { token: "Display", px: 92, lh: 0.98, use: "Home headline, 6.4vw" },
  { token: "Head", px: 60, lh: 1, use: "Section and page headlines" },
  { token: "Lead", px: 29, lh: 1.05, use: "Tile titles, questions" },
  { token: "Body", px: 18, lh: 1.55, use: "Running text" },
  { token: "Small", px: 16, lh: 1.5, use: "Notes, captions, links" },
];

const MISUSE: { label: string; style?: CSSProperties; fill?: string }[] = [
  { label: "Stretch or squash it", style: { transform: "scaleX(1.4)" } },
  { label: "Recolour it outside the palette", fill: "var(--color-amber-bright)" },
  { label: "Rotate it", style: { transform: "rotate(-16deg)" } },
  { label: "Add shadows or effects", style: { filter: "drop-shadow(3px 5px 0 var(--color-brand-on-ink))" } },
];

const DOWNLOADS = [
  { href: "/brand/app-icon.svg", label: "App icon", detail: "Lime mark on soot" },
  { href: "/brand/app-icon-ink.svg", label: "App icon, inverse", detail: "Soot mark on lime" },
  { href: "/brand/mark-color.svg", label: "Mark, lime", detail: "For dark backgrounds" },
  { href: "/brand/mark-ink.svg", label: "Mark, soot", detail: "For light backgrounds" },
  { href: "/brand/mark-white.svg", label: "Mark, white", detail: "For dark backgrounds" },
];

const ICON_NAMES = Object.keys(Icons).filter((k) => k.startsWith("Icon")) as (keyof typeof Icons)[];

function Figure({ children, tone = "white", label }: { children: ReactNode; tone?: "white" | "paper" | "ink" | "brand"; label: string }) {
  const bg = { white: "bg-surface", paper: "bg-paper", ink: "bg-ink text-white", brand: "bg-brand text-white" }[tone];
  return (
    <figure className={`grid min-h-56 place-items-center p-10 ${bg}`}>
      {children}
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export default function BrandPage() {
  return (
    <>
      <PageHero
        tone="paper"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Brand", href: "/brand" },
        ]}
        title="I for on, O for off. Together, a P."
        lead="Our mark is built from the two halves of the power symbol. Consent is an on-or-off decision, so the letter says what we do before anyone reads the name."
        figure={
          <figure className="overflow-hidden rounded-[var(--radius-lg)] bg-surface ring-1 ring-line">
            <div className="flex items-end gap-1 bg-line px-3 pt-2.5">
              <div className="flex items-center gap-2 rounded-t-[8px] bg-surface px-3.5 py-2 text-xs font-medium">
                <AppIcon size={16} /> Plain Theory
              </div>
              <div className="hidden px-3.5 py-2 text-xs text-ink-2 sm:block">Consent log</div>
            </div>
            <div className="border-t border-line px-4 py-3">
              <span className="block h-7 truncate rounded-full bg-paper px-4 text-xs leading-7 text-ink-3">theplaintheory.in/app</span>
            </div>
            <div className="flex items-end justify-center gap-8 bg-ink px-6 pb-6 pt-10">
              <div className="flex flex-col items-center gap-2">
                <AppIcon size={72} />
                <span className="text-xs text-white/70">Plain Theory</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <AppIcon size={72} tone="ink" className="rounded-[16px] ring-1 ring-white/20" />
                <span className="text-xs text-white/70">Inverse</span>
              </div>
            </div>
            <figcaption className="sr-only">The icon in a browser tab and on a phone home screen</figcaption>
          </figure>
        }
      />

      <Section id="construction" labelledBy="construction-h">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionIntro
              id="construction-h"
              align="left"
              title="Construction"
              lead="Two shapes on a 24-unit grid. The ring is drawn slightly lighter than the stem because circles read heavier than bars at the same weight."
            />
            <dl className="mt-10 divide-y divide-line border-y border-line">
              {[
                ["Stem (I)", `${MARK.stem.w}u wide, ${MARK.stem.h}u tall, fully rounded ends`],
                ["Ring (O)", `Outer radius ${MARK.ring.outer}u, counter ${MARK.ring.inner}u`],
                ["Ring weight", `${(MARK.ring.outer - MARK.ring.inner).toFixed(1)}u, optically equal to the stem`],
                ["Gap", "1u between I and O"],
                ["Alignment", "Ring top sits on the stem's top line"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 py-3.5">
                  <dt className="text-sm font-medium">{k}</dt>
                  <dd className="text-right text-sm text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-7">
            <ConstructionGrid />
          </div>
        </div>
      </Section>

      <Section id="lockups" tone="paper" labelledBy="lockups-h">
        <SectionIntro
          id="lockups-h"
          title="Lockups"
          lead="Use the horizontal lockup by default, the stacked one for square spaces, and the app icon wherever a container is expected."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line md:grid-cols-2">
          <Figure label="Horizontal lockup on white">
            <Lockup size={28} />
          </Figure>
          <Figure tone="ink" label="Reversed lockup on soot">
            <Lockup size={28} variant="reverse" />
          </Figure>
          <Figure tone="brand" label="Stacked lockup on soot">
            <Lockup size={22} layout="stacked" variant="reverse" />
          </Figure>
          <Figure label="App icons and the single-colour mark">
            <div className="flex items-center gap-5 sm:gap-8">
              <AppIcon size={80} className="max-sm:size-16" title="App icon" />
              <AppIcon size={80} className="max-sm:size-16" tone="ink" title="App icon, inverse" />
              <span className="text-ink">
                <BrandMark size={80} className="max-sm:size-16" variant="mono" title="Single-colour mark" />
              </span>
            </div>
          </Figure>
        </div>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DOWNLOADS.map((d) => (
            <li key={d.href}>
              <a
                href={d.href}
                download
                className="group flex h-full items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface px-4 py-3 ring-1 ring-line transition-shadow hover:ring-ink"
              >
                <span>
                  <span className="block text-sm font-medium">{d.label}</span>
                  <span className="block text-xs text-ink-3">{d.detail}, SVG</span>
                </span>
                <Icons.IconDownload size={18} className="shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="clear-space" labelledBy="clear-h">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionIntro
              id="clear-h"
              align="left"
              title="Clear space and size"
              lead="Leave a margin equal to the ring's diameter on every side. Below 16 pixels, use the app icon instead of the bare mark."
            />
            <div className="mt-10 flex flex-wrap items-end gap-8">
              {[64, 32, 24, 16].map((s) => (
                <div key={s} className="flex flex-col items-start gap-3">
                  <BrandMark size={s} title={`Mark at ${s} pixels`} />
                  <span className="text-xs tabular-nums text-ink-3">{s}px</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid place-items-center rounded-[var(--radius-lg)] bg-paper px-4 py-10 sm:p-10 md:p-16 lg:col-span-7">
            <div className="relative p-7 outline-1 outline-dashed outline-brand/50 sm:p-9">
              <Lockup size={26} />
              {["left-0 top-1/2 -translate-y-1/2", "right-0 top-1/2 -translate-y-1/2", "top-0 left-1/2 -translate-x-1/2", "bottom-0 left-1/2 -translate-x-1/2"].map((c) => (
                <span key={c} aria-hidden className={`absolute size-6 rounded-full bg-brand-wash ring-1 ring-brand/40 sm:size-8 ${c}`} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="colour" tone="paper" labelledBy="colour-h">
        <SectionIntro
          id="colour-h"
          title="Colour"
          lead="Each colour has one job. On the website, lime asks you to act; in the dashboard, ultramarine does. Jade, amber and rose mean consent states and are never decoration. Ratios below are calculated live."
        />

        {/* Proportion: 60-30-10 across any page or screen */}
        <div className="mt-14 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-8">
          <h3 className="text-base font-semibold">Proportion on the website: 40, 50, 10</h3>
          <p className="mt-1.5 max-w-[70ch] text-sm text-ink-2">
            Soot opens and closes every page, white and chalk carry the middle, and lime marks the action. Lime may fill one whole section; anywhere else it is one button.
          </p>
          <div aria-hidden className="mt-6 flex h-16 overflow-hidden rounded-[12px] ring-1 ring-inset ring-line">
            <span className="flex basis-[40%] items-end bg-soot p-3 text-xs font-semibold text-white">40%</span>
            <span className="flex basis-[50%] items-end bg-chalk p-3 text-xs font-semibold text-soot">50%</span>
            <span className="flex basis-[10%] items-end bg-lime p-3 text-xs font-semibold text-soot">10%</span>
          </div>
          <ul className="mt-6 grid gap-5 text-sm md:grid-cols-3">
            {[
              { share: "40%", name: "Soot", body: "The opening and closing of every page: the bar, the first screen, the close and the footer." },
              { share: "50%", name: "White and chalk", body: "The middle of the page, with chalk one step off white for tiles and cards." },
              { share: "10%", name: "Lime", body: "Buttons, the ring of the mark at large scale, and at most one full section." },
            ].map((r) => (
              <li key={r.name}>
                <p className="font-semibold">
                  {r.share} <span className="font-normal text-ink-3">·</span> {r.name}
                </p>
                <p className="mt-1 text-ink-2">{r.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-sm text-ink-3">
            Outside the split: jade, amber and rose only ever mean released, held and declined consent (rose also marks form errors).
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Brand colours with their role and WCAG contrast against white and soot</caption>
            <thead className="hidden bg-paper text-xs text-ink-3 md:table-header-group">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Colour</th>
                <th scope="col" className="px-6 py-3 font-medium">Role</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">On white</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">On soot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COLORS.map((c) => {
                const w = contrast(c.hex, BRAND.white);
                const k = contrast(c.hex, SOOT);
                return (
                  <tr key={c.name} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 md:table-row md:p-0">
                    <th scope="row" className="w-full font-normal md:w-[30%] md:px-6 md:py-4">
                      <span className="flex items-center gap-4">
                        <span aria-hidden className="size-11 shrink-0 rounded-[10px] ring-1 ring-inset ring-black/10" style={{ background: c.hex }} />
                        <span>
                          <span className="block font-medium">{c.name}</span>
                          <span className="block font-mono text-xs text-ink-3">{c.hex}</span>
                        </span>
                      </span>
                    </th>
                    <td className="w-full text-sm text-ink-2 md:w-auto md:px-6 md:py-4">{c.role}</td>
                    <td className="text-sm tabular-nums md:px-6 md:py-4 md:text-right">
                      <span className="text-ink-3 md:hidden">On white </span>
                      {w.toFixed(2)} : 1 <span className="text-ink-3">{grade(w)}</span>
                    </td>
                    <td className="text-sm tabular-nums md:px-6 md:py-4 md:text-right">
                      <span className="text-ink-3 md:hidden">On soot </span>
                      {k.toFixed(2)} : 1 <span className="text-ink-3">{grade(k)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="type" labelledBy="type-h">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionIntro
              id="type-h"
              align="left"
              title="Typography"
              lead="Switzer for the website and sign-in, five sizes and no more. The dashboard uses Instrument Sans, with JetBrains Mono for code, keys and receipt hashes. Headlines are semibold and tightly tracked."
            />
            <div className="mt-10 space-y-8">
              <div>
                <Wordmark size={34} />
                <p className="mt-3 text-sm text-ink-2">Wordmark: Switzer Semibold, tracked −3.5%.</p>
              </div>
              <div>
                <p className="break-all font-mono text-base">9f2c41e0…e41a</p>
                <p className="mt-2 text-sm text-ink-2">JetBrains Mono, in the dashboard only, never for labels or headings.</p>
              </div>
            </div>
          </div>
          <ol className="divide-y divide-line border-y border-line lg:col-span-8">
            {TYPE.map((t) => (
              <li key={t.token} className="grid items-baseline gap-2 py-5 md:grid-cols-[110px_1fr_160px] md:gap-6">
                <span className="flex gap-3 text-xs text-ink-3">
                  <span className="w-9 font-medium text-ink">{t.token}</span>
                  <span className="tabular-nums">
                    {t.px}/{Math.round(t.px * t.lh)}
                  </span>
                </span>
                <span
                  className="truncate font-semibold"
                  style={{
                    fontSize: `clamp(${Math.min(t.px, 26)}px, ${t.px / 13}vw, ${t.px}px)`,
                    lineHeight: t.lh,
                    letterSpacing: t.px >= 36 ? "-0.04em" : t.px >= 20 ? "-0.025em" : 0,
                    fontWeight: t.px >= 20 ? 600 : 400,
                  }}
                >
                  Consent people understand
                </span>
                <span className="text-sm text-ink-3 md:text-right">{t.use}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="icons" tone="paper" labelledBy="icons-h">
        <SectionIntro
          id="icons-h"
          title="Iconography"
          lead="Drawn for this product on a 24-pixel grid with a 1.75-pixel stroke and round joins: held and released states, receipts, chains and regions."
        />
        <ul className="mt-14 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {ICON_NAMES.map((name) => {
            const Icon = Icons[name] as (p: Icons.IconProps) => React.JSX.Element;
            return (
              <li key={name} className="group flex aspect-square flex-col items-center justify-center gap-3 bg-surface p-3 transition-colors hover:bg-brand-wash">
                <Icon size={24} className="text-ink transition-colors group-hover:text-brand" />
                <span className="text-center text-xs leading-tight text-ink-3">{name.replace(/^Icon/, "")}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="misuse" labelledBy="misuse-h">
        <SectionIntro id="misuse-h" title="Please don't" lead="The mark only works when its geometry and colour stay exact." />
        <ul className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {MISUSE.map((m) => (
            <li key={m.label}>
              <div className="relative grid h-44 place-items-center rounded-[var(--radius-lg)] bg-paper">
                <svg width="76" height="76" viewBox="0 0 24 24" style={m.style} aria-hidden>
                  <path d={MARK_PATH} fill={m.fill ?? BRAND.soot} fillRule="evenodd" />
                </svg>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-wash px-2 py-0.5 text-xs font-medium text-rose">
                  <Icons.IconClose size={12} /> Don&apos;t
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">{m.label}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
