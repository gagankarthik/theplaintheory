import Link from "next/link";
import { IconArrowRight } from "@/components/icons";

const STEPS = [
  { title: "Scan your website", body: "See every cookie and tracker it sets today, each with a suggested category to approve." },
  { title: "Design your banner", body: "Match your brand, pick regions and languages, and preview exactly what visitors will see." },
  { title: "Add one script tag", body: "Tracking waits for consent from the first page view, and receipts start arriving." },
];

/** From sign-up to live, on the same filled tiles as the board: the title, the real install tag, three steps. */
export function Install() {
  // A placeholder, like the key: the dashboard gives each customer their exact tag.
  const snippet = `<script src="https://cdn.example.com/sdk/v1/plain-consent.js"\n        data-site="YOUR_SITE_KEY"></script>`;
  return (
    <section id="how-it-works" aria-labelledby="install-title" className="on-light scroll-mt-16 bg-chalk px-2.5 py-12 text-soot md:py-16">
      <div className="mx-auto grid max-w-[1440px] gap-1.5 md:grid-cols-12 md:gap-2">
        <div className="flex flex-col justify-between gap-6 rounded-[18px] bg-white p-6 md:col-span-5">
          <h2 id="install-title" className="max-w-[12ch] text-[clamp(2.25rem,4.2vw,3.75rem)]">
            Live in an afternoon.
          </h2>
          <Link href="/docs#install" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[1rem] font-medium hover:underline hover:underline-offset-4">
            Read the install guide
            <IconArrowRight size={16} />
          </Link>
        </div>
        <figure className="flex min-w-0 flex-col rounded-[18px] bg-soot text-white md:col-span-7">
          <figcaption className="border-b border-white/10 px-6 py-4 text-[0.875rem] text-mute">Paste before &lt;/head&gt;</figcaption>
          <pre className="flex flex-1 items-center overflow-x-auto px-6 py-8 text-[clamp(0.875rem,1.3vw,1.0625rem)] leading-[1.7]">
            <code>{snippet}</code>
          </pre>
          <p className="border-t border-white/10 px-6 py-4 text-[0.875rem] text-mute">Your dashboard gives you this tag with your real address and key.</p>
        </figure>
      </div>
      <ol className="mx-auto mt-1.5 grid max-w-[1440px] gap-1.5 md:mt-2 md:grid-cols-3 md:gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex min-h-[220px] flex-col rounded-[18px] bg-white p-6">
            <span aria-hidden className="font-[family-name:var(--font-data)] text-[0.875rem] text-mute-ink">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-auto text-[clamp(1.375rem,2vw,1.8rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{s.title}</h3>
            <p className="mt-2 max-w-[36ch] text-[1rem] leading-[1.55] text-soot/80">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
