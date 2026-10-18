import Link from "next/link";
import { FeatureClose, FeatureFaq, FeatureHeading, HeroActions, Rings, Stage } from "@/components/marketing/feature-page";
import type { FaqItem } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { ArrowLink, Section } from "@/components/marketing/primitives";
import { pageMetadata } from "@/lib/seo";

const PATH = "/cookie-scanner";

export const metadata = pageMetadata({
  title: "Cookie Scanner: Find Every Cookie and Tracker",
  description: "Scan your website the way a first-time visitor sees it: every cookie, storage key, script and tracking pixel, with anything set before consent flagged.",
  path: PATH,
  socialTitle: "See every cookie and tracker on your site",
  kicker: "Cookie scanner",
});

const FAQ: FaqItem[] = [
  {
    q: "What does the cookie scanner find?",
    a: "Cookies, including HttpOnly cookies that JavaScript can't see, localStorage and sessionStorage keys, third-party scripts and requests, embedded iframes and tracking pixels. Each finding is matched against our library of known trackers and sorted into a category.",
  },
  {
    q: "Does the scanner read stored values or personal data?",
    a: "No. For localStorage and sessionStorage it records the key and the length of the value, never the value itself. The scan visits as a first-time visitor who has not signed in and has not consented, so it only sees what any new visitor would.",
  },
  {
    q: "How often should I scan?",
    a: "Whenever you add a tool, a tag or a plugin, and on a schedule in between. Automatic scans run weekly or monthly, so a tracker someone adds next quarter still reaches your catalog without anyone remembering to look.",
  },
  {
    q: "What happens to what the scan finds?",
    a: "Findings go to your cookie catalog. Review them, name any the library doesn't recognise, and add what should be held: the banner then blocks it until the visitor agrees to its category.",
  },
  {
    q: "Will a scan affect my live site?",
    a: "A scan reads pages much like a single visitor would. It follows same-site links only, respects robots.txt, reads a capped number of pages and can be stopped at any time. It also refuses private, loopback and internal addresses, so it can't be pointed at systems behind your firewall.",
  },
];

const KINDS: { kind: string; detail: string }[] = [
  { kind: "Cookies", detail: "Every cookie, including HttpOnly cookies JavaScript can't see, with the domain that set it and its Secure and SameSite attributes." },
  { kind: "Storage", detail: "localStorage and sessionStorage keys, by name. Values are never read, only their length." },
  { kind: "Scripts and requests", detail: "Third-party scripts and the requests they make, matched against a library of known trackers." },
  { kind: "Embeds and pixels", detail: "Iframes and tracking pixels found in the rendered page, so ones added by a tag still show." },
];

