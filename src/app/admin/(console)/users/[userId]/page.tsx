import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberRoleBadge, MfaBadge, OrgStatusBadge, PlanBadge } from "@/components/admin/badges";
import { describeAgent, fmtDate, fmtDateTime, fmtInt } from "@/components/admin/format";
import { UserActions } from "@/components/admin/user-actions";
import { PageHeader } from "@/components/app/shell/page-header";
import { Alert } from "@/components/app/ui/alert";
import { Badge } from "@/components/app/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/app/ui/card";
import { DescriptionList } from "@/components/app/ui/description-list";
import { EmptyState } from "@/components/app/ui/empty-state";
import { ResourceList } from "@/components/app/ui/resource-list";
import { StatStrip } from "@/components/app/ui/stat-strip";
import { canPlatform } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadUserDetail } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("User");

const PROBLEM_LABEL: Record<string, string> = { revoked: "Revoked", expired: "Expired", idle: "Timed out", missing: "Ended" };

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const ctx = await requireStaff("platform:detail");
  const detail = await loadUserDetail(userId);
  if (!detail) notFound();
  const { user, orgs, sessions, locked } = detail;
  const active = sessions.filter((s) => !s.problem);
  const failures = user.loginFailures?.count ?? 0;

  return (
    <>
      <PageHeader
        title={user.name}
        crumbs={[{ label: "Staff console" }, { label: "Overview", href: "/admin" }, { label: "Users", href: "/admin/users" }, { label: user.name }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {locked ? <Badge tone="danger">Locked</Badge> : null}
          </span>
        }
        actions={
          <UserActions
            user={{ id: user.id, email: user.email, locked, failures, activeSessions: active.length }}
            canUnlock={canPlatform(ctx.role, "users:unlock")}
            canRevoke={canPlatform(ctx.role, "users:revoke_sessions")}
          />
        }
      />

      {locked ? (
        <Alert tone="danger" title={`Sign-in locked until ${fmtDateTime(user.lockedUntil)}`} className="mb-6">
          {fmtInt(failures)} failed sign-in{failures === 1 ? "" : "s"} in the current window. Unlock only after confirming who you&apos;re talking to.
        </Alert>
      ) : null}

      <StatStrip
        label="User summary"
        stats={[
          { label: "Organizations", value: fmtInt(orgs.length), note: orgs.length ? "Memberships below" : "Hasn't finished onboarding" },
          { label: "Active sessions", value: fmtInt(active.length), note: `${fmtInt(sessions.length)} in the last 30 days` },
          { label: "Two-factor", value: user.mfa ? "On" : "Off", note: user.mfa ? `Since ${fmtDate(user.mfa.enabledAt)}` : "Password only", tone: user.mfa ? undefined : "warn" },
          { label: "Last active", value: fmtDate(user.lastActiveAt), note: `Joined ${fmtDate(user.createdAt)}` },
        ]}
      />

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ResourceList
          title="Memberships"
          titleId="memberships-h"
          label="Memberships"
          rows={orgs.map(({ membership, org }) => ({
            id: membership.orgId,
            title: org ? (
              <Link href={`/admin/orgs/${org.id}`} className="underline-offset-4 hover:underline">
                {org.name}
              </Link>
            ) : (
              "Deleted organization"
            ),
            meta: `Member since ${fmtDate(membership.createdAt)}${membership.invitedBy ? `, invited by ${membership.invitedBy}` : ""}`,
            trailing: (
              <>
                <MemberRoleBadge role={membership.role} />
                {org ? (
                  <>
                    <PlanBadge plan={org.plan} />
                    <OrgStatusBadge suspended={Boolean(org.suspendedAt)} />
                  </>
                ) : null}
              </>
            ),
          }))}
          empty={
            <EmptyState bare headingLevel={3} title="No memberships">
              This person signed up but hasn&apos;t created or joined an organization.
            </EmptyState>
          }
        />

        <Card aria-labelledby="security-h" className="self-start">
          <CardHeader titleId="security-h" title="Sign-in security" />
          <CardBody>
            <DescriptionList
              columns={2}
              items={[
                {
                  label: "Two-factor",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <MfaBadge on={Boolean(user.mfa)} />
                      {user.mfa ? <span className="text-xs font-normal text-ink-3">{user.mfa.recoveryCodes.length} recovery codes left</span> : null}
                    </span>
                  ),
                },
                { label: "Failed sign-ins in window", value: <span className="tabular-nums">{fmtInt(failures)}</span> },
                { label: "Password last changed", value: user.passwordHash ? fmtDate(user.passwordChangedAt) : "Managed by identity provider" },
                { label: "Sign-in", value: locked ? <Badge tone="danger">Locked until {fmtDateTime(user.lockedUntil)}</Badge> : "Normal" },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <ResourceList
        title="Sessions"
        titleId="sessions-h"
        description="Signed-in browsers from the last 30 days. IP addresses are stored only as salted hashes."
        label="Sessions, last 30 days"
        rows={sessions.map((s) => ({
          id: s.id,
          title: describeAgent(s.userAgent),
          meta: `Started ${fmtDateTime(s.createdAt)} · last seen ${fmtDateTime(s.lastSeenAt)}`,
          trailing: (
            <>
              {s.mfaVerified ? <Badge tone="neutral">Two-factor</Badge> : null}
              {s.problem ? <Badge tone="neutral">{PROBLEM_LABEL[s.problem]}</Badge> : <Badge tone="success">Active</Badge>}
            </>
          ),
        }))}
        empty={
          <EmptyState bare headingLevel={3} title="No sessions">
            No sign-ins in the last 30 days.
          </EmptyState>
        }
      />
    </>
  );
}
