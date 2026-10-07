import Link from "next/link";
import { notFound } from "next/navigation";
import { MfaBadge, OrgStatusBadge, PlanBadge } from "@/components/admin/badges";
import { REGION_LABEL, fmtDate, fmtDateTime } from "@/components/admin/format";
import { OrgActions } from "@/components/admin/org-actions";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState } from "@/components/app/ui/empty-state";
import { KpiTile } from "@/components/app/ui/kpi-tile";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { canPlatform } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadOrgDetail } from "@/lib/platform/data";
import { planById } from "@/lib/plans";

export const generateMetadata = () => staffMetadata("Organization");

export default async function AdminOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await requireStaff("platform:detail");
  const detail = await loadOrgDetail(orgId);
  if (!detail) notFound();
  const { org, members, sites, invites, audit } = detail;
  const plan = planById(org.plan);

  return (
    <>
      <PageHeader
        title={org.name}
        crumbs={[{ label: "Staff console" }, { label: "Overview", href: "/admin" }, { label: "Organizations", href: "/admin/orgs" }, { label: org.name }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PlanBadge plan={org.plan} />
            <OrgStatusBadge suspended={Boolean(org.suspendedAt)} />
            <span>{org.kind === "personal" ? "Personal workspace" : "Organization"}</span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">{org.id}</span>
          </span>
        }
        actions={
          <OrgActions
            org={{ id: org.id, name: org.name, plan: org.plan, suspended: Boolean(org.suspendedAt), hasStripe: Boolean(org.stripeSubscriptionId) }}
            canPlan={canPlatform(ctx.role, "orgs:plan")}
            canSuspend={canPlatform(ctx.role, "orgs:suspend")}
          />
        }
      />

      {org.suspendedAt ? (
        <div role="status" className="mb-6 rounded-lg border border-rose/30 bg-rose-wash px-5 py-4 text-sm text-rose">
          <p className="font-bold">Suspended since {fmtDateTime(org.suspendedAt)}</p>
          {org.suspendedReason ? <p className="mt-1">Reason shown to members: {org.suspendedReason}</p> : null}
        </div>
      ) : null}

      <section aria-labelledby="org-facts-h" className="panel overflow-hidden">
        <h2 id="org-facts-h" className="sr-only">
          Summary
        </h2>
        <div className="grid grid-cols-2 gap-px bg-line xl:grid-cols-4">
          <KpiTile label="Members" value={String(members.length)} detail={plan.seats === null ? "Unlimited seats" : `${plan.seats} seat${plan.seats === 1 ? "" : "s"} on ${plan.name}`} />
          <KpiTile label="Sites" value={String(sites.length)} detail={`${sites.filter((s) => s.publishedVersion > 0).length} published`} />
          <KpiTile label="Plan" value={plan.name} detail={plan.priceMonthly === null ? "Custom pricing" : `$${plan.priceMonthly} a month list`} />
          <KpiTile label="Created" value={fmtDate(org.createdAt)} detail={REGION_LABEL[org.dataRegion] ?? org.dataRegion} />
        </div>
      </section>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="members-h">
            <h2 id="members-h" className="mb-3 text-lg font-bold">
              Members
            </h2>
            {members.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {members.map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                      {m.user ? (
                        <Link href={`/admin/users/${m.userId}`} className="block truncate text-sm font-bold hover:underline">
                          {m.user.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-bold">Deleted user</span>
                      )}
                      <span className="block truncate text-xs text-ink-3">{m.user?.email ?? m.userId}</span>
                    </div>
                    <Badge tone={m.role === "owner" ? "brand" : "neutral"} className="capitalize">
                      {m.role}
                    </Badge>
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      Two-factor <MfaBadge on={Boolean(m.user?.mfa)} />
                    </span>
                    <span className="w-full text-xs text-ink-3 sm:w-36 sm:text-right">Active {fmtDate(m.user?.lastActiveAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState headingLevel={3} title="No members">
                This organization has no members, so nobody can reach it from the dashboard.
              </EmptyState>
            )}
            {invites.length ? (
              <p className="mt-3 text-sm text-ink-3">
                Pending invites: {invites.map((i) => `${i.email} (${i.role})`).join(", ")}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="sites-h">
            <h2 id="sites-h" className="mb-3 text-lg font-bold">
              Sites
            </h2>
            {sites.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {sites.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <span className="block truncate text-sm font-bold">{s.name}</span>
                      <span className="block truncate text-xs text-ink-3">{s.domain}</span>
                    </div>
                    {s.publishedVersion > 0 ? <Badge tone="released">Live v{s.publishedVersion}</Badge> : <Badge tone="held">Not published</Badge>}
                    <span className="break-all font-mono text-xs text-ink-3">{s.siteKey}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState headingLevel={3} title="No sites yet">
                They haven&apos;t added a website.
              </EmptyState>
            )}
          </section>

          <section aria-labelledby="org-audit-h">
            <h2 id="org-audit-h" className="mb-1 text-lg font-bold">
              Recent activity
            </h2>
            <p className="mb-3 text-sm text-ink-3">The newest {audit.length} events from this organization&apos;s own audit trail.</p>
            {audit.length ? (
              <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
                {audit.map((e) => (
                  <li key={e.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                    <div className="min-w-0">
                      <span className="font-bold">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>
                      <span className="text-ink-3"> · {e.target.label ?? e.target.id}</span>
                      <span className="block truncate text-xs text-ink-3">{e.actorEmail}</span>
                    </div>
                    <time dateTime={e.createdAt} className="text-xs tabular-nums text-ink-3 sm:text-right">
                      {fmtDateTime(e.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState headingLevel={3} title="No activity recorded" />
            )}
          </section>
        </div>

        <aside aria-labelledby="billing-h" className="xl:border-l xl:border-line xl:pl-8">
          <h2 id="billing-h" className="mb-3 text-base font-bold">
            Billing and data
          </h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-ink-3">Stripe customer</dt>
              <dd className="break-all font-mono text-xs">{org.stripeCustomerId ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Stripe subscription</dt>
              <dd className="break-all font-mono text-xs">{org.stripeSubscriptionId ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Data region</dt>
              <dd>{REGION_LABEL[org.dataRegion] ?? org.dataRegion}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Team size</dt>
              <dd>{org.teamSize ?? "Not given"}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Data protection officer</dt>
              <dd>{org.dpo ? `${org.dpo.name} (${org.dpo.email})` : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Requires two-factor</dt>
              <dd>{org.security?.requireMfa ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Retention last ran</dt>
              <dd>{fmtDateTime(org.retentionLastRunAt)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
