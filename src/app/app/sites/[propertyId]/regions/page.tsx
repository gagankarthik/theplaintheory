import type { Metadata } from "next";
import { NoticeSettings } from "@/components/app/regions/notice-settings";
import { RegionsEditor } from "@/components/app/regions/regions-editor";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishButton } from "@/components/app/sites/publish-button";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Regions" };

export default async function RegionsPage(props: PageProps<"/app/sites/[propertyId]/regions">) {
  const { propertyId } = await props.params;
  const { property, role, org } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Regions" }]}
        title="Regions"
        description="Visitors get the notice for the law that covers them. We read their country at the edge; no IP address is stored."
        actions={canWrite ? <PublishButton propertyId={property.id} dirty={property.config.version !== property.publishedVersion} /> : null}
      />
      <RegionsEditor key={property.config.version} propertyId={property.id} initial={property.config.regions} canWrite={canWrite} />
      <div className="mt-12 border-t border-line pt-10">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">Notice details</h2>
        <NoticeSettings key={`n-${property.config.version}`} propertyId={property.id} config={property.config} dpoEmail={org.dpo?.email} canWrite={canWrite} />
      </div>
    </>
  );
}
