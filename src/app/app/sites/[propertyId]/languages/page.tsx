import type { Metadata } from "next";
import { LanguagesManager } from "@/components/app/languages/languages-manager";
import { PageHeader } from "@/components/app/shell/page-header";
import { PublishButton } from "@/components/app/sites/publish-button";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";
import { planById } from "@/lib/plans";

export const metadata: Metadata = { title: "Languages" };

export default async function LanguagesPage(props: PageProps<"/app/sites/[propertyId]/languages">) {
  const { propertyId } = await props.params;
  const { property, org, role } = await requireProperty(propertyId);
  const canWrite = can(role, "property:write");
  const plan = planById(org.plan);
  return (
    <>
      <PageHeader
        title="Languages"
        description="Show each notice in the languages your visitors read. India's DPDP Act lets people read the notice in English or any of the 22 languages of the Eighth Schedule."
        actions={canWrite ? <PublishButton propertyId={property.id} dirty={property.config.version !== property.publishedVersion} /> : null}
      />
      <LanguagesManager
        key={property.config.version}
        property={property}
        dpo={org.dpo ? { name: org.dpo.name, email: org.dpo.email } : undefined}
        canWrite={canWrite}
        indianLanguages={plan.limits.indianLanguages}
        planName={plan.name}
      />
    </>
  );
}
