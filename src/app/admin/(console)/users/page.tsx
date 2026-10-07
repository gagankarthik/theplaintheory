import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadSnapshot } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("Users");

export default async function AdminUsersPage() {
  await requireStaff("platform:lists");
  const { userSummaries } = await loadSnapshot();
  return (
    <>
      <PageHeader title="Users" description="Every account on the platform, the organizations they belong to and their sign-in health." />
      {userSummaries.length ? <UsersTable users={userSummaries} /> : <EmptyState title="No users yet">Accounts appear here as soon as someone signs up.</EmptyState>}
    </>
  );
}
