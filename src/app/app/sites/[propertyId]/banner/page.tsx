import type { Metadata } from "next";
import { BannerBuilder } from "@/components/app/banner-builder/banner-builder";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishBadge } from "@/components/app/ui/badge";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Banner" };

export default async function BannerPage(props: PageProps<"/app/sites/[propertyId]/banner">) {
  const { propertyId } = await props.params;
  const { tab } = await props.searchParams;
  const { property, org, role } = await requireProperty(propertyId);
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app", label: "Sites" }, { href: `/app/sites/${property.id}`, label: property.name }, { label: "Banner" }]}
        title="Banner"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Design, wording and behaviour. Changes go live when you publish.
            <PublishBadge dirty={property.config.version !== property.publishedVersion} published={property.publishedVersion > 0} />
          </span>
        }
      />
      <BannerBuilder
        key={property.config.version}
        property={property}
        dpo={org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined}
        canWrite={can(role, "property:write")}
        initialTab={typeof tab === "string" ? tab : undefined}
      />
    </>
  );
}
