import { fmtInt, fmtUsd } from "@/components/admin/format";
import { PlanMix, SignupsChart } from "@/components/admin/overview-charts";
import { RecentSignupsTable } from "@/components/admin/recent-signups";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { IconTeam } from "@/components/icons";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadOverview } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("Overview");

export default async function AdminOverviewPage() {
  await requireStaff("platform:metrics");
  const o = await loadOverview();
  const t = o.totals;
  const free = o.planMix.find((p) => p.plan === "free")?.orgs ?? 0;

  return (
    <>
      <PageHeader live={30_000} title="Platform overview" description="Every customer organization, user and site on Plain Theory, live from the data store." />

      <h2 className="eyebrow mb-2">Customers</h2>
      <StatStrip
        label="Customer figures"
        className="mb-4"
        stats={[
          { label: "Organizations", value: fmtInt(t.orgs), note: `${fmtInt(t.orgs30)} new in 30 days${t.suspended ? `, ${fmtInt(t.suspended)} suspended` : ""}`, href: "/admin/orgs" },
          { label: "Users", value: fmtInt(t.users), note: "Accounts across all organizations", href: "/admin/users" },
          { label: "Sites", value: fmtInt(t.sites), note: `${fmtInt(t.liveSites)} with a published banner` },
          { label: "Signups, 30 days", value: fmtInt(t.signups30), note: "New user accounts" },
        ]}
      />
      <h2 className="eyebrow mb-2">Revenue and usage</h2>
      <StatStrip
        label="Revenue and usage figures"
        stats={[
          { label: "Estimated MRR", value: fmtUsd(o.mrr.usd), note: `List prices, USD${o.mrr.custom ? `, plus ${o.mrr.custom} enterprise (custom)` : ""}` },
          { label: "Paid organizations", value: fmtInt(t.paidOrgs), note: t.orgs ? `${Math.round((t.paidOrgs / t.orgs) * 100)}% of organizations` : "No organizations yet" },
          { label: "Free organizations", value: fmtInt(free), note: "Upgrade candidates" },
          { label: "Consent decisions, 30 days", value: fmtInt(t.decisions30), note: "Banner views that got a choice" },
        ]}
      />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SignupsChart data={o.signups} />
        <PlanMix mix={o.planMix} total={t.orgs} />
      </div>

      <section aria-labelledby="recent-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-h" className="text-base font-semibold">
            Recent signups
          </h2>
          <ButtonLink href="/admin/users" variant="secondary" size="sm">
            All users
          </ButtonLink>
        </div>
        {o.recent.length ? (
          <RecentSignupsTable users={o.recent} />
        ) : (
          <EmptyState icon={<IconTeam size={22} />} title="No users yet">
            New accounts appear here as soon as someone signs up.
          </EmptyState>
        )}
      </section>
    </>
  );
}
