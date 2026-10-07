import { OrgsTable } from "@/components/admin/orgs-table";
import { PageHeader } from "@/components/app/shell/page-header";
import { EmptyState } from "@/components/app/ui/empty-state";
import { requireStaff, staffMetadata } from "@/lib/auth/staff";
import { loadSnapshot } from "@/lib/platform/data";

export const generateMetadata = () => staffMetadata("Organizations");

export default async function AdminOrgsPage() {
  await requireStaff("platform:lists");
  const { orgSummaries } = await loadSnapshot();
  return (
    <>
      <PageHeader title="Organizations" description="Every customer workspace. Open one to see members, sites, billing and its audit trail." />
      {orgSummaries.length ? <OrgsTable orgs={orgSummaries} /> : <EmptyState title="No organizations yet">Organizations appear here once someone finishes onboarding.</EmptyState>}
    </>
  );
}
