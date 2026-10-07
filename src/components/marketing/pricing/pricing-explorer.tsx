"use client";

import { CurrencySelect } from "@/components/shared/currency-select";
import { currencyInfo, type Plan } from "@/lib/plans";
import { PricingPlans } from "../pricing-plans";
import { Segmented } from "./segmented";
import { useBilling } from "./use-billing";

/**
 * Billing period and currency controls. Shares state with <PricingCards> through the URL
 * (?currency=eur&period=annual), so the two can sit in different parts of the page.
 */
export function BillingControls({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { currency, period, setCurrency, setPeriod } = useBilling();
  const dark = tone === "dark";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <Segmented
          label="Billing period"
          tone={tone}
          value={period}
          onChange={setPeriod}
          options={[
            { value: "monthly", label: "Monthly" },
            {
              value: "annual",
              label: (
                <>
                  Annual
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
                      dark && period !== "annual" ? "bg-white/15 text-white" : "bg-jade-wash text-jade"
                    }`}
                  >
                    2 months free
                  </span>
                </>
              ),
            },
          ]}
        />
        <CurrencySelect tone={tone} value={currency} onChange={setCurrency} />
      </div>
      <p className={`text-[13px] ${dark ? "text-white/75" : "text-ink-3"}`} aria-live="polite">
        Prices in {currencyInfo(currency).plural}, {currencyInfo(currency).tax}.{currency === "inr" ? " For a GST invoice, contact us." : ""}{" "}
        {period === "annual" ? "Billed once a year." : "Billed monthly."}
      </p>
    </div>
  );
}

/** The plan cards, reflecting the current billing controls. */
export function PricingCards({ plans }: { plans: Plan[] }) {
  const { currency, period } = useBilling();
  return (
    <div className="rounded-[var(--radius-lg)] shadow-[var(--shadow-float)]">
      <PricingPlans headingLevel="h2" currency={currency} period={period} plans={plans} />
    </div>
  );
}
