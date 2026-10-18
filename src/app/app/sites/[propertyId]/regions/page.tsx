import type { Metadata } from "next";
import { LearnMore } from "@/components/app/configure/learn-more";
import { NoticeSettings } from "@/components/app/regions/notice-settings";
import { RegionsEditor, type RegionStats } from "@/components/app/regions/regions-editor";
import { PageHeader } from "@/components/app/shell/page-header";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { formatInt, formatPct, rangeDays } from "@/lib/analytics";
import { loadRollups } from "@/lib/rollup-load";
import { mergeRollups } from "@/lib/rollups";
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

  // Banner decisions only, last 30 days, from the daily rollups (a withdrawal isn't a banner choice).
  const days = rangeDays(30);
  const [total] = mergeRollups((await loadRollups(store, property.id, days[0], days[days.length - 1])).map((r) => ({ ...r, day: "all" })));
  const byFramework = total?.dims.framework ?? {};
  const stats = Object.fromEntries(
    ORDER.map((fw) => {
      const c = byFramework[fw] ?? { accepted: 0, partial: 0, rejected: 0 };
      return [fw, { decisions: c.accepted + c.partial + c.rejected, accepted: c.accepted }];
    }),
  ) as Record<Framework, RegionStats>;
  const accepted = total?.accepted ?? 0;
  const decided = total ? total.accepted + total.partial + total.rejected : 0;

  const on = ORDER.filter((fw) => regions[fw].enabled);
  const off = ORDER.filter((fw) => !regions[fw].enabled);
  const optIn = on.filter((fw) => regions[fw].model === "opt-in");
  const unlawful = on.filter((fw) => OPT_IN_ONLY.includes(fw) && regions[fw].model === "opt-out");
  const busiest = [...on].sort((a, b) => stats[b].decisions - stats[a].decisions)[0];

  return (
    <>
      <PageHeader
        title="Regions"
        description={
          <>
            Each visitor gets the notice for the law that covers them. <LearnMore anchor="regions" topic="regions" />
          </>
        }
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
            value: decided ? formatInt(decided) : "—",
            note: decided && busiest ? `Most from ${FRAMEWORK_META[busiest].name} (${formatPct(stats[busiest].decisions / decided)})` : "Starts when your banner is live",
          },
          {
            label: "Opt-in rate, last 30 days",
            value: decided ? formatPct(accepted / decided) : "—",
            note: decided ? "Accepted all, every region" : "No decisions yet",
          },
        ]}
      />
      <RegionsEditor key={property.config.version} propertyId={property.id} initial={regions} stats={stats} canWrite={canWrite} />
      <NoticeSettings key={`n-${property.config.version}`} propertyId={property.id} config={property.config} dpoEmail={org.dpo?.email} canWrite={canWrite} />
    </>
  );
}
