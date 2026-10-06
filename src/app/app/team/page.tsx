import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { TeamManager } from "@/components/app/team/team-manager";
import { buttonClass } from "@/components/app/ui/button";
import { IconDownload } from "@/components/icons";
import { ROLE_INFO, can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { planById } from "@/lib/plans";
import { getStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { org, role, user } = await requireUser();
  const store = await getStore();
  const [members, invites] = await Promise.all([store.listMembers(org.id), store.listInvites(org.id)]);
  const plan = planById(org.plan);
  const seatsLeft = plan.seats === null ? null : Math.max(0, plan.seats - members.length - invites.length);

  return (
    <>
      <PageHeader
        title="Team"
        description={`People who can see or change ${org.name}. Roles apply to every site in the organization.`}
        actions={
          can(role, "audit:read") ? (
            <a className={buttonClass("ghost")} href="/api/app/team/access-review" download>
              <IconDownload size={18} />
              Export access review
            </a>
          ) : null
        }
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <TeamManager
          members={members.map((m) => ({
            userId: m.userId,
            name: m.user?.name ?? "Deleted user",
            email: m.user?.email ?? "",
            role: m.role,
            since: m.createdAt,
            mfa: Boolean(m.user?.mfa),
            lastActiveAt: m.user?.lastActiveAt,
            invitedBy: m.invitedBy,
          }))}
          invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt }))}
          me={user.id}
          myRole={role}
          canManage={can(role, "team:manage")}
          seatsLeft={seatsLeft}
        />
        <aside aria-labelledby="roles-h" className="xl:sticky xl:top-20 xl:self-start xl:border-l xl:border-line xl:pl-8">
          <h2 id="roles-h" className="mb-3 text-base font-bold">
            What each role can do
          </h2>
          <dl className="space-y-4 text-sm">
            {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
              <div key={r}>
                <dt className="font-bold capitalize">{r}</dt>
                <dd className="text-ink-3">{ROLE_INFO[r]}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
