import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip, type Stat } from "@/components/app/ui/stat-strip";
import { relativeTime, utcShort } from "@/components/app/logs/receipt-labels";
import { WebhooksManager } from "@/components/app/webhooks/webhooks-manager";
import { IconLock } from "@/components/icons";
import { formatInt, formatPct, isoDaysAgo } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { planById } from "@/lib/plans";

export const metadata: Metadata = { title: "Webhooks" };

/** deliveries listed in the table */
const SHOWN = 50;
/** deliveries read for the 7-day numbers; the log keeps 30 days */
const SCAN = 2_000;

export default async function WebhooksPage(props: PageProps<"/app/sites/[propertyId]/webhooks">) {
  const { propertyId } = await props.params;
  const { property, org, role, store } = await requireProperty(propertyId);
  const plan = planById(org.plan);
  const description = "Tell your CRM, CDP and warehouse when consent changes, so a withdrawal is honoured everywhere.";

  if (!plan.limits.webhooks) {
    return (
      <>
        <PageHeader title="Webhooks" description={description} />
        <EmptyState
          icon={<IconLock size={24} />}
          title="Available on Business and above"
          action={
            <ButtonLink href="/app/billing" variant="primary">
              See plans
            </ButtonLink>
          }
        >
          {org.name} is on the {plan.name} plan. DPDPA expects withdrawal to stop processing; webhooks carry that signal to every system that holds the data.
        </EmptyState>
      </>
    );
  }

  const recent = await store.listWebhookDeliveries(property.id, SCAN);
  // Secrets never leave the server after creation.
  const webhooks = (property.webhooks ?? []).map(({ id, url, events, active, createdAt }) => ({ id, url, events, active, createdAt }));

  const active = webhooks.filter((w) => w.active);
  const paused = webhooks.length - active.length;
  const since = isoDaysAgo(7);
  const week = recent.filter((d) => d.createdAt >= since);
  const capped = recent.length === SCAN && week.length === recent.length;
  const failed = week.filter((d) => d.status === "failed").length;
  const last = recent[0];
  const endpoints: Stat = {
    label: "Active endpoints",
    value: formatInt(active.length),
    note: !webhooks.length ? "None added yet" : paused ? `${formatInt(paused)} paused` : "None paused",
    tone: webhooks.length && !active.length ? "warn" : undefined,
  };
  const stats: Stat[] = recent.length
    ? [
        endpoints,
        {
          label: "Deliveries, last 7 days",
          value: `${formatInt(week.length)}${capped ? "+" : ""}`,
          note: "Including retries",
        },
        {
          label: "Success rate",
          value: week.length ? formatPct((week.length - failed) / week.length) : "—",
          note: !week.length ? "No deliveries this week" : failed ? `${formatInt(failed)} failed attempt${failed === 1 ? "" : "s"}` : "No failures",
          tone: failed ? "bad" : undefined,
        },
        {
          label: "Last delivery",
          value: relativeTime(last.createdAt),
          note: (
            <time dateTime={last.createdAt} title={utcShort(last.createdAt)}>
              {last.event}, {last.status === "delivered" ? "delivered" : "failed"}
            </time>
          ),
          tone: last.status === "failed" ? "bad" : undefined,
        },
      ]
    : (() => {
        // No delivery records yet: show what is set up to send instead.
        const events = new Set(active.flatMap((w) => w.events));
        const withdrawals = events.has("consent.withdrawn");
        return [
          endpoints,
          {
            label: "Events subscribed",
            value: active.length ? formatInt(events.size) : "—",
            note: !active.length ? "Add an endpoint to choose" : withdrawals ? "Withdrawals included" : "Withdrawals not sent",
            tone: active.length && !withdrawals ? "warn" : undefined,
          },
          {
            label: "Deliveries",
            value: "—",
            note: "None yet",
          },
        ] satisfies Stat[];
      })();

  return (
    <>
      <PageHeader title="Webhooks" description={description} />
      <StatStrip label="Webhooks at a glance" stats={stats} />
      <WebhooksManager propertyId={property.id} webhooks={webhooks} deliveries={recent.slice(0, SHOWN)} canWrite={can(role, "property:write")} />
    </>
  );
}
