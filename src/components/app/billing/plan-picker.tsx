"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { Badge } from "@/components/app/ui/badge";
import { buttonClass } from "@/components/app/ui/button";
import { Segmented } from "@/components/app/ui/tabs";
import { CurrencySelect } from "@/components/shared/currency-select";
import { currencyInfo, formatPrice, planPrice, type Currency, type Plan } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

type Interval = "monthly" | "annual";

export function Price({ plan, currency, interval }: { plan: Plan; currency: Currency; interval: Interval }) {
  const monthly = planPrice(plan, currency);
  if (monthly === null) return <span className="text-xl font-semibold">Custom</span>;
  const fmt = (n: number) => formatPrice(n, currency);
  if (monthly === 0)
    return (
      <span className="flex items-baseline gap-1">
        <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">{fmt(0)}</span>
        <span className="text-sm text-ink-3">forever</span>
      </span>
    );
  const year = planPrice(plan, currency, "annual") ?? monthly * 10;
  const perMonth = interval === "annual" ? year / 12 : monthly;
  return (
    <span className="block">
      <span className="flex items-baseline gap-1">
        <span className="text-[2rem] font-semibold tabular-nums leading-none tracking-[-0.03em]">{fmt(perMonth)}</span>
        <span className="text-sm text-ink-3">per month{currency === "inr" ? " + GST" : currency === "usd" ? "" : " + VAT"}</span>
      </span>
      <span className="mt-1 block text-xs text-ink-3">
        {interval === "annual" ? `${fmt(year)} billed yearly` : "Billed monthly, cancel any time"}
      </span>
    </span>
  );
}

export function PlanPicker({
  plans,
  current,
  canBill,
  purchasable,
  hasCustomer,
}: {
  plans: Plan[];
  current: PlanId;
  canBill: boolean;
  /** plan id -> interval -> checkout is configured */
  purchasable: Record<string, Record<Interval, boolean>>;
  hasCustomer: boolean;
}) {
  const [currency, setCurrency] = useState<Currency>("usd");
  const [interval, setInterval] = useState<Interval>("monthly");
  const order = plans.map((p) => p.id);
  const rank = (id: PlanId) => order.indexOf(id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="plans-h" className="text-lg font-semibold">
          Plans
        </h2>
        <div className="flex flex-wrap gap-2">
          <Segmented
            size="sm"
            label="Billing period"
            value={interval}
            onChange={setInterval}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Yearly, 2 months free" },
            ]}
          />
          <CurrencySelect size="sm" value={currency} onChange={setCurrency} />
        </div>
      </div>

      <ul className="grid overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-2 xl:grid-cols-4" style={{ gap: 1 }}>
        {plans.map((p) => {
          const isCurrent = p.id === current;
          const upgrade = rank(p.id) > rank(current);
          const canBuy = purchasable[p.id]?.[interval];
          return (
            <li key={p.id} className={`flex flex-col p-6 ${isCurrent ? "bg-brand-wash/30 shadow-[inset_0_0_0_2px_var(--color-brand)]" : "bg-surface"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{p.name}</h3>
                {isCurrent ? <Badge tone="brand">Current</Badge> : null}
              </div>
              <p className="mt-1 min-h-10 text-sm text-ink-3">{p.summary}</p>
              <div className="mt-4 min-h-16">
                <Price plan={p} currency={currency} interval={interval} />
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <p className="text-xs text-ink-3">Your current plan.</p>
                ) : !canBill ? (
                  <p className="text-xs text-ink-3">Only owners can change the plan.</p>
                ) : p.id === "free" ? (
                  hasCustomer ? (
                    <form action="/api/stripe/portal" method="post">
                      <button className={buttonClass("ghost", "md", "w-full")}>Downgrade in one click</button>
                    </form>
                  ) : null
                ) : (
                  <form action="/api/stripe/checkout" method="post">
                    <input type="hidden" name="plan" value={p.id} />
                    <input type="hidden" name="interval" value={interval} />
                    <input type="hidden" name="currency" value={currency} />
                    <button className={buttonClass(upgrade ? "primary" : "ghost", "md", "w-full")} disabled={!canBuy} aria-describedby={canBuy ? undefined : `buy-${p.id}`}>
                      {upgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                    </button>
                    {!canBuy ? (
                      <p id={`buy-${p.id}`} className="mt-2 text-xs text-ink-3">
                        Checkout isn&apos;t connected for this plan yet.
                      </p>
                    ) : null}
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {currency !== "usd" ? (
        <p className="mt-3 text-xs text-ink-3">
          {currencyInfo(currency).code} prices are {currencyInfo(currency).tax}, shown on your invoice.
        </p>
      ) : null}
    </div>
  );
}
