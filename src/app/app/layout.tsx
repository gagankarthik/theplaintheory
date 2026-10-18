import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { site } from "@/lib/site";
import { Shell } from "@/components/app/shell/shell";
import { ThemeScript } from "@/components/theme/theme-script";
import { mfaRequirementState } from "@/lib/auth/second-factor";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { evaluateFairness } from "@/lib/fairness";
import { setupProgress } from "@/lib/setup";
import { loadSetupSignals } from "@/lib/setup-signals";

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
    store.getOrgs(memberships.map((m) => m.orgId)),
    store.listProperties(org.id),
  ]);
  // The site in focus (the one in the URL, else the last visited, else the first) and how far its
  // setup has got, for the sidebar's progress card. Three small reads, for that one site only.
  const pathSite = path.match(/^\/app\/sites\/([^/]+)/)?.[1];
  const focus = [pathSite, lastSiteId].map((id) => properties.find((p) => p.id === id)).find(Boolean) ?? properties[0];
  const progress = focus ? setupProgress(await loadSetupSignals(store, focus, org)) : null;
  const setup =
    focus && progress && !progress.complete
      ? {
          siteId: focus.id,
          name: focus.name,
          done: progress.done,
          total: progress.total,
          next: progress.next ? { title: progress.next.title, href: progress.next.href } : null,
          scanning: progress.steps.some((s) => s.status === "running"),
        }
      : null;

  return (
    <>
    <ThemeScript />
    <Shell
      user={{ name: user.name, email: user.email }}
      org={{ id: org.id, name: org.name, plan: org.plan }}
      role={role}
      initialCollapsed={sidebarCollapsed}
      initialSiteId={lastSiteId}
      setup={setup}
      orgs={memberships.flatMap((m) => orgs.filter((o) => o.id === m.orgId)).map((o) => ({ id: o.id, name: o.name }))}
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
    </>
  );
}
