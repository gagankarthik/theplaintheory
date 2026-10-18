import type { Metadata } from "next";
import { BannerBuilder } from "@/components/app/banner-builder/banner-builder";
import { LearnMore } from "@/components/app/configure/learn-more";
import { PageHeader } from "@/components/app/shell/page-header";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Banner studio" };

export default async function BannerPage(props: PageProps<"/app/sites/[propertyId]/banner">) {
  const { propertyId } = await props.params;
  const { tab } = await props.searchParams;
  const { property, org, role } = await requireProperty(propertyId);
  return (
    <>
      <PageHeader
        title="Banner studio"
        description={
          <>
            Design, word and publish your consent banner. Visitors only see what you publish. <LearnMore anchor="banner" topic="the banner" />
          </>
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
