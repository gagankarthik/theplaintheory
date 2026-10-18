import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { Words } from "../motion";

const STEPS = [
  { title: "Scan your website", body: "See every cookie and tracker it sets today, each with a suggested category to approve." },
  { title: "Design your banner", body: "Match your brand, pick regions and languages, and preview exactly what visitors will see." },
  { title: "Add one script tag", body: "Tracking waits for consent from the first page view, and receipts start arriving." },
];

/** The install tag, coloured by part: tag in white, attributes muted, values in lime. */
function Snippet() {
  const tag = "text-white";
  const attr = "text-mute";
  const val = "text-lime";
  return (
    <code className="block">
      <span className={tag}>&lt;script</span>
      {/* non-breaking indent, so a wrapped line never breaks before its own attribute */}
      {"\n  "}
      <span className={attr}>src</span>
      <span className={tag}>=</span>
      <span className={val}>&quot;https://cdn.example.com/sdk/v1/plain-consent.js&quot;</span>
      {"\n  "}
      <span className={attr}>data-site</span>
      <span className={tag}>=</span>
      <span className={val}>&quot;YOUR_SITE_KEY&quot;</span>
      <span className={tag}>&gt;&lt;/script&gt;</span>
      <span aria-hidden className="mk-caret ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-lime" />
    </code>
  );
}

/**
 * From sign-up to live: the title and the real install tag side by side, then the three steps on one
 * track. The track's line fills in lime as the section scrolls past (across on desktop, down on phones).
 */
export function Install() {
  return (
    <section id="how-it-works" aria-labelledby="install-title" className="on-light scroll-mt-16 bg-chalk px-2.5 py-12 text-soot md:py-16">
      <div className="mx-auto grid max-w-[1440px] gap-1.5 md:grid-cols-12 md:gap-2">
        <div className="flex flex-col justify-between gap-6 rounded-[18px] bg-white p-6 md:col-span-5">
          <div>
            <h2 id="install-title" data-reveal="words" className="max-w-[12ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
              <Words text="Live in an afternoon." />
            </h2>
            <p className="mt-4 max-w-[38ch] text-[1rem] leading-[1.55] text-mute-ink">No rebuild and no agency. If you can edit your site’s head, you can install it.</p>
          </div>
          <Link href="/docs#install" className="group inline-flex min-h-11 items-center gap-1.5 self-start text-[1rem] font-medium hover:underline hover:underline-offset-4">
            Read the install guide
            <IconArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>
        <figure data-reveal className="flex min-w-0 flex-col rounded-[18px] bg-soot text-white md:col-span-7">
          <figcaption className="flex items-center gap-2 border-b border-white/10 px-6 py-4 text-[0.875rem] text-mute">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-lime" />
            </span>
            <span className="ml-2">Paste before &lt;/head&gt;</span>
          </figcaption>
          {/* wraps on phones instead of scrolling sideways */}
          <pre className="flex flex-1 items-center px-6 py-8 text-[clamp(0.8125rem,1.3vw,1.0625rem)] leading-[1.75] whitespace-pre-wrap [overflow-wrap:anywhere]">
            <Snippet />
          </pre>
          <p className="border-t border-white/10 px-6 py-4 text-[0.875rem] text-mute">Your dashboard gives you this tag with your real address and key.</p>
        </figure>
      </div>

      <div className="mx-auto mt-1.5 max-w-[1440px] rounded-[18px] bg-white px-6 py-10 md:mt-2 md:px-10 md:py-14">
        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          {/* the track: a grey rail with a lime fill, behind the step markers */}
          <span aria-hidden className="absolute bottom-6 left-[0.6875rem] top-6 w-[3px] rounded-full bg-chalk md:inset-x-[0.6875rem] md:bottom-auto md:left-[0.6875rem] md:right-[calc(33.333%-1.35rem)] md:top-[0.625rem] md:h-[3px] md:w-auto">
            <span className="mk-track-fill absolute inset-0 origin-top rounded-full bg-lime md:origin-left" />
          </span>
          {STEPS.map((s, i) => (
            <li key={s.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="relative pl-10 md:pl-0">
              {/* the ring marker: open, then filled lime with a soot centre */}
              <span aria-hidden className="absolute left-0 top-0 grid size-6 place-items-center rounded-full bg-lime ring-[5px] ring-white md:relative">
                <span className="size-2 rounded-full bg-soot" />
              </span>
              <p className="font-[family-name:var(--font-data)] text-[0.875rem] text-mute-ink md:mt-6">
                Step {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-[clamp(1.375rem,2vw,1.8rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{s.title}</h3>
              <p className="mt-2 max-w-[36ch] text-[1rem] leading-[1.55] text-soot/80">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
