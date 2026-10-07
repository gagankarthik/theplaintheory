import { StaffManager } from "@/components/admin/staff-manager";
import { PageHeader } from "@/components/app/shell/page-header";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO, canPlatform } from "@/lib/auth/platform";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadStaff } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("Our team");

export default async function AdminStaffPage() {
  const ctx = await requireStaff();
  const staff = await loadStaff();
  const canManage = canPlatform(ctx.role, "staff:manage");
  return (
    <>
      <PageHeader
        title="Our team"
        description={canManage ? "Plain Theory staff with console access. Grant, change or remove platform roles." : "Plain Theory staff with console access. Only superadmins can change roles."}
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <StaffManager staff={staff} me={ctx.user.id} canManage={canManage} />
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
            Emails listed in the <code className="font-mono">PLATFORM_SUPERADMINS</code> environment variable are always superadmins and can only be changed there.
          </p>
        </aside>
      </div>
    </>
  );
}
