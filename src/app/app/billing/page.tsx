import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { PlanPicker } from "@/components/app/billing/plan-picker";
import { buttonClass } from "@/components/app/ui/button";
import { formatInt } from "@/lib/analytics";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { billingConfigured, getStripe, priceIdFor } from "@/lib/billing";
import { PLANS, SELF_SERVE_PLANS, planById } from "@/lib/plans";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Billing" };

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && used > limit;
  const near = limit !== null && !over && pct >= 80;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span id={`m-${label}`} className="font-bold">
          {label}
        </span>
        <span className="tabular-nums text-ink-2">
          {formatInt(used)} {limit === null ? "(unlimited)" : `of ${formatInt(limit)}`}
        </span>
      </div>
      {limit !== null ? (
        <div
          role="progressbar"
          aria-labelledby={`m-${label}`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-valuetext={`${formatInt(used)} of ${formatInt(limit)}${over ? ", over the limit" : ""}`}
          className="h-2 rounded-full bg-line"
        >
          <div className={`h-full rounded-full ${over ? "bg-rose" : near ? "bg-amber" : "bg-ink-2"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
      ) : null}
      {over ? (
        <p className="mt-1.5 text-xs font-bold text-amber">Over the limit. Everything keeps working; you have 30 days to upgrade or come back under. Nothing is charged automatically.</p>
      ) : null}
      {near ? <p className="mt-1.5 text-xs text-amber">Over 80% used this month.</p> : null}
    </div>
  );
}

export default async function BillingPage(props: PageProps<"/app/billing">) {
  const sp = await props.searchParams;
  const { org, role } = await requireUser();
  const store = await getStore();
  const plan = planById(org.plan);
  const properties = await store.listProperties(org.id);
  const now = new Date();
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  const today = now.toISOString().slice(0, 10);
  const counters = (await Promise.all(properties.map((p) => store.listCounters(p.id, monthStart, today)))).flat();
  const views = counters.reduce((s, c) => s + c.views, 0);
  const members = await store.listMembers(org.id);
  const canBill = can(role, "billing:manage");
  const configured = billingConfigured();

  const notice =
    sp.checkout === "success"
      ? { tone: "ok", text: "Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds." }
      : sp.checkout === "cancelled"
        ? { tone: "info", text: "Checkout was cancelled. Nothing was charged." }
        : sp.error === "not-configured"
          ? { tone: "error", text: "Billing isn't connected. Set STRIPE_SECRET_KEY and the STRIPE_PRICE_* variables, then restart the app." }
          : sp.error === "no-customer"
            ? { tone: "error", text: "There's no Stripe customer for this organization yet. Upgrade first to create one." }
            : null;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, this month's usage and invoices."
        actions={
          canBill && org.stripeCustomerId && getStripe() ? (
            <form action="/api/stripe/portal" method="post">
              <button className={buttonClass("ghost")}>Invoices and payment</button>
            </form>
          ) : null
        }
      />

      {notice ? (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`mb-6 rounded-md px-4 py-3 text-sm ${notice.tone === "error" ? "bg-rose-wash text-rose" : notice.tone === "ok" ? "bg-jade-wash text-jade" : "bg-line text-ink-2"}`}>
          {notice.text}
        </p>
      ) : null}
      {!configured && canBill ? (
        <p className="mb-6 rounded-md border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2">
          Billing isn&apos;t connected in this environment. Set <code className="font-mono">STRIPE_SECRET_KEY</code>,{" "}
          <code className="font-mono">STRIPE_PRICE_STARTER</code>, <code className="font-mono">STRIPE_PRICE_GROWTH</code>, <code className="font-mono">STRIPE_PRICE_BUSINESS</code> (and{" "}
          <code className="font-mono">_ANNUAL</code> variants) plus <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> to turn on upgrades.
        </p>
      ) : null}

      <section aria-labelledby="usage-h" className="mb-10 grid gap-8 border-b border-line pb-10 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
        <div>
          <h2 id="usage-h" className="text-lg font-bold">
            {plan.name} plan
          </h2>
          <p className="mt-1 text-sm text-ink-3">{plan.summary}</p>
          <p className="mt-3 text-sm text-ink-2">Usage resets on the 1st of each month (UTC).</p>
          <p className="mt-3 text-sm text-ink-2">Going over never charges you automatically. We&apos;ll email you and give you 30 days.</p>
        </div>
        <div className="max-w-xl space-y-6">
          <Meter label="Banner views this month" used={views} limit={plan.pageviews} />
          <Meter label="Sites" used={properties.length} limit={plan.properties} />
          <Meter label="Team seats" used={members.length} limit={plan.seats} />
        </div>
      </section>

      <section aria-labelledby="plans-h">
        <PlanPicker
          plans={SELF_SERVE_PLANS}
          current={org.plan}
          canBill={canBill}
          hasCustomer={Boolean(org.stripeCustomerId && getStripe())}
          purchasable={Object.fromEntries(
            PLANS.map((p) => [p.id, { monthly: configured && Boolean(priceIdFor(p, "monthly")), annual: configured && Boolean(priceIdFor(p, "annual")) }]),
          )}
        />
        <div className="mt-6 flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold">Enterprise{org.plan === "enterprise" ? " (current plan)" : ""}</h3>
            <p className="mt-1 max-w-[70ch] text-sm text-ink-3">{planById("enterprise").summary} Custom volume, dedicated residency, SSO and a 99.99% delivery SLA.</p>
          </div>
          <a className={buttonClass("ghost", "md", "shrink-0")} href={`/contact-sales?org=${encodeURIComponent(org.name)}`}>
            Talk to sales
          </a>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Cancel or downgrade any time from Invoices and payment. You keep your plan until the end of the period, and you can export every consent receipt before and after.
        </p>
      </section>
    </>
  );
}
