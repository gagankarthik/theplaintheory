import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/shell/page-header";
import { PlanPicker } from "@/components/app/billing/plan-picker";
import { Alert, type AlertTone } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Button, ButtonAnchor, ButtonLink } from "@/components/app/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/app/ui/card";
import { DateText } from "@/components/app/ui/date-text";
import { DescriptionList } from "@/components/app/ui/description-list";
import { EmptyState } from "@/components/app/ui/empty-state";
import { ResourceList } from "@/components/app/ui/resource-list";
import { IconAlert, IconBilling, IconDownload, IconExternal } from "@/components/icons";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { billingConfigured, getStripe } from "@/lib/billing";
import { getBillingSummary, type BillingSummary } from "@/lib/billing-summary";
import { formatMoney, formatNumber } from "@/lib/format";
import { getCatalog, getLivePlans } from "@/lib/stripe-catalog";
import { PLANS, SELF_SERVE_PLANS, planById, type Plan } from "@/lib/plans";
import { activeGrace } from "@/lib/retention-grace";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Billing" };

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
          <span className="font-semibold text-ink">{formatNumber(used)}</span>
          <span className="text-ink-3"> {limit === null ? "· unlimited" : `of ${formatNumber(limit)}`}</span>
        </span>
      </div>
      {limit !== null ? (
        <div
          role="progressbar"
          aria-labelledby={id}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          aria-valuetext={`${formatNumber(used)} of ${formatNumber(limit)}${over ? ", over the limit" : full ? ", all in use" : ""}`}
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
  if (s.cancelAtPeriodEnd)
    return (
      <Badge tone="warning">
        {s.periodEnd ? (
          <>
            Cancels <DateText iso={s.periodEnd} />
          </>
        ) : (
          "Cancels at period end"
        )}
      </Badge>
    );
  if (s.status === "active") return <Badge tone="success">Active</Badge>;
  if (s.status === "trialing") return <Badge tone="info">Trial</Badge>;
  if (s.status === "past_due" || s.status === "unpaid") return <Badge tone="danger">Payment failed</Badge>;
  return <Badge tone="neutral">{s.status.replace("_", " ")}</Badge>;
}

function CurrentPlan({ plan, summary, canBill, hasPortal }: { plan: Plan; summary: BillingSummary | null; canBill: boolean; hasPortal: boolean }) {
  const sub = summary?.subscription;
  const paid = plan.id !== "free";
  return (
    <Card aria-labelledby="plan-h" className="flex flex-col">
      <CardHeader titleId="plan-h" title="Current plan" actions={sub ? statusBadge(sub) : !paid ? <Badge tone="neutral">Free forever</Badge> : null} />
      <CardBody className="flex-1">
        <p className="text-xl font-semibold tracking-tight text-ink">{plan.name}</p>
        <p className="mt-1 max-w-prose text-sm text-ink-3">{plan.summary}</p>

        <DescriptionList
          className="mt-5"
          items={[
            {
              label: "Price",
              value:
                sub?.amount != null ? (
                  <>
                    {formatMoney(sub.amount, sub.currency)}
                    <span className="font-normal text-ink-3"> / {sub.interval === "year" ? "year" : "month"}</span>
                  </>
                ) : paid ? (
                  "—"
                ) : (
                  "Free"
                ),
            },
            { label: sub?.cancelAtPeriodEnd ? "Access until" : "Next payment", value: sub?.periodEnd ? <DateText iso={sub.periodEnd} /> : null },
            {
              label: "Payment method",
              value: summary?.card ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconBilling size={16} aria-hidden className="text-ink-3" />
                  <span className="capitalize">{summary.card.brand}</span> •••• {summary.card.last4}
                </span>
              ) : null,
            },
          ]}
        />

        {sub && (sub.status === "past_due" || sub.status === "unpaid") ? (
          <Alert tone="danger" className="mt-5">
            The last payment didn&apos;t go through. Update the card in the billing portal to keep your plan.
          </Alert>
        ) : null}
      </CardBody>

      <CardFooter align="start">
        {canBill ? (
          <>
            <ButtonAnchor href="#plans" size="sm">
              {paid ? "Change plan" : "See plans"}
            </ButtonAnchor>
            {hasPortal ? (
              <form action="/api/stripe/portal" method="post">
                <Button type="submit" variant="ghost" size="sm">
                  Manage payment and invoices
                  <IconExternal size={14} aria-hidden />
                </Button>
              </form>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-ink-3">Only owners can change the plan or payment details.</p>
        )}
      </CardFooter>
    </Card>
  );
}

function Invoices({ invoices }: { invoices: BillingSummary["invoices"] }) {
  return (
    <ResourceList
      title="Invoices"
      titleId="inv-h"
      label="Invoices, newest first"
      empty={
        <EmptyState bare headingLevel={3} title="No invoices yet">
          They appear here after your first payment.
        </EmptyState>
      }
      rows={invoices.map((i) => ({
        id: i.id,
        leading: <DateText iso={i.date} className="block w-28 tabular-nums" />,
        title: <span className="tabular-nums">{formatMoney(i.amount, i.currency)}</span>,
        meta: <span className="font-mono">{i.number ?? "Draft"}</span>,
        trailing: (
          <>
            {i.status === "paid" ? (
              <Badge tone="success">Paid</Badge>
            ) : i.status === "open" ? (
              <Badge tone="warning">Due</Badge>
            ) : (
              <Badge tone="neutral">
                <span className="capitalize">{i.status ?? "Unknown"}</span>
              </Badge>
            )}
            {i.pdf ? (
              <ButtonAnchor href={i.pdf} variant="quiet" size="sm" rel="noopener noreferrer">
                <IconDownload size={14} aria-hidden /> PDF<span className="sr-only"> of invoice {i.number}</span>
              </ButtonAnchor>
            ) : null}
          </>
        ),
      }))}
    />
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

  const notice: { tone: AlertTone; text: string } | null =
    sp.checkout === "success"
      ? { tone: "success", text: "Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds." }
      : sp.checkout === "cancelled"
        ? { tone: "info", text: "Checkout was cancelled. Nothing was charged." }
        : sp.error === "not-configured"
          ? { tone: "danger", text: "Payments aren't available right now. Please try again shortly, or contact support." }
          : sp.error === "no-customer"
            ? { tone: "danger", text: "There's no billing account for this organization yet. Choose a plan below to create one." }
            : null;
  const devNote = !configured && canBill && process.env.NODE_ENV !== "production";

  return (
    <>
      <PageHeader title="Billing" description={`Plan, usage and invoices for ${org.name}.`} />

      {notice || grace || devNote ? (
        <div className="mb-6 space-y-3">
          {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
          {grace ? (
            <Alert tone="info">
              Your records from the {planById(grace.fromPlan).name} plan stay available until <DateText iso={grace.until} />. Export them before then, or upgrade to keep them.
            </Alert>
          ) : null}
          {devNote ? (
            <Alert tone="info" title="Development: Stripe isn't connected">
              Set <code className="font-mono">STRIPE_SECRET_KEY</code> and run <code className="font-mono">npm run stripe:sync</code>.
            </Alert>
          ) : null}
        </div>
      ) : null}

      {/* 1. What you're on, and what you've used */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <CurrentPlan plan={plan} summary={summary} canBill={canBill} hasPortal={hasPortal && canBill} />

        <Card aria-labelledby="usage-h" className="flex flex-col">
          <CardHeader
            titleId="usage-h"
            title="Usage"
            actions={
              <p className="text-xs text-ink-3">
                Views reset <DateText iso={nextReset} />
              </p>
            }
          />
          <CardBody className="flex-1 space-y-5">
            <Meter label="Banner views this month" used={views} limit={plan.pageviews} />
            <Meter label="Sites" used={properties.length} limit={plan.properties} href="/app" />
            <Meter label="Team seats" used={members.length} limit={plan.seats} href="/app/team" />
          </CardBody>
          <CardFooter align="start">
            <p className="text-xs text-ink-3">Going over never charges you automatically. Everything keeps working for 30 days while you decide.</p>
          </CardFooter>
        </Card>
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
        <Card as="div" className="mt-4">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">Enterprise{org.plan === "enterprise" ? " (your plan)" : ""}.</span> Custom volume, EU or US data residency, SSO on request and an uptime SLA in your contract.
            </p>
            <ButtonLink variant="ghost" size="sm" className="shrink-0" href={`/contact-sales?org=${encodeURIComponent(org.name)}`}>
              Talk to sales
            </ButtonLink>
          </CardBody>
        </Card>
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