/** The latest scan, summarised as the dashboard shows it. Sample values. */
function ScanFragment() {
  const kinds: [string, number][] = [
    ["Scripts", 14],
    ["Cookies and storage", 17],
    ["Embeds", 3],
    ["Pixels", 4],
  ];
  return (
    <Stage tone="dark" label="An example scan of a small shop.">
      <div className="rounded-[14px] bg-white p-5 text-soot">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[0.9375rem] font-semibold">Latest scan · shop.example.com</p>
          <p className="inline-flex items-center gap-1.5 text-[0.875rem] text-mute-ink">
            <span aria-hidden className="size-2 rounded-full bg-jade-bright" />
            Finished
          </p>
        </div>
        <p className="mt-3 text-[2.5rem] font-semibold leading-none tracking-[-0.04em]">
          38 <span className="text-[1rem] font-normal tracking-normal text-mute-ink">found</span>
        </p>
        <div aria-hidden className="mt-3 h-1.5 rounded-full bg-lime" />
        <p className="mt-1.5 text-[0.8125rem] text-mute-ink">12 of 12 pages</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[0.875rem]">
          {kinds.map(([k, n]) => (
            <div key={k} className="rounded-[10px] bg-chalk px-3 py-2">
              <dt className="text-mute-ink">{k}</dt>
              <dd className="font-semibold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-2 flex items-start gap-2 rounded-[12px] bg-soot-3 px-4 py-3 text-[0.9375rem] text-white">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-bright" />5 trackers were set before consent
      </p>
    </Stage>
  );
}

/** One cookie as the scan reports it. */
function CookieFragment() {
  return (
    <Stage label="A first-party cookie the page's own scripts can't read.">
      <div className="rounded-[14px] bg-white p-5 text-soot">
        <p className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em]">sessionid</p>
        <p className="mt-2 text-[0.9375rem] text-mute-ink">shop.example.com · set by the server</p>
        <p className="mt-3 flex flex-wrap gap-1.5 text-[0.875rem] font-medium">
          <span className="rounded-full bg-lime px-3 py-1">HttpOnly</span>
          <span className="rounded-full bg-chalk px-3 py-1">Secure</span>
          <span className="rounded-full bg-chalk px-3 py-1">SameSite Lax</span>
          <span className="rounded-full bg-chalk px-3 py-1">Essential</span>
        </p>
      </div>
      <div className="mt-2 rounded-[14px] bg-white p-5 text-soot">
        <p className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em]">_ga</p>
        <p className="mt-2 text-[0.9375rem] text-mute-ink">.example.com · Google Analytics</p>
        <p className="mt-3 flex flex-wrap gap-1.5 text-[0.875rem] font-medium">
          <span className="rounded-full bg-chalk px-3 py-1">Analytics</span>
          <span className="rounded-full bg-soot px-3 py-1 text-white">Before consent</span>
        </p>
      </div>
    </Stage>
  );
}

/** The schedule and the last few runs. Sample values. */
function HistoryFragment() {
  const rows: [string, number, number, number][] = [
    ["12 Oct", 12, 38, 5],
    ["5 Oct", 12, 36, 5],
    ["28 Sep", 11, 31, 0],
  ];
  return (
    <Stage tone="dark" label="Weekly scans. A new tag shows up the week it's added.">
      <div className="rounded-[14px] bg-soot-3 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">Automatic scans</p>
          <p className="rounded-full bg-lime px-3 py-1 text-[0.875rem] font-medium text-soot">Weekly</p>
        </div>
        <table className="mt-4 w-full text-left text-[0.875rem]">
          <caption className="sr-only">Recent scans: date, pages scanned, findings and findings set before consent</caption>
          <thead className="text-mute">
            <tr>
              <th scope="col" className="pb-2 font-normal">
                Started
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Pages
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Found
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Before consent
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 tabular-nums">
            {rows.map(([d, p, f, pre]) => (
              <tr key={d}>
                <td className="py-2">{d}</td>
                <td className="py-2 text-right">{p}</td>
                <td className="py-2 text-right">{f}</td>
                <td className={`py-2 text-right ${pre ? "font-semibold text-lime" : "text-mute"}`}>{pre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stage>
  );
}

export default function CookieScannerPage() {
  return (
    <>
      <PageHero
        tone="ink"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Cookie scanner", href: PATH },
        ]}
        title="See every cookie and tracker on your site"
        lead="The cookie scanner visits your website as a first-time visitor who hasn't consented, and lists every cookie, stored value, script and tracking pixel it finds, including the ones set before anyone said yes."
        figure={<ScanFragment />}
      >
        <HeroActions docs="/docs#scanner" />
      </PageHero>

      <Section id="records" tone="white" labelledBy="records-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <FeatureHeading id="records-h" text="What one scan records" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              A cookie checker that reads one page in your own browser misses what your server sets and what loads later. The scanner starts at
              your homepage and follows your own links, recording four kinds of finding on every page it reads.
            </p>
            <dl className="mt-8 divide-y divide-line border-y border-line">
              {KINDS.map((k, i) => (
                <div key={k.kind} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-5 md:grid-cols-[minmax(0,200px)_1fr] md:gap-8">
                  <dt className="font-semibold">{k.kind}</dt>
                  <dd className="text-[1rem] leading-[1.55] text-ink-2">{k.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-5">
            <CookieFragment />
          </div>
        </div>
      </Section>

      <Section id="before-consent" tone="paper" labelledBy="before-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="before-h" text="Anything set before consent, flagged" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              The scan arrives without a choice, so whatever it finds ran before the visitor was asked. Under an opt-in law, that&apos;s the list
              to fix first.
            </p>
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                "Known trackers are named and sorted into functional, analytics or marketing.",
                "Anything the library doesn't recognise is left uncategorised for you to review, never guessed.",
                "Findings go to your cookie catalog. Add what should be held, and the banner blocks it until the visitor agrees.",
              ]}
            />
            <div className="mt-6">
              <ArrowLink href="/cookie-consent#blocking">How the banner blocks</ArrowLink>
            </div>
          </div>
          <div className="lg:col-span-6">
            <Stage label="The warning at the top of a scan, with the way to fix it.">
              <div className="rounded-[14px] bg-white p-5 text-soot">
                <p className="flex items-start gap-2 font-semibold">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-bright" />5 trackers were set before consent
                </p>
                <ul className="mt-4 divide-y divide-line text-[0.9375rem]">
                  {[
                    ["_ga", "Google Analytics", "Analytics"],
                    ["_fbp", "Meta Pixel", "Marketing"],
                    ["_clck", "Microsoft Clarity", "Analytics"],
                  ].map(([name, who, cat]) => (
                    <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                      <span>
                        <span className="font-medium">{name}</span> <span className="text-mute-ink">· {who}</span>
                      </span>
                      <span className="text-mute-ink">{cat}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4">
                  <span className="inline-flex min-h-10 items-center rounded-full bg-soot px-4 text-[0.9375rem] font-medium text-white">Review in catalog</span>
                </p>
              </div>
            </Stage>
          </div>
        </div>
      </Section>

      <Section id="schedule" tone="ink" labelledBy="schedule-h">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <FeatureHeading id="schedule-h" text="Scans that keep up with your site" />
            <p className="mt-4 max-w-[60ch] text-[1.125rem] leading-[1.55]">
              Sites change every week: a new plugin, a chat widget, a marketing tag. One scan at launch goes stale fast.
            </p>
            <Rings
              className="mt-6 max-w-[60ch]"
              items={[
                "Scan now from the dashboard, or set automatic scans to run weekly or monthly.",
                "Every run keeps its history: pages read, findings, findings set before consent, and the scan's own log.",
                "Between scans, the Leaks page watches real visits and shows any tracker that fires after a visitor declines.",
              ]}
            />
          </div>
          <div className="lg:col-span-6">
            <HistoryFragment />
          </div>
        </div>
      </Section>

      <Section id="safety" tone="white" labelledBy="safety-h">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <FeatureHeading id="safety-h" text="Safe to point at a live site" />
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-[1.6]">
              The scanner reads your site the way a careful visitor would, and it&apos;s built so it can&apos;t be turned on anything else.
            </p>
            <p className="mt-4 max-w-[44ch] text-[1rem] leading-[1.6] text-mute-ink">
              What it finds feeds the{" "}
              <Link href="/cookie-consent" className="mk-link font-medium text-soot">
                consent banner
              </Link>
              , the trackers it holds are recorded in the{" "}
              <Link href="/consent-log" className="mk-link font-medium text-soot">
                Evidence Pack
              </Link>
              , and Google tags it finds can be told the visitor&apos;s choice through{" "}
              <Link href="/google-consent-mode" className="mk-link font-medium text-soot">
                Google Consent Mode v2
              </Link>
              .
            </p>
          </div>
          <dl className="divide-y divide-line border-y border-line lg:col-span-7">
            {[
              ["Your pages only", "It follows same-site links from your homepage and respects robots.txt."],
              ["Gentle on servers", "Each scan reads a capped number of pages, and you can stop a running scan at any time."],
              ["No internal targets", "Private, loopback and link-local addresses are refused, including after a redirect."],
              ["No stored values", "Storage keys are recorded by name and length. The values never leave the page."],
            ].map(([k, v], i) => (
              <div key={k} data-reveal style={{ "--i": i } as React.CSSProperties} className="grid gap-1.5 py-5 md:grid-cols-[minmax(0,200px)_1fr] md:gap-8">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[1rem] leading-[1.55] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <FeatureFaq items={FAQ} />
      <FeatureClose current={PATH} />
    </>
  );
}
