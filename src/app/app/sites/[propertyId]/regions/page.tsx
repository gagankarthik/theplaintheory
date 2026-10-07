import type { Metadata } from "next";
import { NoticeSettings } from "@/components/app/regions/notice-settings";
import { RegionsEditor, type RegionStats } from "@/components/app/regions/regions-editor";
import { PageHeader } from "@/components/app/shell/page-header";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { formatInt, formatPct, isoDaysAgo, outcomeOf } from "@/lib/analytics";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { FRAMEWORK_META } from "@/lib/defaults";
import type { Framework } from "@/lib/types";

export const metadata: Metadata = { title: "Regions" };

const ORDER: Framework[] = ["gdpr", "dpdpa", "ccpa", "generic"];
/** frameworks whose law requires opt-in consent */
const OPT_IN_ONLY: Framework[] = ["gdpr", "dpdpa"];

export default async function RegionsPage(props: PageProps<"/app/sites/[propertyId]/regions">) {
  const { propertyId } = await props.params;
  const { property, role, org, store } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const regions = property.config.regions;

  // Banner decisions only, last 30 days: a withdrawal is a receipt but not a choice on the banner.
  const decisions = (await store.listReceipts(property.id, { from: isoDaysAgo(30) })).filter((r) => outcomeOf(r.action));
  const stats = Object.fromEntries(
    ORDER.map((fw) => {
      const rows = decisions.filter((r) => r.framework === fw);
      return [fw, { decisions: rows.length, accepted: rows.filter((r) => r.action === "accept_all").length }];
    }),
  ) as Record<Framework, RegionStats>;
  const accepted = decisions.filter((r) => r.action === "accept_all").length;

  const on = ORDER.filter((fw) => regions[fw].enabled);
  const off = ORDER.filter((fw) => !regions[fw].enabled);
  const optIn = on.filter((fw) => regions[fw].model === "opt-in");
  const unlawful = on.filter((fw) => OPT_IN_ONLY.includes(fw) && regions[fw].model === "opt-out");
  const busiest = [...on].sort((a, b) => stats[b].decisions - stats[a].decisions)[0];

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Regions" }]}
        title="Regions"
        description="Each visitor gets the notice for the law that covers them. We read their country at the edge and store no IP address."
      />
      <StatStrip
        label="Regions at a glance"
        stats={[
          {
            label: "Notices on",
            value: `${on.length} of ${ORDER.length}`,
            note: off.length ? `${off.map((fw) => FRAMEWORK_META[fw].name).join(", ")} visitors get the default` : "Every region has its own notice",
          },
          {
            label: "Opt-in notices",
            value: `${optIn.length} of ${on.length}`,
            note: unlawful.length ? `${unlawful.map((fw) => FRAMEWORK_META[fw].name).join(" and ")} must be opt-in` : "Nothing optional runs before consent",
            tone: unlawful.length ? "bad" : undefined,
          },
          {
            href: `/app/sites/${property.id}/logs`,
            label: "Decisions, last 30 days",
            value: decisions.length ? formatInt(decisions.length) : "—",
            note: decisions.length && busiest ? `Most from ${FRAMEWORK_META[busiest].name} (${formatPct(stats[busiest].decisions / decisions.length)})` : "Starts when your banner is live",
          },
          {
            label: "Opt-in rate, last 30 days",
            value: decisions.length ? formatPct(accepted / decisions.length) : "—",
            note: decisions.length ? "Accepted all, every region" : "No decisions yet",
          },
        ]}
      />
      <RegionsEditor key={property.config.version} propertyId={property.id} initial={regions} stats={stats} canWrite={canWrite} />
      <div className="mt-12 border-t border-line pt-10">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">Notice details</h2>
        <NoticeSettings key={`n-${property.config.version}`} propertyId={property.id} config={property.config} dpoEmail={org.dpo?.email} canWrite={canWrite} />
      </div>
    </>
  );
}
