import { Noto_Sans_Meetei_Mayek, Noto_Sans_Ol_Chiki } from "next/font/google";
import { ArrowLink, Bezel } from "../primitives";
import { DpdpTimeline } from "./dpdp-timeline";

/** When this static page was rendered; the timeline switches to the visitor's clock on load. */
const BUILD_TIME = Date.now();

// Meitei Mayek and Ol Chiki have no system font on most Apple devices; load just these two scripts here.
const meetei = Noto_Sans_Meetei_Mayek({ subsets: ["meetei-mayek"], weight: "400", display: "swap" });
const olChiki = Noto_Sans_Ol_Chiki({ subsets: ["ol-chiki"], weight: "400", display: "swap" });
const SCRIPT_FONT: Record<string, string> = { mni: meetei.className, sat: olChiki.className };

/** The 22 languages of the Eighth Schedule, as their speakers write their names. */
const LANGUAGES: { code: string; native: string; english: string; rtl?: boolean }[] = [
  { code: "as", native: "অসমীয়া", english: "Assamese" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "brx", native: "बड़ो", english: "Bodo" },
  { code: "doi", native: "डोगरी", english: "Dogri" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ks", native: "كٲشُر", english: "Kashmiri", rtl: true },
  { code: "kok", native: "कोंकणी", english: "Konkani" },
  { code: "mai", native: "मैथिली", english: "Maithili" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "mni", native: "ꯃꯤꯇꯩꯂꯣꯟ", english: "Manipuri" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "ne", native: "नेपाली", english: "Nepali" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "sa", native: "संस्कृतम्", english: "Sanskrit" },
  { code: "sat", native: "ᱥᱟᱱᱛᱟᱲᱤ", english: "Santali" },
  { code: "sd", native: "سنڌي", english: "Sindhi", rtl: true },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "ur", native: "اردو", english: "Urdu", rtl: true },
];

/** What Rule 3 asks a notice to itemise, shown as the product renders it. */
function ItemisedNotice() {
  return (
    <figure className="overflow-hidden rounded-[14px] bg-white shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="text-sm font-semibold">Customise Consent Preferences</p>
        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">DPDPA notice</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-medium">Analytics</p>
          <span aria-hidden className="relative h-5 w-9 rounded-full bg-line-strong">
            <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm" />
          </span>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-2">Counts visits and shows which pages are useful. Reported in aggregate, never sold.</p>
        <dl className="mt-4 grid gap-3 rounded-[10px] bg-paper p-3.5 text-[13px] sm:grid-cols-[110px_1fr]">
          <dt className="text-ink-3">Data collected</dt>
          <dd className="text-ink">Pages visited, device and browser type, approximate city</dd>
          <dt className="text-ink-3">Kept for</dt>
          <dd className="text-ink">13 months</dd>
          <dt className="text-ink-3">Withdraw</dt>
          <dd className="text-ink">Any time, from Privacy choices on every page</dd>
        </dl>
      </div>
      <div className="border-t border-line px-5 py-3.5 text-[13px] text-ink-2">
        <span className="font-medium text-ink">Your rights.</span> Access, correction and erasure, a grievance contact answered within 90 days, and a
        link to complain to the Data Protection Board.
      </div>
      <figcaption className="sr-only">An itemised DPDPA notice for the Analytics purpose</figcaption>
    </figure>
  );
}

export function DpdpSection() {
  return (
    <section id="dpdp" aria-labelledby="dpdp-title" className="bg-paper py-24 md:py-32">
      <div className="container-page">
        <div>
          <div className="max-w-[44rem]">
            <h2 id="dpdp-title" className="display text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]">
              Built for India&apos;s DPDP Act, not adapted to it
            </h2>
            <p className="mt-5 max-w-[56ch] text-lg text-ink-2">
              Notices in all 22 languages of the Eighth Schedule, an itemised list of data for every purpose, rights and
              grievance links, and consent records kept in Mumbai or Hyderabad.
            </p>
            <ArrowLink href="/compliance/dpdpa" className="mt-6 text-ink">
              Read the DPDPA readiness guide
            </ArrowLink>
          </div>
        </div>

        {/* 22 scripts: the notice is offered in each */}
        <ul aria-label="Notice languages" className="pt-reveal mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-[repeat(11,minmax(0,1fr))]">
          {LANGUAGES.map((l) => (
            <li key={l.code} className="group flex min-h-[96px] min-w-0 flex-col justify-between bg-surface px-3 py-3.5 transition-colors hover:bg-brand-wash/60">
              <span
                lang={l.code}
                dir={l.rtl ? "rtl" : "ltr"}
                className={`break-words text-lg leading-snug text-ink transition-colors group-hover:text-brand-ink ${l.rtl ? "text-right" : ""} ${SCRIPT_FONT[l.code] ?? ""}`}
              >
                {l.native}
              </span>
              <span className="mt-3 text-xs text-ink-3">{l.english}</span>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-14">
          <div className="pt-reveal lg:col-span-6">
            <Bezel>
              <ItemisedNotice />
            </Bezel>
          </div>
          <div className="lg:col-span-6">
            <h3 className="text-xl font-semibold">What Rule 3 asks for, done by default</h3>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {[
                ["Itemised notice", "Each purpose lists the data it uses and how long it's kept."],
                ["Any of 22 languages", "Machine-assisted drafts you review, with who reviewed them and when."],
                ["Withdrawal as easy as consent", "A Privacy choices button on every page, and webhooks to your other systems."],
                ["Rights and grievances", "Links to your rights page, a grievance contact and the Data Protection Board."],
              ].map(([t, d]) => (
                <li key={t} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <span className="text-[15px] font-medium">{t}</span>
                  <span className="text-[15px] text-ink-2">{d}</span>
                </li>
              ))}
            </ul>

          </div>
        </div>

        <div className="mt-14">
          <DpdpTimeline buildTime={BUILD_TIME} />
          <p className="mt-4 text-xs text-ink-3">
            A proposal to bring the May 2027 duties forward to November 2026 had not been notified as of October 2026.
          </p>
        </div>
      </div>
    </section>
  );
}
