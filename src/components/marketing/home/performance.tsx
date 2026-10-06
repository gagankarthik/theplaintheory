import { Bezel, Section } from "../primitives";

interface Request {
  name: string;
  size: string;
  start: number;
  end: number;
  kind: "doc" | "ours" | "app" | "held";
}

/** An example page load, in milliseconds. Trackers have no bar until consent. */
const requests = (sizeKb: string): Request[] => [
  { name: "northwind.store", size: "18 KB", start: 0, end: 110, kind: "doc" },
  { name: "plain-consent.js", size: `${sizeKb} KB`, start: 112, end: 131, kind: "ours" },
  { name: "c/pk_live_7Hq.json", size: "1.1 KB", start: 131, end: 146, kind: "ours" },
  { name: "app.css", size: "24 KB", start: 114, end: 190, kind: "app" },
  { name: "app.js", size: "96 KB", start: 116, end: 290, kind: "app" },
  { name: "gtag/js", size: "Held", start: 0, end: 0, kind: "held" },
  { name: "fbevents.js", size: "Held", start: 0, end: 0, kind: "held" },
];
const SCALE = 400;
const TICKS = [0, 100, 200, 300];

const facts = (sizeKb: string) => [
  { term: "Script size", detail: `${sizeKb} KB gzipped, with a hard 10 KB budget that fails our build if it's exceeded.` },
  { term: "Delivery", detail: "Served from the CloudFront edge closest to your visitor. Your config is cached for 60 seconds." },
  { term: "Layout shift", detail: "None. The banner renders in its own shadow root, above your page, never inside it." },
];

const BAR: Record<Request["kind"], string> = {
  doc: "bg-white/35",
  ours: "bg-brand-on-ink",
  app: "bg-white/20",
  held: "",
};

/**
 * Script weight on first load, gzipped. Competitor figures come only from sources we could verify;
 * unverified third-party measurements are deliberately left out.
 */
const weights = (sizeKb: string) => [
  { name: "Plain Theory", kb: Number(sizeKb), note: "Measured on every build", ours: true },
  { name: "Klaro", kb: 57, note: "Project README on GitHub", href: "https://github.com/kiprotect/klaro" },
  { name: "OneTrust", kb: 83.7, note: "Stub plus banner SDK, from OneTrust's developer docs", href: "https://developer.onetrust.com/onetrust/docs/performance-availability-cookie-script" },
];

export function Performance({ sizeKb }: { sizeKb: string }) {
  const REQUESTS = requests(sizeKb);
  const FACTS = facts(sizeKb);
  const WEIGHTS = weights(sizeKb);
  const max = Math.max(...WEIGHTS.map((w) => w.kb));
  return (
    <Section id="performance" tone="white" labelledBy="performance-title">
      <div className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="pt-reveal lg:col-span-5">
          <h2 id="performance-title" className="display text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]">
            Small enough to load first
          </h2>
          <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
            Consent has to be decided before anything else runs, so the script that decides it can&apos;t slow the page down.
          </p>
          <dl className="mt-10 divide-y divide-line">
            {FACTS.map((f) => (
              <div key={f.term} className="grid gap-1 py-4 sm:grid-cols-[130px_1fr] sm:gap-6">
                <dt className="text-sm font-medium text-ink">{f.term}</dt>
                <dd className="text-sm text-ink-2">{f.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="pt-reveal lg:col-span-7">
          <Bezel>
          <div className="overflow-hidden bg-ink-raised text-white">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 text-xs text-white/55">
              <span className="font-medium text-white/85">Network</span>
              <span>First visit</span>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-[minmax(0,150px)_56px_1fr] items-center gap-x-4 pb-2 text-[11px] text-white/55" aria-hidden>
                <span>Request</span>
                <span className="text-right">Size</span>
                <span className="relative h-4">
                  {TICKS.map((t) => (
                    <span key={t} className="absolute hidden -translate-x-1/2 whitespace-nowrap tabular-nums sm:block" style={{ left: `${(t / SCALE) * 100}%` }}>
                      {t === 0 ? "" : `${t} ms`}
                    </span>
                  ))}
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Example network waterfall: the consent script and its config load within 150 milliseconds, and the Google and Meta
                  trackers are held until consent.
                </caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">Size</th>
                    <th scope="col">Timing</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUESTS.map((r) => (
                    <tr key={r.name} className="grid grid-cols-[minmax(0,150px)_56px_1fr] items-center gap-x-4 border-t border-white/5 py-2">
                      <th scope="row" className={`truncate font-mono font-normal ${r.kind === "ours" ? "text-white" : r.kind === "held" ? "text-amber-bright" : "text-white/60"}`}>
                        {r.name}
                      </th>
                      <td className={`text-right tabular-nums ${r.kind === "held" ? "text-amber-bright" : "text-white/55"}`}>{r.size}</td>
                      <td className="relative h-3">
                        {/* faint grid */}
                        {[...TICKS.slice(1), SCALE].map((t) => (
                          <span key={t} aria-hidden className="absolute inset-y-[-8px] w-px bg-white/5" style={{ left: `${(t / SCALE) * 100}%` }} />
                        ))}
                        {r.kind === "held" ? (
                          <span className="absolute inset-y-0 left-[37%] right-0 rounded-sm border border-dashed border-amber-bright/70">
                            <span className="sr-only">Not loaded. Waiting for consent.</span>
                          </span>
                        ) : (
                          <span
                            className={`absolute inset-y-0 rounded-sm ${BAR[r.kind]}`}
                            style={{ left: `${(r.start / SCALE) * 100}%`, width: `${Math.max(((r.end - r.start) / SCALE) * 100, 1.2)}%` }}
                          >
                            <span className="sr-only">
                              {r.start} to {r.end} milliseconds
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 px-5 py-3 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-4 rounded-sm bg-brand-on-ink" /> Plain Theory
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-4 rounded-sm bg-white/25" /> Your page
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-4 rounded-sm border border-dashed border-amber-bright" /> Held until consent
              </span>
            </div>
          </div>
          </Bezel>
        </figure>
      </div>
      <figure className="pt-reveal mt-20 border-t border-line pt-10">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-ink">Consent script weight on first load, gzipped</span>
          <span className="text-xs text-ink-3">Smaller is faster. Sources linked.</span>
        </figcaption>
        <ul className="mt-8 space-y-6">
          {WEIGHTS.map((w) => (
            <li key={w.name} className="grid items-center gap-x-6 gap-y-2 sm:grid-cols-[220px_1fr]">
              <div>
                <p className={`text-sm ${w.ours ? "font-semibold text-ink" : "text-ink-2"}`}>{w.name}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {w.href ? (
                    <a href={w.href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ink hover:underline">
                      {w.note}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    w.note
                  )}
                </p>
              </div>
              {/* A bar with its value at the end; no background track */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`h-2.5 rounded-full ${w.ours ? "bg-brand" : "bg-ink-3/35"}`}
                  style={{ width: `${Math.max((w.kb / max) * 85, 2)}%` }}
                />
                <span className={`shrink-0 text-sm tabular-nums ${w.ours ? "font-semibold text-ink" : "text-ink-2"}`}>{w.kb} KB</span>
              </div>
            </li>
          ))}
        </ul>
      </figure>
    </Section>
  );
}
