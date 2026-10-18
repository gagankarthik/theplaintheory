import type { Metadata } from "next";
import Link from "next/link";
import { OrgSettingsForm } from "@/components/app/settings/org-settings-form";
import { SecurityPolicyForm } from "@/components/app/settings/security-policy-form";
import { PageHeader } from "@/components/app/shell/page-header";
import { SettingsSection } from "@/components/app/ui/settings";
import { can } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Settings" };

/** Only a path inside the app may be a "back" target, so the link can't be pointed elsewhere. */
const safeBack = (v: string | string[] | undefined) => (typeof v === "string" && /^\/app\/sites\/[\w-]+\/banner(\?tab=\w+)?$/.test(v) ? v : null);

export default async function SettingsPage(props: PageProps<"/app/settings">) {
  const { org, role, user } = await requireUser();
  const back = safeBack((await props.searchParams).back);
  const store = await getStore();
  const [properties, members] = await Promise.all([store.listProperties(org.id), store.listMembers(org.id)]);

  return (
    <>
      <PageHeader title="Settings" description={`Details, data protection contact and sign-in policy for ${org.name}.`} />
      {back ? (
        <Link href={back} className="btn btn-link mb-4 inline-flex text-sm">
          ← Back to the banner review
        </Link>
      ) : null}
      <div className="max-w-4xl">
        <OrgSettingsForm org={{ name: org.name, dataRegion: org.dataRegion, dpo: org.dpo }} canEdit={can(role, "org:settings")} />

        <SecurityPolicyForm
          requireMfa={Boolean(org.security?.requireMfa)}
          canEdit={can(role, "security:manage")}
          ownMfa={Boolean(user.mfa)}
          unenrolled={members.filter((m) => m.user && !m.user.mfa).length}
        />

        {/* A site's own name, key and deletion live in its Site settings; this lists the way there. */}
        {properties.length ? (
          <SettingsSection id="sites" title="Site settings" description="Each site has its own settings page: its name, site key and deletion.">
            <ul aria-label="Sites" className="divide-y divide-line">
              {properties.map((p) => (
                <li key={p.id} className="flex min-h-16 items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                    <p className="truncate font-mono text-xs text-ink-3">{p.domain}</p>
                  </div>
                  <Link href={`/app/sites/${p.id}/settings`} className="btn btn-link shrink-0 text-sm">
                    Open<span className="sr-only"> settings for {p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SettingsSection>
        ) : null}
      </div>
    </>
  );
}
