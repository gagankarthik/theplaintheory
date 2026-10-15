"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { signOut, switchOrg } from "@/app/app/actions";
import { BrandMark } from "@/components/brand/logo";
import {
  IconAlert,
  IconArrowRight,
  IconBalance,
  IconBilling,
  IconBook,
  IconBrush,
  IconChain,
  IconCookie,
  IconInfo,
  IconInstall,
  IconLock,
  IconLogs,
  IconOverview,
  IconPlainText,
  IconPlug,
  IconPlus,
  IconRadar,
  IconReceipt,
  IconRegion,
  IconSettings,
  IconShieldCheck,
  IconSignOut,
  IconSites,
  IconTeam,
} from "@/components/icons";
import { ToastProvider } from "@/components/app/ui/toast";
import { ThemeScope, ThemeToggle } from "@/components/theme/theme";
import { can } from "@/lib/auth/rbac";
import type { Role } from "@/lib/types";
import { PublishButton } from "@/components/app/sites/publish-button";
import { BreadcrumbProvider, type Crumb } from "./breadcrumbs";
import { Dropdown, MenuLabel, MenuSeparator, menuItemClass } from "./dropdown";
import { NavDrawer, NavGroups, NavRail, type NavGroup, type NavTab } from "./nav";

interface ShellProps {
  user: { name: string; email: string };
  org: { id: string; name: string; plan: string };
  role: Role;
  orgs: { id: string; name: string }[];
  properties: { id: string; name: string; domain: string; dirty: boolean; published?: boolean; /** failing fairness checks, which block publishing */ blocked?: number }[];
  /** read from the `pt-sidebar` cookie on the server so the first paint has the right width */
  initialCollapsed?: boolean;
  /** the last site visited (`pt-site` cookie), so organization pages keep showing its sections */
  initialSiteId?: string;
  children: React.ReactNode;
}

/** Site sections, grouped by job: see the site, configure what visitors get, prove what happened. */
const siteGroups = (id: string): NavGroup[] => [
  {
    tabs: [
      { href: `/app/sites/${id}`, label: "Overview", icon: IconOverview, exact: true },
      { href: `/app/sites/${id}/dpdp`, label: "DPDP readiness", icon: IconBalance },
    ],
  },
  {
    label: "Configure",
    tabs: [
      { href: `/app/sites/${id}/banner`, label: "Banner studio", icon: IconBrush },
      { href: `/app/sites/${id}/regions`, label: "Regions", icon: IconRegion },
      { href: `/app/sites/${id}/languages`, label: "Languages", icon: IconPlainText },
      { href: `/app/sites/${id}/trackers`, label: "Cookie catalog", icon: IconCookie },
      { href: `/app/sites/${id}/scanner`, label: "Scanner", icon: IconRadar },
      { href: `/app/sites/${id}/install`, label: "Install", icon: IconInstall },
    ],
  },
  {
    label: "Prove",
    tabs: [
      { href: `/app/sites/${id}/logs`, label: "Consent log", icon: IconLogs },
      { href: `/app/sites/${id}/leaks`, label: "Leaks", icon: IconAlert },
      { href: `/app/sites/${id}/evidence`, label: "Evidence", icon: IconReceipt },
      { href: `/app/sites/${id}/webhooks`, label: "Webhooks", icon: IconPlug },
    ],
  },
];

const orgTabs = (role: Role): NavTab[] => [
  { href: "/app/team", label: "Team", icon: IconTeam },
  { href: "/app/billing", label: "Billing", icon: IconBilling },
  { href: "/app/settings", label: "Settings", icon: IconSettings },
  // the audit trail and control status are for owners, admins and auditors (rbac "audit:read")
  ...(can(role, "audit:read")
    ? [
        { href: "/app/audit", label: "Audit log", icon: IconChain },
        { href: "/app/security", label: "Security", icon: IconShieldCheck },
      ]
    : []),
];

