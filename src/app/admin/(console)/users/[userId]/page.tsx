import Link from "next/link";
import { notFound } from "next/navigation";
import { MfaBadge, OrgStatusBadge, PlanBadge } from "@/components/admin/badges";
import { describeAgent, fmtDate, fmtDateTime } from "@/components/admin/format";
import { UserActions } from "@/components/admin/user-actions";
import { PageHeader } from "@/components/app/shell/page-header";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState } from "@/components/app/ui/empty-state";
import { KpiTile } from "@/components/app/ui/kpi-tile";
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
  const rows = sessions;
  const active = rows.filter((s) => !s.problem);

  return (
    <>
      <PageHeader
        title={user.name}
        crumbs={[{ label: "Staff console" }, { label: "Overview", href: "/admin" }, { label: "Users", href: "/admin/users" }, { label: user.name }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {locked ? <Badge tone="declined">Locked until {fmtDateTime(user.lockedUntil)}</Badge> : null}
          </span>
        }
        actions={
          <UserActions
            user={{ id: user.id, email: user.email, locked, failures: user.loginFailures?.count ?? 0, activeSessions: active.length }}
            canUnlock={canPlatform(ctx.role, "users:unlock")}
            canRevoke={canPlatform(ctx.role, "users:revoke_sessions")}
          />
        }
      />

      <section aria-labelledby="user-facts-h" className="panel overflow-hidden">
        <h2 id="user-facts-h" className="sr-only">
          Summary
        </h2>
        <div className="grid grid-cols-2 gap-px bg-line xl:grid-cols-4">
          <KpiTile label="Organizations" value={String(orgs.length)} detail={orgs.length ? "Memberships below" : "Hasn't finished onboarding"} />
          <KpiTile label="Active sessions" value={String(active.length)} detail={`${sessions.length} in the last 30 days`} />
          <KpiTile label="Two-factor" value={user.mfa ? "On" : "Off"} detail={user.mfa ? `Since ${fmtDate(user.mfa.enabledAt)}` : "Password only"} />
          <KpiTile label="Last active" value={fmtDate(user.lastActiveAt)} detail={`Joined ${fmtDate(user.createdAt)}`} />
        </div>
      </section>

      <div className="mt-10 space-y-10">
        <section aria-labelledby="memberships-h">
          <h2 id="memberships-h" className="mb-3 text-lg font-bold">
            Memberships
          </h2>
          {orgs.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {orgs.map(({ membership, org }) => (
                <li key={membership.orgId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                    {org ? (
                      <Link href={`/admin/orgs/${org.id}`} className="block truncate text-sm font-bold hover:underline">
                        {org.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold">Deleted organization</span>
                    )}
                    <span className="block text-xs text-ink-3">
                      Member since {fmtDate(membership.createdAt)}
                      {membership.invitedBy ? `, invited by ${membership.invitedBy}` : ""}
                    </span>
                  </div>
                  <Badge tone={membership.role === "owner" ? "brand" : "neutral"} className="capitalize">
                    {membership.role}
                  </Badge>
                  {org ? (
                    <>
                      <PlanBadge plan={org.plan} />
                      <OrgStatusBadge suspended={Boolean(org.suspendedAt)} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState headingLevel={3} title="No memberships">
              This person signed up but hasn&apos;t created or joined an organization.
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="sessions-h">
          <h2 id="sessions-h" className="mb-1 text-lg font-bold">
            Sessions
          </h2>
          <p className="mb-3 text-sm text-ink-3">Signed-in browsers from the last 30 days. IP addresses are stored only as salted hashes.</p>
          {rows.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {rows.map((s) => (
                <li key={s.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <span className="font-bold">{describeAgent(s.userAgent)}</span>
                    <span className="block text-xs text-ink-3">
                      Started {fmtDateTime(s.createdAt)} · last seen {fmtDateTime(s.lastSeenAt)}
                    </span>
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    {s.mfaVerified ? <Badge tone="neutral">Two-factor</Badge> : null}
                    {s.problem ? <Badge tone="neutral">{PROBLEM_LABEL[s.problem]}</Badge> : <Badge tone="released">Active</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState headingLevel={3} title="No sessions">
              No sign-ins in the last 30 days.
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="security-h">
          <h2 id="security-h" className="mb-3 text-lg font-bold">
            Sign-in security
          </h2>
          <dl className="grid gap-4 rounded-lg border border-line bg-surface px-5 py-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-3">Two-factor</dt>
              <dd className="mt-1">
                <MfaBadge on={Boolean(user.mfa)} />
                {user.mfa ? <span className="ml-2 text-xs text-ink-3">{user.mfa.recoveryCodes.length} recovery codes left</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Failed sign-ins in window</dt>
              <dd className="mt-1 tabular-nums">{user.loginFailures?.count ?? 0}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Password last changed</dt>
              <dd className="mt-1">{user.passwordHash ? fmtDate(user.passwordChangedAt) : "Managed by identity provider"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
