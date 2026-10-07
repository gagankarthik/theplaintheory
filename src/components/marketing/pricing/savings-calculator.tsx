"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { currencyInfo, type Plan } from "@/lib/plans";
import { PER_DOMAIN_EUR, PER_DOMAIN_SOURCE, compactNumber, formatEur, formatMoney, quote, recommendPlan } from "./billing";
import { useBilling } from "./use-billing";

/** Monthly pageview stops for the slider: roughly logarithmic, so small and large sites are both easy to pick. */
const PAGEVIEW_STOPS = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

/**
 * Compares Plain Theory's per-account price with per-domain pricing. The per-domain figure is an
 * estimate from one cited public price; both currencies are shown as-is rather than converted.
 */
export function SavingsCalculator({ plans }: { plans: Plan[] }) {
  const { currency, period } = useBilling();
  const [sites, setSites] = useState(5);
  const [stop, setStop] = useState(4); // 100k
  const pageviews = PAGEVIEW_STOPS[stop];
  const plan = recommendPlan(sites, pageviews, plans);
  const q = quote(plan, currency, period);
  const perDomain = sites * PER_DOMAIN_EUR;
  const sitesId = useId();
  const pvId = useId();

  return (
    <div className="grid overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface lg:grid-cols-12">
      <div className="space-y-9 p-6 sm:p-9 lg:col-span-7">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={sitesId} className="text-sm font-medium text-ink">
              Websites
            </label>
            <output htmlFor={sitesId} className="display text-3xl tabular-nums">
              {sites}
            </output>
          </div>
          <input
            id={sitesId}
            type="range"
            min={1}
            max={50}
            step={1}
            value={sites}
            onChange={(e) => setSites(Number(e.target.value))}
            aria-valuetext={`${sites} website${sites === 1 ? "" : "s"}`}
            className="mt-4 h-2 w-full cursor-pointer accent-[var(--color-ink)]"
          />
          <div className="mt-2 flex justify-between text-xs text-ink-3" aria-hidden>
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={pvId} className="text-sm font-medium text-ink">
              Pageviews a month, all sites together
            </label>
            <output htmlFor={pvId} className="display text-3xl tabular-nums">
              {compactNumber(pageviews)}
            </output>
          </div>
          <input
            id={pvId}
            type="range"
            min={0}
            max={PAGEVIEW_STOPS.length - 1}
            step={1}
            value={stop}
            onChange={(e) => setStop(Number(e.target.value))}
            aria-valuetext={`${pageviews.toLocaleString("en-US")} pageviews a month`}
            className="mt-4 h-2 w-full cursor-pointer accent-[var(--color-ink)]"
          />
          <div className="mt-2 flex justify-between text-xs text-ink-3" aria-hidden>
            <span>5k</span>
            <span>5M</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-3">
          Pageviews are pooled across all your sites. Adding a site never adds a fee on its own.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-8 border-t border-line bg-paper p-6 sm:p-9 lg:col-span-5 lg:border-l lg:border-t-0" aria-live="polite">
        <div>
          <p className="text-sm text-ink-3">Your Plain Theory plan</p>
          <p className="mt-1 text-xl font-semibold">{plan.name}</p>
          <p className="mt-4 flex items-baseline gap-1.5">
            {q ? (
              <>
                <span className="display text-5xl tabular-nums">{formatMoney(q.perMonth, currency)}</span>
                <span className="text-sm text-ink-3">/ month</span>
              </>
            ) : (
              <span className="display text-4xl">Custom</span>
            )}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            {q && period === "annual" && q.charged > 0 ? `${formatMoney(q.charged, currency)} billed yearly. ` : ""}
            {currency !== "usd" && q && q.perMonth > 0 ? `Prices ${currencyInfo(currency).tax}.` : ""}
          </p>

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm text-ink-3">Typical per-domain pricing (estimate)</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="display text-3xl tabular-nums text-ink-2">{formatEur(perDomain)}</span>
              <span className="text-sm text-ink-3">/ month</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              {sites} × {formatEur(PER_DOMAIN_EUR)} per domain, from the{" "}
              <a href={PER_DOMAIN_SOURCE.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                {PER_DOMAIN_SOURCE.label}
              </a>{" "}
              ({PER_DOMAIN_SOURCE.fetched}). Lowest tier per domain; larger sites cost more.
            </p>
          </div>
        </div>

        {plan.id === "enterprise" ? (
          <Link href="/contact-sales" className="btn btn-pill btn-primary">
            Talk to sales about {compactNumber(pageviews)} pageviews
          </Link>
        ) : (
          <Link href={plan.id === "free" ? "/signup" : `/signup?plan=${plan.id}`} className="btn btn-pill btn-primary">
            {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
          </Link>
        )}
      </div>
    </div>
  );
}
