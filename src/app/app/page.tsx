import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { AddSite } from "@/components/app/sites/add-site";
import { SitesTable } from "@/components/app/sites/sites-table";
import { EmptyState } from "@/components/app/ui/empty-state";
import { IconSites } from "@/components/icons";
import { daysAgoIso, outcomeOf } from "@/lib/analytics";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { planById } from "@/lib/plans";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const { org, role } = await requireUser();
  const store = await getStore();
  const properties = await store.listProperties(org.id);
  const since = daysAgoIso(30);
  const rows = await Promise.all(
    properties.map(async (p) => {
      const decisions = (await store.listReceipts(p.id, { from: since })).filter((r) => outcomeOf(r.action));
      const accepted = decisions.filter((r) => r.action === "accept_all").length;
      return {
        id: p.id,
        name: p.name,
        domain: p.domain,
        dirty: p.config.version !== p.publishedVersion,
        published: p.publishedVersion > 0,
        trackers: p.trackers.length,
        decisions: decisions.length,
        optIn: decisions.length ? accepted / decisions.length : null,
      };
    }),
  );
  const plan = planById(org.plan);
  const atLimit = plan.properties !== null && properties.length >= plan.properties;
  const addSite = can(role, "property:write") ? <AddSite atLimit={atLimit} planName={plan.name} limit={plan.properties} /> : null;

  return (
    <>
      <PageHeader title="Sites" description={`Every website in ${org.name}. Each has its own banner, trackers and consent log.`} actions={rows.length ? addSite : null} />
      {rows.length === 0 ? (
        <EmptyState icon={<IconSites size={28} />} title="Add your first site" action={addSite}>
          You&apos;ll get a script tag to paste into your site. Trackers stay held until visitors choose.
        </EmptyState>
      ) : (
        <SitesTable
          rows={rows}
          footer={plan.properties === null ? `${rows.length} sites` : `${rows.length} of ${plan.properties} sites on the ${plan.name} plan`}
        />
      )}
    </>
  );
}
