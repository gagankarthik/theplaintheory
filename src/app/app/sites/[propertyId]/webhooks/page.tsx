import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { WebhooksManager } from "@/components/app/webhooks/webhooks-manager";
import { IconLock } from "@/components/icons";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { planById } from "@/lib/plans";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage(props: PageProps<"/app/sites/[propertyId]/webhooks">) {
  const { propertyId } = await props.params;
  const { property, org, role, store } = await requireProperty(propertyId);
  const plan = planById(org.plan);
  const description = "Tell your CRM, CDP and data warehouse when consent changes, so withdrawal is honoured everywhere, not just on the website.";

  if (!plan.limits.webhooks) {
    return (
      <>
        <PageHeader title="Webhooks" description={description} />
        <EmptyState
          icon={<IconLock size={28} />}
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

  const deliveries = await store.listWebhookDeliveries(property.id, 50);
  // Secrets never leave the server after creation.
  const webhooks = (property.webhooks ?? []).map(({ id, url, events, active, createdAt }) => ({ id, url, events, active, createdAt }));
  return (
    <>
      <PageHeader title="Webhooks" description={description} />
      <WebhooksManager propertyId={property.id} webhooks={webhooks} deliveries={deliveries} canWrite={can(role, "property:write")} />
    </>
  );
}