export const SIDEBAR_COOKIE = "pt-sidebar";
export const SITE_COOKIE = "pt-site";

const isActive = (t: NavTab, pathname: string) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));

const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Organization tile: soot square with chalk initials (inverts in dark). */
function OrgAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-[8px] bg-inverse font-semibold text-on-inverse" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(name)}
    </span>
  );
}

/** Person: a lime disc with soot initials, like the "on" state of the mark. */
function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-lime font-semibold text-soot ring-1 ring-inset ring-soot/15" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(name)}
    </span>
  );
}

/** Site chip: the first two letters in the data face; lime when it is the current site. */
function SiteChip({ name, current, size = 28 }: { name: string; current?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[8px] font-mono text-[0.6875rem] font-semibold ${current ? "bg-selected text-on-selected ring-1 ring-inset ring-ink/20 dark:bg-brand-solid dark:text-soot" : "bg-paper text-ink-2 ring-1 ring-inset ring-line-strong"}`}
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function UpDown() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="shrink-0 text-ink-3">
      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="ml-auto shrink-0 text-ink">
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lists past this length get a filter field in the switchers. */
const SEARCH_FROM = 7;

const switcherTrigger =
  "flex h-10 min-w-0 max-w-full items-center gap-2 rounded-full px-1.5 text-left text-sm transition-colors duration-150 hover:bg-raised aria-expanded:bg-raised sm:pr-2.5";

/** Organization switcher in the top bar. */
function OrgSwitcher({ org, orgs, full }: { org: ShellProps["org"]; orgs: ShellProps["orgs"]; /** always show the name (the phone drawer) */ full?: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <Dropdown
      label={`Organization: ${org.name}. Switch organization`}
      title="Organizations"
      triggerClassName={`${switcherTrigger} ${full ? "w-full" : ""}`}
      search={orgs.length >= SEARCH_FROM ? { label: "Find an organization", placeholder: "Find an organization" } : undefined}
      trigger={
        <>
          <OrgAvatar name={org.name} />
          <span className={`min-w-0 ${full ? "block flex-1" : "hidden md:block"}`}>
            <span className="block max-w-[16ch] truncate text-sm font-semibold leading-tight text-ink">{org.name}</span>
            <span className="block truncate text-2xs capitalize leading-tight text-ink-3">{org.plan} plan</span>
          </span>
          <UpDown />
        </>
      }
    >
      {(close, q) => {
        const list = orgs.filter((o) => o.name.toLowerCase().includes(q));
        return (
          <>
            <MenuLabel>Organizations</MenuLabel>
            {list.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === org.id}
                tabIndex={-1}
                onClick={() => {
                  close();
                  if (o.id !== org.id) startTransition(() => switchOrg(o.id));
                }}
                className={menuItemClass}
              >
                <OrgAvatar name={o.name} size={24} />
                <span className="truncate text-ink">{o.name}</span>
                {o.id === org.id ? <Check /> : null}
              </button>
            ))}
            {list.length === 0 ? <p className="px-2.5 py-3 text-sm text-ink-3">No organization matches.</p> : null}
            <MenuSeparator />
            <Link href="/onboarding/new" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
              <IconPlus size={16} className="shrink-0 text-ink-3" /> Create organization
            </Link>
          </>
        );
      }}
    </Dropdown>
  );
}

/** Site switcher in the top bar: the site whose sections the nav lists. Switching opens its overview. */
function SiteSwitcher({ org, properties, focus, onAll }: { org: ShellProps["org"]; properties: ShellProps["properties"]; focus?: ShellProps["properties"][number]; onAll: boolean }) {
  const router = useRouter();
  if (!focus) {
    return (
      <Link href="/app" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink ring-1 ring-inset ring-boundary transition-colors duration-150 hover:bg-raised">
        <IconPlus size={16} /> <span className="hidden sm:inline">Add your first site</span>
        <span className="sm:hidden">Add a site</span>
      </Link>
    );
  }
  const current = onAll ? null : focus;
  return (
    <Dropdown
      label={current ? `Site: ${current.name}. Switch site` : "All sites. Switch site"}
      title="Sites"
      width="w-80"
      triggerClassName={switcherTrigger}
      search={properties.length >= SEARCH_FROM ? { label: "Find a site", placeholder: "Find a site by name or domain" } : undefined}
      trigger={
        <>
          {current ? <SiteChip name={current.name} current /> : <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-paper text-ink-2 ring-1 ring-inset ring-line-strong"><IconSites size={15} /></span>}
          <span className="min-w-0">
            <span className="block max-w-[18ch] truncate text-sm font-medium leading-tight text-ink">{current ? current.name : "All sites"}</span>
            <span className="hidden max-w-[22ch] truncate font-mono text-2xs leading-tight text-ink-3 sm:block">{current ? current.domain : `${properties.length} in ${org.name}`}</span>
          </span>
          {current?.dirty ? (
            <span title="Unpublished changes" className="size-2 shrink-0 rounded-full border-2 border-amber-bright">
              <span className="sr-only">Unpublished changes</span>
            </span>
          ) : null}
          <UpDown />
        </>
      }
    >
      {(close, q) => {
        const list = properties.filter((p) => p.name.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q));
        return (
          <>
            <Link href="/app" role="menuitemradio" aria-checked={onAll} tabIndex={-1} onClick={close} className={menuItemClass}>
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-paper text-ink-2 ring-1 ring-inset ring-line-strong">
                <IconSites size={15} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">All sites</span>
                <span className="block text-xs text-ink-3">Every site at a glance</span>
              </span>
              {onAll ? <Check /> : null}
            </Link>
            <MenuSeparator />
            <MenuLabel>Sites</MenuLabel>
            {list.map((p) => {
              const isCurrent = !onAll && p.id === focus.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  tabIndex={-1}
                  onClick={() => {
                    close();
                    router.push(`/app/sites/${p.id}`);
                  }}
                  className={menuItemClass}
                >
                  <SiteChip name={p.name} current={isCurrent} />
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{p.name}</span>
                    <span className="block truncate font-mono text-2xs text-ink-3">
                      {p.domain}
                      {p.dirty ? <span className="font-sans"> · unpublished changes</span> : null}
                    </span>
                  </span>
                  {isCurrent ? <Check /> : null}
                </button>
              );
            })}
            {list.length === 0 ? <p className="px-2.5 py-3 text-sm text-ink-3">No site matches.</p> : null}
            <MenuSeparator />
            <Link href="/app" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
              <IconPlus size={16} className="shrink-0 text-ink-3" /> Add a site
            </Link>
          </>
        );
      }}
    </Dropdown>
  );
}

function UserMenu({ user, org, role }: { user: ShellProps["user"]; org: ShellProps["org"]; role: Role }) {
  return (
    <Dropdown
      label="Account menu"
      title="Account"
      align="right"
      width="w-72"
      triggerClassName="grid size-10 place-items-center rounded-full transition-colors duration-150 hover:bg-raised aria-expanded:bg-raised"
      trigger={<UserAvatar name={user.name} />}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <UserAvatar name={user.name} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
              <p className="mt-0.5 truncate text-xs text-ink-3">
                <span className="capitalize text-ink-2">{role}</span> at {org.name}
              </p>
            </div>
          </div>
          <MenuSeparator />
          <Link href="/app/account" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconSettings size={16} className="shrink-0 text-ink-3" /> Account
          </Link>
          <Link href="/app/account#two-factor" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconLock size={16} className="shrink-0 text-ink-3" /> Security
          </Link>
          {can(role, "billing:manage") ? (
            <Link href="/app/billing" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
              <IconBilling size={16} className="shrink-0 text-ink-3" /> Billing and plan
            </Link>
          ) : null}
          <div className="px-2.5 py-2">
            <p aria-hidden className="mb-1.5 text-xs text-ink-3">
              Theme
            </p>
            <ThemeToggle className="w-full" />
          </div>
          <MenuSeparator />
          <Link href="/docs" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconBook size={16} className="shrink-0 text-ink-3" /> Documentation
          </Link>
          <Link href="/contact?topic=support" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconInfo size={16} className="shrink-0 text-ink-3" /> Get support
          </Link>
          <Link href="/" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconArrowRight size={16} className="shrink-0 rotate-180 text-ink-3" /> Back to website
          </Link>
          <MenuSeparator />
          <form action={signOut}>
            <button type="submit" role="menuitem" tabIndex={-1} className={`${menuItemClass} hover:!bg-destructive-wash hover:!text-destructive`}>
              <IconSignOut size={16} className="shrink-0" /> Sign out
            </button>
          </form>
        </>
      )}
    </Dropdown>
  );
}

export function Shell({ user, org, role, orgs, properties, initialCollapsed = false, initialSiteId, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const match = pathname.match(/^\/app\/sites\/([^/]+)(\/.*)?$/);
  const currentId = match?.[1];
  const [lastSiteId, setLastSiteId] = useState(initialSiteId);
  const focusId = [currentId, lastSiteId, properties[0]?.id].find((id) => id && properties.some((p) => p.id === id));

  // A new page: close the phone menu, and remember the site you were in for organization pages.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    if (currentId && currentId !== lastSiteId) setLastSiteId(currentId);
  }
  useEffect(() => {
    if (currentId) document.cookie = `${SITE_COOKIE}=${currentId}; path=/app; max-age=31536000; samesite=lax`;
  }, [currentId]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  const focus = properties.find((p) => p.id === focusId);
  // A site's sections show only on that site's own pages. All sites and the Organization and personal
  // pages show the Organization group alone: a site's sections there would suggest the page belongs to
  // that site, and would contradict the switcher reading "All sites".
  const sitePage = /^\/app\/sites\/[^/]+/.test(pathname);
  const groups: NavGroup[] = [
    ...(focus && sitePage ? siteGroups(focus.id) : []),
    { label: "Organization", tabs: [{ href: "/app", label: "All sites", icon: IconSites, exact: true }, ...orgTabs(role)] },
  ];

  // Breadcrumb trail for every page header: organization, then the site, then the section.
  const resolveTrail = useCallback(
    (path: string): Crumb[] => {
      const root: Crumb = { label: org.name, href: "/app" };
      if (path === "/app") return [{ label: org.name }, { label: "All sites", href: "/app" }];
      const m = path.match(/^\/app\/sites\/([^/]+)/);
      const site = m ? properties.find((p) => p.id === m[1]) : undefined;
      const tabs = [...(site ? siteGroups(site.id).flatMap((g) => g.tabs) : []), ...orgTabs(role), { href: "/app/account", label: "Account", icon: IconLock }];
      const hit = tabs.filter((t) => isActive(t, path)).sort((a, b) => b.href.length - a.href.length)[0];
      const trail: Crumb[] = [root];
      if (site) trail.push({ label: site.name, href: `/app/sites/${site.id}` });
      // the overview's own crumb is the site itself
      if (hit && !(site && hit.href === `/app/sites/${site.id}`)) trail.push({ label: hit.label, href: hit.href });
      return trail;
    },
    [org.name, properties, role],
  );

  const publishControls =
    focus && currentId && can(role, "property:write") ? (
      <div className="flex items-center gap-2.5">
        {focus.dirty ? (
          // same words as the page's publish badge, so the two never disagree
          <span className="hidden items-center gap-1.5 text-xs text-ink-3 lg:inline-flex">
            <span aria-hidden className="size-2 rounded-full border-2 border-amber-bright" />
            {focus.published === false ? "Not published" : "Unpublished changes"}
          </span>
        ) : null}
        {focus.dirty && focus.blocked ? (
          // Publishing would be refused: say why and go straight to the fix, instead of a button that errors.
          <Link
            href={`/app/sites/${focus.id}/banner?tab=review`}
            className="btn btn-secondary btn-sm max-sm:h-11"
            title="A failing fairness check blocks publishing. Open the review step to fix it."
          >
            <span aria-hidden className="size-1.5 rotate-45 bg-destructive" />
            Fix {focus.blocked} check{focus.blocked > 1 ? "s" : ""} to publish
          </Link>
        ) : (
          <PublishButton propertyId={focus.id} dirty={focus.dirty} size="sm" />
        )}
      </div>
    ) : null;

  const nav = (isCollapsed: boolean) => (
    <NavGroups
      groups={groups}
      pathname={pathname}
      collapsed={isCollapsed}
      isActive={isActive}
      siteLabel={focus ? `${focus.name} sections` : undefined}
      empty={
        focus ? null : (
          <Link
            href="/app"
            className={`flex h-10 items-center gap-2 rounded-full text-sm font-medium text-ink ring-1 ring-inset ring-boundary transition-colors duration-150 hover:bg-raised ${isCollapsed ? "justify-center" : "px-3"}`}
          >
            <IconPlus size={16} />
            {isCollapsed ? <span className="sr-only">Add your first site</span> : "Add your first site"}
          </Link>
        )
      }
    />
  );

  return (
    <ToastProvider>
      <ThemeScope />
      <BreadcrumbProvider resolve={resolveTrail}>
        <div className="pt-app min-h-dvh bg-canvas text-ink">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-on-inverse"
          >
            Skip to content
          </a>

          <header className="sticky top-0 z-40 border-b border-line bg-surface print:hidden">
            <div className="flex h-14 items-center gap-1 px-2 sm:gap-1.5 sm:px-4">
              <button
                ref={menuButton}
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="app-menu"
                className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-raised md:hidden"
              >
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <span className="sr-only">Open menu</span>
              </button>
              <Link href="/app" aria-label="Plain Theory dashboard home" className="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-raised">
                <BrandMark size={24} variant="mono" className="text-ink" />
              </Link>

              {/* Where you are: organization / site */}
              <div className="hidden min-w-0 items-center sm:flex">
                <span aria-hidden className="mx-0.5 text-lg font-light text-line-input">
                  /
                </span>
                <OrgSwitcher org={org} orgs={orgs} />
              </div>
              <div className="flex min-w-0 items-center">
                <span aria-hidden className="mx-0.5 hidden text-lg font-light text-line-input sm:inline">
                  /
                </span>
                <SiteSwitcher org={org} properties={properties} focus={focus} onAll={pathname === "/app"} />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <div className="hidden sm:block">{publishControls}</div>
                <Link href="/docs" className="hidden h-10 items-center rounded-full px-3 text-sm text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink lg:inline-flex">
                  Docs
                </Link>
                <UserMenu user={user} org={org} role={role} />
              </div>
            </div>
            {/* phones: the publish controls get their own strip under the bar */}
            {publishControls ? <div className="flex justify-end border-t border-line px-3 py-1.5 sm:hidden">{publishControls}</div> : null}
          </header>

          <div className="flex">
            <NavRail collapsed={collapsed} onToggle={toggleSidebar}>
              {nav(collapsed)}
            </NavRail>
            <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
              <div className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-6 lg:px-8 print:p-0">{children}</div>
            </main>
          </div>

          <NavDrawer
            id="app-menu"
            open={menuOpen}
            onClose={() => {
              setMenuOpen(false);
              menuButton.current?.focus();
            }}
            header={
              <div className="min-w-0 flex-1">
                <OrgSwitcher org={org} orgs={orgs} full />
              </div>
            }
          >
            {nav(false)}
          </NavDrawer>
        </div>
      </BreadcrumbProvider>
    </ToastProvider>
  );
}
