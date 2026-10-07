import type { ReactNode } from "react";
import { IconBalance, IconHeld, IconScan, type IconProps } from "@/components/icons";
import { IconBrowserSignal } from "./coverage-icons";

/**
 * Why it matters, told through the product: four safeguards Plain Theory applies by default, each with
 * one real fine for getting it wrong. Figures are from regulators' announcements; keep it that way.
 */
const SAFEGUARDS: { icon: (p: IconProps) => ReactNode; title: string; body: string; fine: string }[] = [
  {
    icon: IconHeld,
    title: "Nothing loads before consent",
    body: "Analytics and ad tags wait until the visitor agrees.",
    fine: "Shein, €150M · CNIL 2025",
  },
  {
    icon: IconBalance,
    title: "Reject is as easy as Accept",
    body: "Both on the first layer, with equal weight.",
    fine: "Google, €150M · CNIL 2021",
  },
  {
    icon: (p) => <IconBrowserSignal width={p.size ?? 20} height={p.size ?? 20} />,
    title: "Browser opt-outs honoured",
    body: "Global Privacy Control is applied automatically.",
    fine: "Tractor Supply, $1.35M · CPPA 2025",
  },
  {
    icon: IconScan,
    title: "Leaks caught early",
    body: "If a tag fires after a decline, you're alerted.",
    fine: "Healthline, $1.55M · California AG 2025",
  },
];

export function CostOfConsent() {
  return (
    <section id="risk" aria-labelledby="risk-title" className="bg-ink text-white">
      <div className="container-page py-24 md:py-32">
        <header className="pt-reveal max-w-[640px]">
          <h2 id="risk-title" className="display text-[2.25rem] sm:text-[2.75rem] md:text-[3.25rem]">
            Most banners only look compliant. Ours does the work.
          </h2>
          <p className="mt-5 text-lg text-white/70">Regulators click Reject and watch what still loads. These are the four things they check.</p>
        </header>

        <ul data-gsap-stagger className="mt-14 grid gap-px overflow-hidden rounded-[20px] bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {SAFEGUARDS.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="flex flex-col bg-ink p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-[10px] bg-white/[0.07] text-brand-on-ink ring-1 ring-inset ring-white/10">
                  <Icon size={20} />
                </span>
                <h3 className="mt-6 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/70">{s.body}</p>
                <p className="mt-auto pt-6 text-xs text-white/50">
                  <span className="sr-only">A fine for getting this wrong: </span>
                  {s.fine}
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-xs text-white/40">Fines from each regulator&apos;s announcement. Not legal advice.</p>
      </div>
    </section>
  );
}
