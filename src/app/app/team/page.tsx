import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { InviteButton, TeamManager } from "@/components/app/team/team-manager";
import { buttonClass } from "@/components/app/ui/button";
import { StatStrip, type Stat } from "@/components/app/ui/stat-strip";
import { IconDownload } from "@/components/icons";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { planById } from "@/lib/plans";
import { upgradeOffer } from "@/lib/upgrade-offer";
import { TeamInviteAction } from "@/components/app/team/team-invite-action";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { org, role, user } = await requireUser();
  const store = await getStore();
  const [members, invites] = await Promise.all([store.listMembers(org.id), store.listInvites(org.id)]);
  const plan = planById(org.plan);
  const used = members.length + invites.length;
  const seatsLeft = plan.seats === null ? null : Math.max(0, plan.seats - used);
  const canManage = can(role, "team:manage");

  // Out of seats: the Invite action becomes an upgrade offer with the plans that add seats.
  const locked = canManage && seatsLeft === 0;
  const offer = locked ? await upgradeOffer(org, role, (p) => p.seats === null || p.seats > (plan.seats ?? 0)) : null;

  // Facts for the strip, all from the member and invite records above.
  const now = new Date().getTime();
  const people = members.filter((m) => m.user);
  const withoutMfa = people.filter((m) => !m.user!.mfa).length;
  const owners = members.filter((m) => m.role === "owner").length;
  const staleInvites = invites.filter((i) => now - Date.parse(i.createdAt) > 30 * 86_400_000).length;
  const full = plan.seats !== null && used >= plan.seats;
  const stats: Stat[] = [
    { label: "Members", value: String(members.length), note: `${owners} owner${owners === 1 ? "" : "s"}` },
    {
      label: "Pending invitations",
      value: String(invites.length),
      note: staleInvites ? `${staleInvites} over 30 days old` : invites.length ? "Waiting for sign-up" : "None waiting",
      tone: staleInvites ? "warn" : undefined,
    },
    {
      label: "Seats used",
      value: plan.seats === null ? String(used) : `${used} of ${plan.seats}`,
      note: plan.seats === null ? `Unlimited on ${plan.name}` : full ? "Plan is full" : "Includes pending invitations",
      tone: full ? "warn" : undefined,
      href: full && can(role, "billing:manage") ? "/app/billing" : undefined,
    },
    {
      label: "Without two-factor",
      value: String(withoutMfa),
      note: withoutMfa ? (org.security?.requireMfa ? "Required; each gets 7 days to set it up" : "Two-factor is optional") : "Everyone has it on",
      tone: withoutMfa ? "warn" : undefined,
    },
  ];

  const inviteAction = offer ? <TeamInviteAction offer={offer} seats={plan.seats ?? 0} /> : canManage ? <InviteButton seatsLeft={seatsLeft} /> : null;

  return (
    <>
      <PageHeader
        title="Team"
        description={`People with access to ${org.name}. Roles apply to every site.`}
        actions={
          <>
            {can(role, "audit:read") ? (
              <a className={buttonClass("ghost")} href="/api/app/team/access-review" download>
                <IconDownload size={18} />
                Export access review
              </a>
            ) : null}
            {inviteAction}
          </>
        }
      />
      <StatStrip label="Team at a glance" stats={stats} />
      <TeamManager
        members={members.map((m) => ({
          userId: m.userId,
          name: m.user?.name ?? "Deleted user",
          email: m.user?.email ?? "",
          role: m.role,
          since: m.createdAt,
          mfa: Boolean(m.user?.mfa),
          // inside the grace period of a required setup: show the deadline
          mfaDue: org.security?.requireMfa && !m.user?.mfa ? m.user?.mfaSetupDeferredUntil : undefined,
          lastActiveAt: m.user?.lastActiveAt,
          invitedBy: m.invitedBy,
        }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt }))}
        me={user.id}
        myRole={role}
        canManage={canManage}
        seatsLeft={seatsLeft}
        now={now}
        inviteAction={inviteAction}
      />
    </>
  );
}
