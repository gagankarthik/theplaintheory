import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishButton } from "@/components/app/sites/publish-button";
import { TrackersManager } from "@/components/app/trackers/trackers-manager";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Trackers" };

export default async function TrackersPage(props: PageProps<"/app/sites/[propertyId]/trackers">) {
  const { propertyId } = await props.params;
  const { property, role } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Trackers" }]}
        title="Trackers"
        description="Third-party scripts that wait for consent. Essential scripts aren't listed because they always run."
        actions={canWrite ? <PublishButton propertyId={property.id} dirty={property.config.version !== property.publishedVersion} /> : null}
      />
      <TrackersManager propertyId={property.id} trackers={property.trackers} canWrite={canWrite} />
    </>
  );
}
