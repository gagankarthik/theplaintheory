"use client";

import { useState, type ReactNode } from "react";
import { Price } from "@/components/app/billing/plan-picker";
import { Button, buttonClass } from "@/components/app/ui/button";
import { Dialog } from "@/components/app/ui/dialog";
import { Segmented } from "@/components/app/ui/tabs";
import { CurrencySelect } from "@/components/shared/currency-select";
import { IconCheck, IconLock } from "@/components/icons";
import type { Currency, Plan } from "@/lib/plans";

type Interval = "monthly" | "annual";

export interface UpgradeOffer {
  /** plans that unlock the feature, cheapest first */
  plans: Plan[];
  /** plan id -> interval -> a Stripe price exists */
  purchasable: Record<string, Record<Interval, boolean>>;
  /** this person may change the plan */
  canBill: boolean;
  /** an existing paid subscription changes plan in the Stripe portal, not a second checkout */
  usePortal: boolean;
}

/**
 * A feature the current plan doesn't include: the trigger shows a lock, and opening it offers
 * the plans that unlock it with a straight path to payment (Stripe Checkout).
 */
export function LockedAction({
  label,
  icon,
  title,
  reason,
  /** one line per plan: what this plan gives for the locked feature, e.g. "2 team seats" */
  unlocks,
  offer,
  variant = "primary",
  size = "md",
}: {
  label: string;
  icon?: ReactNode;
  title: string;
  reason: ReactNode;
  unlocks: (plan: Plan) => string;
  offer: UpgradeOffer;
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("usd");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [choice, setChoice] = useState(offer.plans[0]?.id);
  const chosen = offer.plans.find((p) => p.id === choice);
  const canBuy = chosen ? offer.purchasable[chosen.id]?.[interval] : false;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {icon}
        {label}
        <span className={`ml-0.5 grid size-5 place-items-center rounded-full ${variant === "primary" ? "bg-white/20" : "bg-paper text-ink-3 ring-1 ring-inset ring-line"}`} aria-hidden>
          <IconLock size={12} />
        </span>
        <span className="sr-only"> (needs a plan upgrade)</span>
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={reason} width={560}>
        {!offer.plans.length ? (
          <p className="text-sm text-ink-2">
            Talk to us about Enterprise:{" "}
            <a className="font-medium text-brand underline-offset-2 hover:underline" href="/contact-sales">
              contact sales
            </a>
            .
          </p>
        ) : (
          <form action={offer.usePortal ? "/api/stripe/portal" : "/api/stripe/checkout"} method="post" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            <fieldset>
              <legend className="sr-only">Choose a plan</legend>
              <div className="space-y-2.5">
                {offer.plans.map((p) => {
                  const on = p.id === choice;
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer gap-3 rounded-[14px] border p-4 transition-[border-color,box-shadow,background-color] duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                        on ? "border-brand bg-brand-wash/40 shadow-[0_0_0_1px_var(--color-brand)]" : "border-line-strong hover:border-line-input"
                      }`}
                    >
                      <input type="radio" name="plan" value={p.id} checked={on} onChange={() => setChoice(p.id)} className="sr-only" />
                      <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand" : "border-line-input"}`}>
                        {on ? <span className="size-2.5 rounded-full bg-brand" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-base font-semibold text-ink">{p.name}</span>
                          <span className="[&_.text-\[2rem\]]:text-xl">
                            <Price plan={p} currency={currency} interval={interval} />
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                          <IconCheck size={16} /> {unlocks(p)}
                        </span>
                        <span className="mt-1 block text-xs text-ink-3">{p.summary}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <input type="hidden" name="interval" value={interval} />
            <input type="hidden" name="currency" value={currency} />

            <div className="border-t border-line pt-4">
              {!offer.canBill ? (
                <p className="text-sm text-ink-2">Only an owner can change the plan. Ask the owner of this organization to upgrade.</p>
              ) : (
                <>
                  <button type="submit" className={buttonClass("primary", "md", "w-full")} disabled={!offer.usePortal && !canBuy}>
                    {offer.usePortal ? `Switch to ${chosen?.name ?? "this plan"}` : `Continue to payment`}
                  </button>
                  <p className="mt-2 text-center text-xs text-ink-3">
                    {offer.usePortal
                      ? "Opens your Stripe billing portal to change the plan."
                      : canBuy
                        ? "Secure checkout by Stripe. Cancel any time."
                        : "Checkout isn't connected for this plan yet."}
                  </p>
                </>
              )}
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
