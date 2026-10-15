import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "@/components/icons";
import { PICTURES } from "../picture-credits";

type Size = "wide" | "big" | "tall" | "small";

/**
 * Grid spans per tile size: desktop 12 columns, phone 2. Rows have a minimum height and grow with their
 * content, so a tile's text never has to fit into a fixed box.
 */
const SPAN: Record<Size, string> = {
  wide: "col-span-2 row-span-2 md:col-span-6 md:row-span-2",
  big: "col-span-2 row-span-3 md:col-span-6 md:row-span-4",
  tall: "col-span-1 row-span-3 md:col-span-3 md:row-span-4",
  small: "col-span-1 row-span-2 md:col-span-3 md:row-span-2",
};

/**
 * One tile, one destination. The picture sits in its own area above the text and is clipped to it, so the
 * two can never overlap; previews are sized in container units (cqw) and always fit inside the tile.
 * The title is the link and its ::after covers the tile, so the whole tile is the target while the
 * accessible name stays the title. The ring shows on the tile for keyboard focus.
 */
function Tile({ size, tone, title, line, href, children }: { size: Size; tone: string; title: string; line: string; href: string; children: ReactNode }) {
  return (
    <li
      className={`@container group relative flex flex-col overflow-hidden rounded-[18px] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-soot ${SPAN[size]} ${tone}`}
    >
      <div aria-hidden className="relative min-h-16 flex-1 overflow-hidden">
        {children}
      </div>
      <div className="px-5 pb-5 pt-3">
        <h3 className="text-[1.125rem] font-semibold leading-tight tracking-[-0.02em]">
          <Link href={href} className="inline-flex items-center gap-1.5 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {title}
            <IconArrowRight size={16} className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </h3>
        <p className="mt-1 max-w-[36ch] text-[1rem] leading-snug opacity-80">{line}</p>
      </div>
    </li>
  );
}

/** A product fragment placed in a tile's picture area with the tile's own margin. */
function Fragment({ align = "start", children }: { align?: "start" | "end"; children: ReactNode }) {
  return <div className={`flex p-5 ${align === "end" ? "justify-end" : "justify-start"}`}>{children}</div>;
}

