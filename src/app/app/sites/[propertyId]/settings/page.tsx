import type { Metadata } from "next";
import { DeleteSite } from "@/components/app/settings/delete-site";
import { SiteDetailsForm } from "@/components/app/settings/site-details-form";
import { PageHeader } from "@/components/app/shell/page-header";
import { SettingsSection } from "@/components/app/ui/settings";
import { requireProperty } from "@/lib/auth/access";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Site settings" };

/** One site's own settings: its details and, at the foot, deleting it. Organization-wide settings live in /app/settings. */
export default async function SiteSettingsPage(props: PageProps<"/app/sites/[propertyId]/settings">) {
  const { propertyId } = await props.params;
  const { property, role } = await requireProperty(propertyId);

  return (
    <>
      <PageHeader title="Site settings" description={`Details and the site key for ${property.domain}.`} />
      <div className="max-w-4xl">
        <SiteDetailsForm
          propertyId={property.id}
          name={property.name}
          domain={property.domain}
          siteKey={property.siteKey}
          canEdit={can(role, "property:write")}
        />

        {can(role, "property:delete") ? (
          <SettingsSection id="delete" tone="danger" title="Delete this site" description="Removes the site with its settings, statistics and consent receipts. This can't be undone.">
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{property.name}</p>
                <p className="truncate font-mono text-xs text-ink-3">{property.domain}</p>
              </div>
              <DeleteSite propertyId={property.id} name={property.name} domain={property.domain} />
            </div>
          </SettingsSection>
        ) : null}
      </div>
    </>
  );
}
