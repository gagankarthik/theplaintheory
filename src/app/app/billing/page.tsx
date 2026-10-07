import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/shell/page-header";
import { PlanPicker } from "@/components/app/billing/plan-picker";
import { Badge } from "@/components/app/ui/badge";
import { buttonClass } from "@/components/app/ui/button";
import { IconAlert, IconBilling, IconCheck, IconDownload, IconExternal, IconInfo } from "@/components/icons";
import { formatInt } from "@/lib/analytics";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { billingConfigured, getStripe } from "@/lib/billing";
import { formatMoney, getBillingSummary, type BillingSummary } from "@/lib/billing-summary";
import { getCatalog, getLivePlans } from "@/lib/stripe-catalog";
import { PLANS, SELF_SERVE_PLANS, planById, type Plan } from "@/lib/plans";
import { activeGrace } from "@/lib/retention-grace";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Billing" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One usage line: what's used against the plan's limit, with the state in words as well as colour. */
function Meter({ label, used, limit, href }: { label: string; used: number; limit: number | null; href?: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && used > limit;
  const full = limit !== null && !over && used >= limit;
  const near = limit !== null && !over && !full && pct >= 80;
  const id = `m-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={id} className="text-sm text-ink-2">
          {href ? (
            <Link href={href} className="underline-offset-2 hover:text-ink hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold text-ink">{formatInt(used)}</span>
          <span className="text-ink-3"> {limit === null ? "· unlimited" : `of ${formatInt(limit)}`}</span>
        </span>
      </div>
      {limit !== null ? (
        <div
          role="progressbar"
          aria-labelledby={id}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-valuetext={`${formatInt(used)} of ${formatInt(limit)}${over ? ", over the limit" : full ? ", all in use" : ""}`}
          className="h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-line"
        >
          <div className={`h-full rounded-full ${over ? "bg-rose" : full || near ? "bg-amber-bright" : "bg-brand"}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
      ) : (
        <div aria-hidden className="h-1.5 rounded-full bg-[repeating-linear-gradient(90deg,var(--color-line)_0_6px,transparent_6px_10px)]" />
      )}
      {over ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose">
          <IconAlert size={14} /> Over the limit. Nothing stops; you have 30 days to upgrade or come back under.
        </p>
      ) : full ? (
        <p className="mt-1.5 text-xs text-amber">All in use on your plan.</p>
      ) : near ? (
        <p className="mt-1.5 text-xs text-amber">{Math.round(pct)}% used.</p>
      ) : null}
    </div>
  );
}

function statusBadge(s: NonNullable<BillingSummary["subscription"]>) {
  if (s.cancelAtPeriodEnd) return <Badge tone="held">Cancels {s.periodEnd ? day(s.periodEnd) : "at period end"}</Badge>;
  if (s.status === "active") return <Badge tone="released">Active</Badge>;
  if (s.status === "trialing") return <Badge tone="brand">Trial</Badge>;
  if (s.status === "past_due" || s.status === "unpaid") return <Badge tone="declined">Payment failed</Badge>;
  return <Badge tone="neutral">{s.status.replace("_", " ")}</Badge>;
}