/** What's inside: close-ups of the product on a board of filled tiles, pictures inside the ring. */
export function Board() {
  return (
    <section id="inside" aria-labelledby="board-title" className="on-light scroll-mt-16 bg-white px-2.5 py-12 md:py-16">
      <ul className="mx-auto grid max-w-[1440px] grid-cols-2 gap-1.5 [grid-auto-rows:minmax(28vw,auto)] md:grid-cols-12 md:gap-2 md:[grid-auto-rows:minmax(104px,auto)]">
        <li className="col-span-2 row-span-2 flex rounded-[18px] bg-chalk p-6 md:col-span-6 md:row-span-2">
          <h2 id="board-title" className="max-w-[12ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
            What’s inside the script.
          </h2>
        </li>

        <Tile size="wide" tone="bg-soot text-white" href="/docs#consent-mode" title="Google Consent Mode v2" line="Signals update the moment a visitor chooses.">
          <Fragment align="end">
            <dl className="space-y-1 rounded-[12px] bg-soot-3 px-4 py-3 text-[clamp(0.8125rem,2.6cqw,1.25rem)]">
              {[
                ["analytics_storage", "granted"],
                ["ad_storage", "denied"],
                ["ad_user_data", "denied"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-8">
                  <dt className="text-mute">{k}</dt>
                  <dd className={`font-medium ${v === "granted" ? "text-lime" : "text-white"}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </Fragment>
        </Tile>

        <Tile size="big" tone="bg-soot-2 text-white" href="/docs#scanner" title="A full cookie scan" line="The cookie scanner visits your website as a first-time visitor and lists every cookie, stored value and tracking pixel, including the hidden ones.">
          <Fragment>
            <div className="w-full max-w-[30rem] rounded-[14px] bg-white p-[clamp(1rem,3cqw,1.5rem)] text-[clamp(0.8125rem,2.2cqw,1rem)] text-soot">
              <p className="text-[2em] font-semibold leading-none tracking-[-0.03em]">sessionid</p>
              <p className="mt-2 text-mute-ink">shop.example.com · set by the server</p>
              <p className="mt-3 flex flex-wrap gap-1.5 text-[0.9em] font-medium">
                <span className="rounded-full bg-lime px-3 py-1">HttpOnly</span>
                <span className="rounded-full bg-chalk px-3 py-1">Secure</span>
                <span className="rounded-full bg-chalk px-3 py-1">SameSite Lax</span>
                <span className="rounded-full bg-chalk px-3 py-1">Essential</span>
              </p>
            </div>
          </Fragment>
        </Tile>

        <Tile size="tall" tone="bg-chalk text-soot" href="/compliance/dpdpa#languages" title="22 languages" line="Notices in every language your visitors read, Assamese to Urdu.">
          <div className="mk-ring-mask absolute -left-[15%] top-0 aspect-square w-[110%]">
            <Image src={PICTURES.palmLeaf.src} alt={PICTURES.palmLeaf.alt} fill sizes="(min-width: 768px) 30vw, 60vw" className="object-cover object-[30%_50%]" />
          </div>
        </Tile>

        <Tile size="tall" tone="bg-soot text-white" href="/security" title="Data stays local" line="Receipts stay in a single data region. IP addresses are truncated and hashed first.">
          <div className="mk-ring-mask absolute -right-[15%] top-0 aspect-square w-[110%]">
            <Image src={PICTURES.bombayMap.src} alt={PICTURES.bombayMap.alt} fill sizes="(min-width: 768px) 30vw, 60vw" className="object-cover object-[55%_62%]" />
          </div>
        </Tile>

        <Tile size="small" tone="bg-chalk text-soot" href="/compliance/ccpa" title="Global Privacy Control" line="Honoured as an opt-out, as CCPA requires.">
          <Fragment align="end">
            <span className="flex items-center gap-3 rounded-full bg-white py-1.5 pl-4 pr-1.5 text-[clamp(0.8125rem,5cqw,1.0625rem)] font-medium">
              GPC signal
              <span className="relative h-7 w-12 rounded-full bg-soot">
                <span className="absolute right-1 top-1 size-5 rounded-full bg-lime" />
              </span>
            </span>
          </Fragment>
        </Tile>

        <Tile size="small" tone="bg-soot-2 text-white" href="/docs#blocking" title="Leak alerts" line="See any tracker that fires after a visitor declines.">
          <Fragment>
            <div className="w-full rounded-[12px] bg-white px-4 py-3 text-[clamp(0.8125rem,4.6cqw,1rem)] text-soot">
              <p className="break-all font-semibold leading-tight">connect.facebook.net</p>
              <p className="mt-1 leading-snug text-mute-ink">Fired after Marketing was declined</p>
            </div>
          </Fragment>
        </Tile>

        <Tile size="wide" tone="bg-soot text-white" href="/docs#banner" title="No design clashes" line="The consent banner keeps its own styles, so it never changes your design or moves your layout.">
          <Fragment align="end">
            <div className="w-full max-w-[26rem] rounded-[14px] bg-white px-5 py-4 text-[clamp(0.8125rem,2.6cqw,1rem)] text-soot">
              <p className="font-medium">We use cookies for analytics.</p>
              <p className="mt-3 flex flex-wrap gap-2 font-medium">
                {/* Reject and Accept always carry equal weight */}
                <span className="rounded-full bg-lime px-4 py-1.5">Reject</span>
                <span className="rounded-full bg-lime px-4 py-1.5">Accept</span>
                <span className="rounded-full bg-chalk px-4 py-1.5">Choose</span>
              </p>
            </div>
          </Fragment>
        </Tile>
      </ul>
    </section>
  );
}
