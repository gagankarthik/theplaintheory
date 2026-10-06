import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { PLANS, SELF_SERVE_PLANS, currencyInfo, type Plan } from "@/lib/plans";
import { compactNumber, formatMoney, quote, retentionLabel, type Currency, type Period } from "./pricing/billing";

const CTA: Record<Plan["id"], { label: string; href: string }> = {
  free: { label: "Start free", href: "/signup" },
  starter: { label: "Choose Starter", href: "/signup?plan=starter" },
  growth: { label: "Choose Growth", href: "/signup?plan=growth" },
  business: { label: "Choose Business", href: "/signup?plan=business" },
  enterprise: { label: "Talk to sales", href: "/contact-sales" },
};

function Price({ plan, currency, period, featured }: { plan: Plan; currency: Currency; period: Period; featured: boolean }) {
  const q = quote(plan, currency, period);
  const muted = featured ? "text-white/70" : "text-ink-3";
  if (!q) return null;
  const free = q.perMonth === 0;
  return (
    <div className="mt-7">
      <p className="flex items-baseline gap-1.5">
        <span className="display text-[2.75rem] tabular-nums">{formatMoney(q.perMonth, currency)}</span>
        {free ? null : <span className={`text-sm ${muted}`}>/ month</span>}
      </p>
      <p className={`mt-1.5 text-[13px] leading-snug xl:min-h-[2.5rem] ${muted}`}>
        {free ? (
          "Free forever. No card needed."
        ) : (
          <>
            {period === "annual" ? `${formatMoney(q.charged, currency)} billed yearly` : "Billed monthly"}
            <br />
            {period === "annual" ? "2 months free" : "Cancel any time"}
            {currency === "usd" ? "" : `, ${currencyInfo(currency).tax.replace("excluding", "excl.")}`}
          </>
        )}
      </p>
    </div>
  );
}

function Limits({ plan, featured }: { plan: Plan; featured: boolean }) {
  const rows: [string, string][] = [
    ["Sites", plan.properties === null ? "Unlimited" : String(plan.properties)],
    ["Pageviews / mo", plan.pageviews === null ? "Custom" : compactNumber(plan.pageviews)],
    ["Seats", plan.seats === null ? "Unlimited" : String(plan.seats)],
    ["Log kept", retentionLabel(plan.logRetentionDays)],
  ];
  return (
    <dl className={`mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] ${featured ? "bg-white/10" : "bg-line"}`}>
      {rows.map(([k, v]) => (
        <div key={k} className={`px-3 py-2.5 ${featured ? "bg-ink" : "bg-surface"}`}>
          <dt className={`text-[11px] ${featured ? "text-white/65" : "text-ink-3"}`}>{k}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Self-serve plan cards (Free, Starter, Growth, Business) plus a full-width Enterprise row.
 * Shared by the home page and /pricing; pass currency and period to reflect the billing controls.
 */
export function PricingPlans({
  headingLevel = "h3",
  currency = "usd",
  period = "monthly",
}: {
  headingLevel?: "h2" | "h3";
  currency?: Currency;
  period?: Period;
}) {
  const Heading = headingLevel;
  const enterprise = PLANS.find((p) => p.id === "enterprise")!;
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line">
      <ul className="grid gap-px md:grid-cols-2 xl:grid-cols-4">
        {SELF_SERVE_PLANS.map((plan) => {
          const featured = plan.id === "growth";
          return (
            <li key={plan.id} className={`relative flex flex-col p-6 lg:p-7 ${featured ? "bg-ink text-white" : "bg-surface"}`}>
              {featured ? <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-brand-on-ink" /> : null}
              <div className="flex items-center justify-between gap-3">
                <Heading className="text-lg font-semibold">{plan.name}</Heading>
                {featured ? (
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">Most teams</span>
                ) : null}
              </div>
              <p className={`mt-2 text-sm leading-snug xl:min-h-[3.95rem] ${featured ? "text-white/75" : "text-ink-2"}`}>{plan.summary}</p>
              <Price plan={plan} currency={currency} period={period} featured={featured} />
              <Link
                href={CTA[plan.id].href}
                className={`btn btn-pill mt-6 w-full ${featured ? "btn-white" : plan.id === "free" ? "btn-ghost" : "btn-ink"}`}
              >
                {CTA[plan.id].label}
              </Link>
              <Limits plan={plan} featured={featured} />
              <ul className={`mt-7 space-y-3 text-sm ${featured ? "text-white/80" : "text-ink-2"}`}>
                {plan.features.slice(1).map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <IconCheck size={16} className={`mt-0.5 shrink-0 ${featured ? "text-brand-on-ink" : "text-ink"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {/* Enterprise: a full-width row, since its price is a conversation */}
      <div className="mt-px flex flex-col gap-6 bg-surface p-6 lg:flex-row lg:items-center lg:gap-10 lg:p-7">
        <div className="lg:w-[30%]">
          <Heading className="text-lg font-semibold">{enterprise.name}</Heading>
          <p className="mt-1.5 text-sm text-ink-2">{enterprise.summary}</p>
        </div>
        <ul className="grid flex-1 gap-x-6 gap-y-2.5 text-sm text-ink-2 sm:grid-cols-2">
          {enterprise.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <IconCheck size={16} className="mt-0.5 shrink-0 text-ink" />
              {f}
            </li>
          ))}
        </ul>
        <Link href={CTA.enterprise.href} className="btn btn-pill btn-ghost shrink-0 lg:w-44">
          {CTA.enterprise.label}
        </Link>
      </div>
    </div>
  );
}
