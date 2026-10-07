import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { site } from "@/lib/site";
import { Shell } from "@/components/app/shell/shell";
import { mfaRequirementState } from "@/lib/auth/second-factor";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { evaluateFairness } from "@/lib/fairness";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s | ${site.name}` },
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The org MFA policy is enforced here, before the page streams, so un-enrolled members get a real
  // redirect; every page and action checks it again. /app/account stays open for enrolment.
  const { user, org, role, memberships } = await requireUser({ allowWithoutMfa: true });
  const path = (await headers()).get("x-pt-path") ?? "";
  if (mfaRequirementState(org, user) === "required" && !path.startsWith("/app/account")) redirect("/app/account?mfa=required");
  const store = await getStore();
  const jar = await cookies();
  const sidebarCollapsed = jar.get("pt-sidebar")?.value === "collapsed";
  const lastSiteId = jar.get("pt-site")?.value;
  const [orgs, properties] = await Promise.all([
    Promise.all(memberships.map((m) => store.getOrg(m.orgId))),
    store.listProperties(org.id),
  ]);

  return (
    <Shell
      user={{ name: user.name, email: user.email }}
      org={{ id: org.id, name: org.name, plan: org.plan }}
      role={role}
      initialCollapsed={sidebarCollapsed}
      initialSiteId={lastSiteId}
      orgs={orgs.filter((o) => o !== null).map((o) => ({ id: o.id, name: o.name }))}
      properties={properties
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          id: p.id,
          name: p.name,
          domain: p.domain,
          dirty: p.config.version !== p.publishedVersion,
          published: p.publishedVersion > 0,
          // the same rule publishSite enforces, so the top bar can explain a block before anyone clicks
          blocked: evaluateFairness(p.config, { dpoEmail: org.dpo?.email }).failures.length,
        }))}
    >
      {children}
    </Shell>
  );
}
