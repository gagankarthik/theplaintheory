import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { TrackersManager, type ScanSummary } from "@/components/app/trackers/trackers-manager";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { TRACKER_DB } from "@/lib/tracker-db";

export const metadata: Metadata = { title: "Trackers" };

export default async function TrackersPage(props: PageProps<"/app/sites/[propertyId]/trackers">) {
  const { propertyId } = await props.params;
  const { property, role, store } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  // the history needs counts only; findings already live on the tracker list
  const scans: ScanSummary[] = (await store.listScans(property.id, 10)).map((s) => ({
    id: s.id,
    finishedAt: s.finishedAt,
    status: s.status,
    error: s.error,
    pages: s.pages.filter((p) => p.status !== null && p.status < 400).length,
    findings: s.findings.length,
    unknown: s.findings.filter((f) => f.category === null).length,
  }));
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Trackers" }]}
        title="Trackers"
        description="Everything your site loads that may track visitors. Approved trackers wait for consent to their category."
      />
      <TrackersManager propertyId={property.id} domain={property.domain} trackers={property.trackers} scans={scans} canWrite={canWrite} knownCount={TRACKER_DB.length} />
    </>
  );
}
