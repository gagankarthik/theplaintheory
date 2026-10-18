import { fmtInt, fmtUsd } from "@/components/admin/format";
import { PlanMix, SignupsChart } from "@/components/admin/overview-charts";
import { RecentSignupsTable } from "@/components/admin/recent-signups";
import { RequestsTable } from "@/components/admin/requests-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { ButtonLink } from "@/components/app/ui/button";
import { EmptyState } from "@/components/app/ui/empty-state";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { IconMail, IconTeam } from "@/components/icons";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadOverview } from "@/lib/platform/data";
import { leadMetrics, shortDuration } from "@/lib/platform/lead-metrics";
import { canPlatform } from "@/lib/auth/platform";
import { getStore } from "@/lib/store";

export const generateMetadata = () => staffMetadata("Overview");

export default async function AdminOverviewPage() {
  const { role } = await requireStaff("platform:metrics");
  const canLeads = canPlatform(role, "leads:read");
  const [o, leads] = await Promise.all([loadOverview(), canLeads ? getStore().then((s) => s.listLeads({ limit: 5000 })) : Promise.resolve(null)]);
  const lm = leads ? leadMetrics(leads) : null;
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

      {lm ? (
        <>
          <h2 className="eyebrow mb-2">Contact requests</h2>
          <StatStrip
            label="Contact request figures"
            stats={[
              { label: "New, unanswered", value: fmtInt(lm.unanswered), tone: lm.unanswered ? "warn" : undefined, note: lm.oldestWaitingMs === null ? "Inbox zero" : `Oldest waiting ${shortDuration(lm.oldestWaitingMs)}`, href: "/admin/requests?status=new" },
              { label: "Urgent or high support", value: fmtInt(lm.urgentOpen), tone: lm.urgentOpen ? "bad" : undefined, note: "Not yet closed", href: "/admin/requests?topic=support" },
              { label: "Requests, 30 days", value: fmtInt(lm.last30), note: `${fmtInt(lm.topics.find((t) => t.topic === "sales")?.last30 ?? 0)} sales, ${fmtInt(lm.topics.find((t) => t.topic === "enterprise")?.last30 ?? 0)} enterprise` },
              { label: "Median time to close", value: lm.medianCloseMs === null ? "None yet" : shortDuration(lm.medianCloseMs), note: "All metrics on Contact requests", href: "/admin/requests" },
            ]}
          />
        </>
      ) : null}

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SignupsChart data={o.signups} />
        <PlanMix mix={o.planMix} total={t.orgs} />
      </div>

      {leads ? (
        <section aria-labelledby="recent-req-h" className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-req-h" className="text-base font-semibold">
              Recent contact requests
            </h2>
            <ButtonLink href="/admin/requests" variant="secondary" size="sm">
              All contact requests
            </ButtonLink>
          </div>
          {leads.length ? (
            <RequestsTable leads={leads.slice(0, 8)} />
          ) : (
            <EmptyState icon={<IconMail size={22} />} title="No contact requests yet">
              Submissions from the contact page appear here as soon as they&apos;re sent.
            </EmptyState>
          )}
        </section>
      ) : null}

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
