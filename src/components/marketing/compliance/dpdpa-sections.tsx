import { IconCheck, IconClose } from "@/components/icons";

/**
 * The 22 languages of the Eighth Schedule to the Constitution of India, which DPDP Act s.5(3) lets a
 * Data Principal choose for their notice. Autonyms in native script; RTL where the script is.
 */
const LANGUAGES: { code: string; english: string; native: string; rtl?: boolean }[] = [
  { code: "as", english: "Assamese", native: "অসমীয়া" },
  { code: "bn", english: "Bengali", native: "বাংলা" },
  { code: "brx", english: "Bodo", native: "बड़ो" },
  { code: "doi", english: "Dogri", native: "डोगरी" },
  { code: "gu", english: "Gujarati", native: "ગુજરાતી" },
  { code: "hi", english: "Hindi", native: "हिन्दी" },
  { code: "kn", english: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", english: "Kashmiri", native: "كٲشُر", rtl: true },
  { code: "kok", english: "Konkani", native: "कोंकणी" },
  { code: "mai", english: "Maithili", native: "मैथिली" },
  { code: "ml", english: "Malayalam", native: "മലയാളം" },
  { code: "mni", english: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "mr", english: "Marathi", native: "मराठी" },
  { code: "ne", english: "Nepali", native: "नेपाली" },
  { code: "or", english: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", english: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", english: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", english: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", english: "Sindhi", native: "سنڌي", rtl: true },
  { code: "ta", english: "Tamil", native: "தமிழ்" },
  { code: "te", english: "Telugu", native: "తెలుగు" },
  { code: "ur", english: "Urdu", native: "اردو", rtl: true },
];

const SECTION_H = "display text-[2rem] sm:text-[2.25rem]";
const LEAD = "mt-5 max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-2";

export function LanguagesSection() {
  return (
    <section id="languages" aria-labelledby="languages-h" className="mt-20 scroll-mt-28">
      <h2 id="languages-h" className={SECTION_H}>
        Notices in all 22 languages
      </h2>
      <p className={LEAD}>
        Section 5(3) lets a person read the notice in English or any language in the Eighth Schedule to the Constitution.
        Plain Theory picks the language from the page and the browser, and lets visitors switch inside the notice.
      </p>
      <ul className="mt-10 flex flex-wrap gap-2.5" aria-label="The 22 languages of the Eighth Schedule">
        {LANGUAGES.map((l) => (
          <li
            key={l.code}
            className="inline-flex items-baseline gap-2.5 rounded-full bg-surface py-2 pl-4 pr-3.5 ring-1 ring-inset ring-line transition-shadow hover:ring-ink"
          >
            <span lang={l.code} dir={l.rtl ? "rtl" : "ltr"} className="text-[17px] font-medium text-ink">
              {l.native}
            </span>
            <span className="text-xs text-ink-3">{l.english}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 rounded-[var(--radius-lg)] bg-paper p-5 text-sm text-ink-2 sm:grid-cols-2 sm:p-6">
        <p>
          <span className="font-semibold text-ink">Drafts, then a person signs off.</span> Each language starts as a
          machine-assisted draft. A native speaker on your team reviews it and marks it reviewed; the reviewer and date are
          recorded and show up in your Evidence Pack.
        </p>
        <p>
          <span className="font-semibold text-ink">Which plans.</span> English and Hindi are on every plan, including Free.
          All 22 languages are on Starter and above.
        </p>
      </div>
    </section>
  );
}

/** An itemised purpose exactly as a visitor would read it, to show what Rule 3 asks for. */
function ItemisedExample() {
  const items = ["Pages you visit and how long you stay", "Device and browser type", "Approximate location (city)"];
  return (
    <figure className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-lift)] ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <p className="text-sm font-semibold">Analytics</p>
        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">Optional</span>
      </div>
      <dl className="divide-y divide-line text-sm">
        <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[140px_1fr] sm:gap-4">
          <dt className="text-ink-3">Why</dt>
          <dd className="text-ink">To see which pages are useful and fix the ones that aren&apos;t.</dd>
        </div>
        <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[140px_1fr] sm:gap-4">
          <dt className="text-ink-3">Data collected</dt>
          <dd>
            <ul className="space-y-1 text-ink">
              {items.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                  {i}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[140px_1fr] sm:gap-4">
          <dt className="text-ink-3">Kept for</dt>
          <dd className="text-ink">13 months, then deleted</dd>
        </div>
        <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[140px_1fr] sm:gap-4">
          <dt className="text-ink-3">Change your mind</dt>
          <dd className="text-ink">Privacy choices button on every page. One tap withdraws.</dd>
        </div>
      </dl>
      <figcaption className="border-t border-line bg-paper px-5 py-3 text-xs text-ink-3">
        One purpose from a Plain Theory DPDPA notice. Each optional purpose is listed this way.
      </figcaption>
    </figure>
  );
}

export function ItemisedSection() {
  return (
    <section id="itemised" aria-labelledby="itemised-h" className="mt-20 scroll-mt-28">
      <h2 id="itemised-h" className={SECTION_H}>
        Itemised notices
      </h2>
      <div className="mt-8 grid gap-10 xl:grid-cols-2 xl:items-start">
        <div>
          <p className="max-w-[56ch] text-[1.0625rem] leading-relaxed text-ink-2">
            Rule 3 asks for a notice that makes sense on its own and gives, for each purpose, an itemised description of
            the personal data and what it&apos;s used for, along with the goods, services or uses it enables.
          </p>
          <p className="mt-5 max-w-[56ch] text-[1.0625rem] leading-relaxed text-ink-2">
            In Plain Theory each category carries its own list of data items and how long they&apos;re kept. The notice is
            built from that list, so the words a visitor reads and the data you actually collect come from one place.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-ink-2">
            {[
              "Data items and retention per purpose, edited in the banner builder",
              "Rights, grievance contact and Data Protection Board link in the notice",
              "The fairness check flags any optional purpose with no data items listed",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <IconCheck size={16} className="mt-1 shrink-0 text-jade" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <ItemisedExample />
      </div>
    </section>
  );
}

const CM_ROWS: { label: string; cm: string; cmp: string }[] = [
  { label: "What it is", cm: "A registered intermediary that lets a person give, manage and withdraw consent across many businesses", cmp: "Software a business runs on its own site or app to collect and record consent" },
  { label: "Registers with the Data Protection Board", cm: "Yes, from 13 November 2026", cmp: "No" },
  { label: "Eligibility", cm: "Company in India, net worth of at least ₹2 crore, independent certification, no conflict of interest", cmp: "None" },
  { label: "Sees the personal data", cm: "No. Must be data-blind: it can't read the data the consent covers", cmp: "Records consent decisions for the business that uses it" },
  { label: "Do you need one?", cm: "Optional. People may choose to use one; businesses must accept consent given through one", cmp: "You need some way to give notice and record consent; a CMP is the usual one" },
];

export function ConsentManagerSection() {
  return (
    <section id="consent-managers" aria-labelledby="cm-h" className="mt-20 scroll-mt-28">
      <h2 id="cm-h" className={SECTION_H}>
        Consent Manager or consent management platform?
      </h2>
      <p className={LEAD}>
        Some vendors suggest every consent tool must register with the Board. That isn&apos;t what the Rules say. Only
        Consent Managers register. A consent management platform like Plain Theory doesn&apos;t, and you don&apos;t need a
        Consent Manager to comply.
      </p>

      <div className="mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-line">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">How a registered Consent Manager differs from a consent management platform</caption>
          <thead className="hidden bg-paper text-sm sm:table-header-group">
            <tr>
              <th scope="col" className="w-[24%] px-5 py-3.5 font-medium text-ink-3">
                <span className="sr-only">Question</span>
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-ink">
                Consent Manager
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-ink">
                Consent management platform
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CM_ROWS.map((r) => (
              <tr key={r.label} className="flex flex-col gap-2 px-5 py-4 sm:table-row sm:p-0">
                <th scope="row" className="text-sm font-semibold text-ink sm:px-5 sm:py-4 sm:align-top">
                  {r.label}
                </th>
                <td className="text-sm text-ink-2 sm:px-5 sm:py-4 sm:align-top">
                  <span className="mr-1.5 font-medium text-ink sm:hidden">Consent Manager:</span>
                  {r.cm}
                </td>
                <td className="text-sm text-ink-2 sm:px-5 sm:py-4 sm:align-top">
                  <span className="mr-1.5 font-medium text-ink sm:hidden">CMP:</span>
                  {r.cmp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] bg-paper p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <IconCheck size={16} className="text-jade" /> Today
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Consent arriving from another system can be applied with <code className="font-mono text-[13px]">PlainConsent.set()</code>{" "}
            and is logged like any other decision. On Business, withdrawals can be pushed to your systems with signed webhooks.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-paper p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <IconClose size={16} className="text-ink-3" /> Not yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            A direct connection to registered Consent Managers. The Board hasn&apos;t published the interoperability standard;
            we&apos;ll build to it when it does. Plain Theory won&apos;t register as a Consent Manager.
          </p>
        </div>
      </div>
    </section>
  );
}
