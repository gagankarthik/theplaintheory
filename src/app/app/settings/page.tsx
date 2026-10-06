import type { Metadata } from "next";
import { DeleteSite } from "@/components/app/settings/delete-site";
import { OrgSettingsForm } from "@/components/app/settings/org-settings-form";
import { SecurityPolicyForm } from "@/components/app/settings/security-policy-form";
import { PageHeader } from "@/components/app/shell/page-header";
import { SettingsSection } from "@/components/app/ui/settings";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { org, role, user } = await requireUser();
  const store = await getStore();
  const [properties, members] = await Promise.all([can(role, "property:delete") ? store.listProperties(org.id) : [], store.listMembers(org.id)]);

  return (
    <>
      <PageHeader title="Settings" description={`Details, data residency and compliance contacts for ${org.name}.`} />
      <div className="max-w-5xl">
        <OrgSettingsForm org={{ name: org.name, dataRegion: org.dataRegion, dpo: org.dpo }} canEdit={can(role, "org:settings")} />

        <div className="mt-12">
          <SecurityPolicyForm
            requireMfa={Boolean(org.security?.requireMfa)}
            canEdit={can(role, "security:manage")}
            ownMfa={Boolean(user.mfa)}
            unenrolled={members.filter((m) => m.user && !m.user.mfa).length}
          />
        </div>

        {properties.length ? (
          <div className="mt-12">
            <SettingsSection title="Danger zone" description="Deleting a site can't be undone. Its receipts stay in the log until they expire.">
              {properties.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="truncate text-xs text-ink-3">{p.domain}</p>
                  </div>
                  <DeleteSite propertyId={p.id} name={p.name} domain={p.domain} />
                </div>
              ))}
            </SettingsSection>
          </div>
        ) : null}
      </div>
    </>
  );
}