function CurrentPlan({ plan, summary, canBill, hasPortal }: { plan: Plan; summary: BillingSummary | null; canBill: boolean; hasPortal: boolean }) {
  const sub = summary?.subscription;
  const paid = plan.id !== "free";
  return (
    <section aria-labelledby="plan-h" className="flex flex-col rounded-[16px] border border-line bg-surface">
      <div className="flex-1 p-5 sm:p-6">
        <p className="text-xs font-medium text-ink-3">Current plan</p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h2 id="plan-h" className="text-xl font-semibold tracking-[-0.02em]">
            {plan.name}
          </h2>
          {sub ? statusBadge(sub) : !paid ? <Badge tone="neutral">Free forever</Badge> : null}
        </div>
        <p className="mt-1 max-w-[52ch] text-sm text-ink-3">{plan.summary}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-3">Price</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {sub?.amount != null ? (
                <>
                  {formatMoney(sub.amount, sub.currency)}
                  <span className="font-normal text-ink-3"> / {sub.interval === "year" ? "year" : "month"}</span>
                </>
              ) : paid ? (
                "—"
              ) : (
                "$0"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{sub?.cancelAtPeriodEnd ? "Access until" : "Next payment"}</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">{sub?.periodEnd ? day(sub.periodEnd) : <span className="font-normal text-ink-3">None</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Payment method</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {summary?.card ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconBilling size={16} className="text-ink-3" />
                  <span className="capitalize">{summary.card.brand}</span> •••• {summary.card.last4}
                </span>
              ) : (
                <span className="font-normal text-ink-3">None on file</span>
              )}
            </dd>
          </div>
        </dl>

        {sub && (sub.status === "past_due" || sub.status === "unpaid") ? (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-[10px] bg-rose-wash px-3.5 py-2.5 text-sm text-rose">
            <IconAlert size={16} className="mt-0.5 shrink-0" />
            The last payment didn&apos;t go through. Update the card in the billing portal to keep your plan.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 px-5 py-3.5 sm:px-6">
        {canBill ? (
          <>
            <a href="#plans" className={buttonClass(paid ? "ghost" : "primary", "sm")}>
              {paid ? "Change plan" : "Upgrade"}
            </a>
            {hasPortal ? (
              <form action="/api/stripe/portal" method="post">
                <button className={buttonClass("ghost", "sm")}>
                  Manage payment and invoices
                  <IconExternal size={14} />
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-ink-3">Only owners can change the plan or payment details.</p>
        )}
      </div>
    </section>
  );
}

function Invoices({ invoices }: { invoices: BillingSummary["invoices"] }) {
  return (
    <section aria-labelledby="inv-h" className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="inv-h" className="text-base font-semibold">
          Invoices
        </h2>
      </div>
      {invoices.length ? (
        <ul className="divide-y divide-line">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm sm:px-6">
              <span className="w-28 text-ink-2">{day(i.date)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-3">{i.number ?? "Draft"}</span>
              <span className="w-24 text-right font-medium tabular-nums text-ink">{formatMoney(i.amount, i.currency)}</span>
              <span className="w-20">
                {i.status === "paid" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                    <IconCheck size={14} className="text-jade" /> Paid
                  </span>
                ) : i.status === "open" ? (
                  <span className="text-xs font-medium text-amber">Due</span>
                ) : (
                  <span className="text-xs capitalize text-ink-3">{i.status ?? "—"}</span>
                )}
              </span>
              <span className="ml-auto">
                {i.pdf ? (
                  <a href={i.pdf} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-2 hover:bg-paper hover:text-ink" rel="noopener noreferrer">
                    <IconDownload size={14} /> PDF<span className="sr-only"> of invoice {i.number}</span>
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-ink-3 sm:px-6">No invoices yet. They appear here after your first payment.</p>
      )}
    </section>
  );
}

export default async function BillingPage(props: PageProps<"/app/billing">) {
  const sp = await props.searchParams;
  const { org, role } = await requireUser();
  const store = await getStore();
  const plan = planById(org.plan);
  const now = new Date();
  const grace = activeGrace(org, now);
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  const today = now.toISOString().slice(0, 10);
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const [properties, members, configured, [livePlans, catalog], summary] = await Promise.all([
    store.listProperties(org.id),
    store.listMembers(org.id),
    billingConfigured(),
    Promise.all([getLivePlans(), getCatalog()]),
    getBillingSummary(org.stripeCustomerId),
  ]);
  const counters = (await Promise.all(properties.map((p) => store.listCounters(p.id, monthStart, today)))).flat();
  const views = counters.reduce((s, c) => s + c.views, 0);
  const canBill = can(role, "billing:manage");
  const hasPortal = Boolean(org.stripeCustomerId && getStripe());

  const notice =
    sp.checkout === "success"
      ? { tone: "ok", text: "Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds." }
      : sp.checkout === "cancelled"
        ? { tone: "info", text: "Checkout was cancelled. Nothing was charged." }
        : sp.error === "not-configured"
          ? { tone: "error", text: "Payments aren't available right now. Please try again shortly, or contact support." }
          : sp.error === "no-customer"
            ? { tone: "error", text: "There's no billing account for this organization yet. Choose a plan below to create one." }
            : null;

  return (
    <>
      <PageHeader title="Billing" description={`Plan, usage and invoices for ${org.name}.`} />

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-6 flex items-start gap-2 rounded-[12px] border px-4 py-3 text-sm ${
            notice.tone === "error" ? "border-rose/30 bg-rose-wash text-rose" : notice.tone === "ok" ? "border-jade/30 bg-jade-wash text-jade" : "border-line bg-surface text-ink-2"
          }`}
        >
          {notice.tone === "error" ? <IconAlert size={16} className="mt-0.5 shrink-0" /> : notice.tone === "ok" ? <IconCheck size={16} className="mt-0.5 shrink-0" /> : <IconInfo size={16} className="mt-0.5 shrink-0" />}
          {notice.text}
        </p>
      ) : null}
      {grace ? (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          <IconInfo size={16} className="mt-0.5 shrink-0" />
          Your records from the {planById(grace.fromPlan).name} plan stay available until {day(grace.until)}. Export them before then, or upgrade to keep them.
        </p>
      ) : null}
      {!configured && canBill && process.env.NODE_ENV !== "production" ? (
        <p className="mb-6 rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-xs text-ink-3">
          Development: Stripe isn&apos;t connected. Set <code className="font-mono">STRIPE_SECRET_KEY</code> and run <code className="font-mono">npm run stripe:sync</code>.
        </p>
      ) : null}

      {/* 1. What you're on, and what you've used */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <CurrentPlan plan={plan} summary={summary} canBill={canBill} hasPortal={hasPortal && canBill} />

        <section aria-labelledby="usage-h" className="rounded-[16px] border border-line bg-surface p-5 sm:p-6">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 id="usage-h" className="text-base font-semibold">
              Usage
            </h2>
            <p className="text-xs text-ink-3">Views reset {day(nextReset)}</p>
          </div>
          <div className="space-y-5">
            <Meter label="Banner views this month" used={views} limit={plan.pageviews} />
            <Meter label="Sites" used={properties.length} limit={plan.properties} href="/app" />
            <Meter label="Team seats" used={members.length} limit={plan.seats} href="/app/team" />
          </div>
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">Going over never charges you automatically. Everything keeps working for 30 days while you decide.</p>
        </section>
      </div>

      {/* 2. Invoices, once there's a billing account */}
      {summary ? (
        <div className="mt-6">
          <Invoices invoices={summary.invoices} />
        </div>
      ) : null}

      {/* 3. Plans */}
      <section id="plans" aria-labelledby="plans-h" className="mt-12 scroll-mt-20">
        <PlanPicker
          plans={livePlans.filter((p) => SELF_SERVE_PLANS.some((s) => s.id === p.id))}
          current={org.plan}
          canBill={canBill}
          hasCustomer={hasPortal}
          purchasable={Object.fromEntries(PLANS.map((p) => [p.id, { monthly: Boolean(catalog?.[p.id]?.priceId.monthly), annual: Boolean(catalog?.[p.id]?.priceId.annual) }]))}
        />
        <div className="mt-4 flex flex-col gap-3 rounded-[16px] border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">Enterprise{org.plan === "enterprise" ? " (your plan)" : ""}.</span> Custom volume, dedicated data residency, SSO and a 99.99% delivery SLA.
          </p>
          <a className={buttonClass("ghost", "sm", "shrink-0")} href={`/contact-sales?org=${encodeURIComponent(org.name)}`}>
            Talk to sales
          </a>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Cancel or downgrade any time from the billing portal. You keep your plan until the end of the period, and every consent receipt stays exportable.{" "}
          <Link href="/pricing#compare" className="font-medium text-brand underline-offset-2 hover:underline">
            Compare every feature
          </Link>
        </p>
      </section>
    </>
  );
}
