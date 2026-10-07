import Link from "next/link";
import { MfaBadge } from "@/components/admin/badges";
import { fmtDate, fmtInt, fmtUsd } from "@/components/admin/format";
import { PlanMix, SignupsChart } from "@/components/admin/overview-charts";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { KpiTile } from "@/components/app/ui/kpi-tile";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadOverview } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("Overview");

export default async function AdminOverviewPage() {
  await requireStaff("platform:metrics");
  const o = await loadOverview();
  const t = o.totals;

  return (
    <>
      <PageHeader title="Platform overview" description="Every customer organization, user and site on The Plain Theory. Figures are live from the data store." />

      <section aria-labelledby="kpi-h" className="panel overflow-hidden">
        <h2 id="kpi-h" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-2 gap-px bg-line xl:grid-cols-4">
          <KpiTile label="Organizations" value={fmtInt(t.orgs)} detail={`${t.orgs30} new in 30 days${t.suspended ? `, ${t.suspended} suspended` : ""}`} />
          <KpiTile label="Users" value={fmtInt(t.users)} detail="Accounts across all organizations" />
          <KpiTile label="Sites" value={fmtInt(t.sites)} detail={`${t.liveSites} with a published banner`} />
          <KpiTile label="Signups, last 30 days" value={fmtInt(t.signups30)} detail="New user accounts" />
          <KpiTile label="Paid organizations" value={fmtInt(t.paidOrgs)} detail={t.orgs ? `${Math.round((t.paidOrgs / t.orgs) * 100)}% of organizations` : "No organizations yet"} />
          <KpiTile label="Estimated MRR" value={fmtUsd(o.mrr.usd)} detail={`List prices, USD${o.mrr.custom ? `, plus ${o.mrr.custom} enterprise (custom)` : ""}`} />
          <KpiTile label="Consent decisions, 30 days" value={fmtInt(t.decisions30)} detail="Banner views that got a choice" />
          <KpiTile label="Free organizations" value={fmtInt(o.planMix.find((p) => p.plan === "free")?.orgs ?? 0)} detail="Upgrade candidates" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SignupsChart data={o.signups} />
        <PlanMix mix={o.planMix} total={t.orgs} />
      </div>

      <section aria-labelledby="recent-h" className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="recent-h" className="text-lg font-bold">
            Recent signups
          </h2>
          <Link href="/admin/users" className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline sm:min-h-0">
            All users
          </Link>
        </div>
        {o.recent.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {o.recent.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 rounded hover:underline">
                  <span className="block truncate text-sm font-bold">{u.name}</span>
                  <span className="block truncate text-xs text-ink-3">{u.email}</span>
                </Link>
                <span className="text-sm text-ink-2">{u.orgs.length ? u.orgs.map((x) => x.name).join(", ") : "No organization yet"}</span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  Two-factor <MfaBadge on={u.mfa} />
                </span>
                <span className="w-28 text-right text-sm tabular-nums text-ink-2">{fmtDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No users yet">New accounts appear here as soon as someone signs up.</EmptyState>
        )}
      </section>
    </>
  );
}
