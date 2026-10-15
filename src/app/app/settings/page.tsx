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
      <PageHeader title="Settings" description={`Details, data protection contact and sign-in policy for ${org.name}.`} />
      <div className="max-w-4xl">
        <OrgSettingsForm org={{ name: org.name, dataRegion: org.dataRegion, dpo: org.dpo }} canEdit={can(role, "org:settings")} />

        <SecurityPolicyForm
          requireMfa={Boolean(org.security?.requireMfa)}
          canEdit={can(role, "security:manage")}
          ownMfa={Boolean(user.mfa)}
          unenrolled={members.filter((m) => m.user && !m.user.mfa).length}
        />

        {properties.length ? (
          <SettingsSection id="delete-sites" tone="danger" title="Delete a site" description="Removes the site with its settings, statistics and consent receipts. This can't be undone.">
            <ul aria-label="Sites" className="divide-y divide-line">
              {properties.map((p) => (
                <li key={p.id} className="flex min-h-16 items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                    <p className="truncate font-mono text-xs text-ink-3">{p.domain}</p>
                  </div>
                  <DeleteSite propertyId={p.id} name={p.name} domain={p.domain} />
                </li>
              ))}
            </ul>
          </SettingsSection>
        ) : null}
      </div>
    </>
  );
}
