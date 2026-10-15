import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberRoleBadge, MfaBadge, OrgStatusBadge, PlanBadge } from "@/components/admin/badges";
import { REGION_LABEL, fmtDate, fmtDateTime, fmtInt } from "@/components/admin/format";
import { OrgPlanAction, OrgRiskActions } from "@/components/admin/org-actions";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { CopyButton } from "@/components/app/ui/copy-button";
import { DescriptionList } from "@/components/app/ui/description-list";
import { EmptyState } from "@/components/app/ui/empty-state";
import { ResourceList } from "@/components/app/ui/resource-list";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { canPlatform } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadOrgDetail } from "@/lib/platform/data";
import { planById } from "@/lib/plans";
import { activeGrace } from "@/lib/retention-grace";

export const generateMetadata = () => staffMetadata("Organization");

const mono = (v: string | null | undefined) => (v ? <span className="break-all font-mono text-xs">{v}</span> : null);

export default async function AdminOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await requireStaff("platform:detail");
  const detail = await loadOrgDetail(orgId);
  if (!detail) notFound();
  const { org, members, sites, invites, audit } = detail;
  const plan = planById(org.plan);
  const grace = activeGrace(org);
  const ref = { id: org.id, name: org.name, plan: org.plan, suspended: Boolean(org.suspendedAt), hasStripe: Boolean(org.stripeSubscriptionId), legalHold: Boolean(org.legalHold) };
  const published = sites.filter((s) => s.publishedVersion > 0).length;

  return (
    <>
      <PageHeader
        title={org.name}
        crumbs={[{ label: "Staff console" }, { label: "Overview", href: "/admin" }, { label: "Organizations", href: "/admin/orgs" }, { label: org.name }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PlanBadge plan={org.plan} />
            <OrgStatusBadge suspended={Boolean(org.suspendedAt)} />
            {org.legalHold ? <Badge tone="warning">Legal hold</Badge> : null}
            <span>{org.kind === "personal" ? "Personal organization" : "Company or agency"}</span>
          </span>
        }
        actions={canPlatform(ctx.role, "orgs:plan") ? <OrgPlanAction org={ref} /> : null}
      />

      {org.suspendedAt ? (
        <Alert tone="danger" title={`Suspended since ${fmtDateTime(org.suspendedAt)}`} className="mb-6">
          {org.suspendedReason ? <>Reason shown to members: {org.suspendedReason}</> : "No reason was recorded."}
        </Alert>
      ) : null}

      <StatStrip
        label="Organization summary"
        stats={[
          { label: "Members", value: fmtInt(members.length), note: plan.seats === null ? "Unlimited seats" : `${plan.seats} seat${plan.seats === 1 ? "" : "s"} on ${plan.name}` },
          { label: "Sites", value: fmtInt(sites.length), note: `${published} published` },
          { label: "Plan", value: plan.name, note: plan.priceMonthly === null ? "Custom pricing" : `$${plan.priceMonthly} a month list` },
          { label: "Created", value: fmtDate(org.createdAt), note: REGION_LABEL[org.dataRegion] ?? org.dataRegion },
        ]}
      />

      <Card aria-labelledby="org-details-h" className="mb-6">
        <CardHeader titleId="org-details-h" title="Account details" description="Billing, data residency and compliance settings." />
        <CardBody>
          <DescriptionList
            columns={3}
            items={[
              {
                label: "Organization ID",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    {mono(org.id)}
                    <CopyButton value={org.id} label="Copy ID" />
                  </span>
                ),
              },
              { label: "Data region", value: REGION_LABEL[org.dataRegion] ?? org.dataRegion },
              { label: "Team size", value: org.teamSize ?? "Not given" },
              { label: "Stripe customer", value: mono(org.stripeCustomerId) },
              { label: "Stripe subscription", value: mono(org.stripeSubscriptionId) },
              { label: "Requires two-factor", value: org.security?.requireMfa ? "Yes" : "No" },
              { label: "Data protection officer", value: org.dpo ? `${org.dpo.name} (${org.dpo.email})` : "Not set" },
              { label: "Retention last ran", value: fmtDateTime(org.retentionLastRunAt) },
              {
                label: "Legal hold",
                value: org.legalHold ? `Since ${fmtDate(org.legalHold.since)}, by ${org.legalHold.by}${org.legalHold.reason ? `. ${org.legalHold.reason}` : ""}` : null,
              },
              ...(grace
                ? [{ label: "Retention grace", value: `${planById(grace.fromPlan).name} records (${grace.logRetentionDays.toLocaleString("en-GB")} days) kept until ${fmtDate(grace.until)}` }]
                : []),
            ]}
          />
        </CardBody>
      </Card>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ResourceList
          title="Members"
          titleId="members-h"
          label="Members"
          rows={members.map((m) => ({
            id: m.userId,
            title: m.user ? (
              <Link href={`/admin/users/${m.userId}`} className="underline-offset-4 hover:underline">
                {m.user.name}
              </Link>
            ) : (
              "Deleted user"
            ),
            meta: `${m.user?.email ?? m.userId} · active ${fmtDate(m.user?.lastActiveAt)}`,
            trailing: (
              <>
                <MemberRoleBadge role={m.role} />
                <span className="flex items-center gap-1.5 text-xs text-ink-3">
                  Two-factor <MfaBadge on={Boolean(m.user?.mfa)} />
                </span>
              </>
            ),
          }))}
          empty={
            <EmptyState bare headingLevel={3} title="No members">
              This organization has no members, so nobody can reach it from the dashboard.
            </EmptyState>
          }
          footer={invites.length ? `Pending invites: ${invites.map((i) => `${i.email} (${i.role})`).join(", ")}` : undefined}
        />

        <ResourceList
          title="Sites"
          titleId="sites-h"
          label="Sites"
          rows={sites.map((s) => ({
            id: s.id,
            title: s.name,
            meta: (
              <>
                {s.domain} · <span className="font-mono">{s.siteKey}</span>
              </>
            ),
            trailing: s.publishedVersion > 0 ? <Badge tone="success">Live v{s.publishedVersion}</Badge> : <Badge tone="warning">Not published</Badge>,
          }))}
          empty={
            <EmptyState bare headingLevel={3} title="No sites yet">
              They haven&apos;t added a website.
            </EmptyState>
          }
        />
      </div>

      <ResourceList
        className="mb-6"
        title="Recent activity"
        titleId="org-audit-h"
        description={`The newest ${audit.length} events from this organization's own audit trail.`}
        label="Recent activity, newest first"
        rows={audit.map((e) => ({
          id: e.id,
          title: (
            <>
              {AUDIT_ACTION_LABELS[e.action] ?? e.action}
              <span className="font-normal text-ink-3"> · {e.target.label ?? e.target.id}</span>
            </>
          ),
          meta: e.actorEmail,
          trailing: (
            <time dateTime={e.createdAt} className="whitespace-nowrap text-xs tabular-nums text-ink-3">
              {fmtDateTime(e.createdAt)}
            </time>
          ),
        }))}
        empty={<EmptyState bare headingLevel={3} title="No activity recorded" />}
      />

      <OrgRiskActions org={ref} canSuspend={canPlatform(ctx.role, "orgs:suspend")} canLegalHold={canPlatform(ctx.role, "orgs:legal_hold")} />
    </>
  );
}
