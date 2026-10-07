import { StaffManager } from "@/components/admin/staff-manager";
import { PageHeader } from "@/components/app/shell/page-header";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { listStaffAccounts } from "@/lib/auth/staff-cognito";

export const generateMetadata = () => staffMetadata("Our team");

export default async function AdminStaffPage() {
  const ctx = await requireStaff("staff:manage");
  const staff = await listStaffAccounts();
  return (
    <>
      <PageHeader title="Our team" description="Plain Theory staff accounts in the staff sign-in pool. Invite people, change roles, and disable or remove accounts." />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <StaffManager
          staff={staff.map((s) => ({ sub: s.sub, name: s.name, email: s.email, role: s.role, enabled: s.enabled, status: s.status, createdAt: s.createdAt }))}
          me={ctx.staff.sub}
        />
        <aside aria-labelledby="staff-roles-h" className="xl:sticky xl:top-20 xl:self-start xl:border-l xl:border-line xl:pl-8">
          <h2 id="staff-roles-h" className="mb-3 text-base font-bold">
            What each staff role can do
          </h2>
          <dl className="space-y-4 text-sm">
            {PLATFORM_ROLES.map((r) => (
              <div key={r}>
                <dt className="font-bold">{PLATFORM_ROLE_INFO[r].label}</dt>
                <dd className="text-ink-3">{PLATFORM_ROLE_INFO[r].summary}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs leading-5 text-ink-3">
            Roles are the <code className="font-mono">platform-*</code> groups in the staff Cognito pool. Every account signs in with a password and an authenticator app; changes here sign
            the person out so the new role or status applies at once.
          </p>
        </aside>
      </div>
    </>
  );
}
