"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut, switchOrg } from "@/app/app/actions";
import { AppIcon } from "@/components/brand/logo";
import {
  IconAlert,
  IconBalance,
  IconBilling,
  IconBook,
  IconBrush,
  IconChain,
  IconCheck,
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
  type IconProps,
} from "@/components/icons";
import { ToastProvider } from "@/components/app/ui/toast";
import { ThemeScope, ThemeToggle } from "@/components/theme/theme";
import { can } from "@/lib/auth/rbac";
import type { Role } from "@/lib/types";
import { PublishButton } from "@/components/app/sites/publish-button";
import { Dropdown, menuItemClass } from "./dropdown";

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

type Tab = { href: string; label: string; icon: (p: IconProps) => React.ReactNode; exact?: boolean; };

type TabGroup = { label?: string; tabs: Tab[] };

/** Site sections, grouped by job: see the site, configure what visitors get, prove what happened. */
const siteGroups = (id: string): TabGroup[] => [
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

const orgTabs = (role: Role): Tab[] => [
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

const isActive = (t: Tab, pathname: string) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));

const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Deterministic hue per name, so every org and person has a recognisable (and quiet) avatar. */
function hueOf(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function Avatar({ name, seed, size = 24, square }: { name: string; seed: string; size?: number; square?: boolean }) {
  const h = hueOf(seed);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ${square ? "rounded-[6px]" : "rounded-full"}`}
      style={{ background: `linear-gradient(140deg, hsl(${h} 62% 58%), hsl(${(h + 40) % 360} 58% 42%))`, width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials(name)}
    </span>
  );
}

function UpDown() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="ml-auto shrink-0 text-ink-3">
      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One sidebar row. Collapsed rows show the icon only, with the label as a tooltip and accessible name. */
function SideLink({ tab, active, collapsed }: { tab: Tab; active: boolean; collapsed: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? tab.label : undefined}
      className={`group/item relative flex h-8 items-center gap-2.5 rounded-[7px] text-[0.8125rem] transition-colors duration-150 ${collapsed ? "justify-center px-0" : "px-2"} ${
        active ? "bg-paper font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-paper/70 hover:text-ink"
      }`}
    >
      {active ? <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand" /> : null}
      <Icon size={16} aria-hidden className={`shrink-0 transition-colors ${active ? "text-brand" : "text-ink-3 group-hover/item:text-ink-2"}`} />
      {collapsed ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[6px] bg-inverse px-2 py-1 text-xs font-medium text-on-inverse opacity-0 shadow-[var(--shadow-lift)] transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
        >
          {tab.label}
        </span>
      ) : (
        <span className="truncate">{tab.label}</span>
      )}
    </Link>
  );
}

const switcherTrigger =
  "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[8px] px-1.5 text-left text-sm transition-colors hover:bg-paper aria-expanded:bg-paper";

/** Organization switcher at the top of the sidebar (and the mobile menu). */
function OrgSwitcher({ org, orgs, collapsed }: { org: ShellProps["org"]; orgs: ShellProps["orgs"]; collapsed?: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <Dropdown
      label={`Organization: ${org.name}. Switch organization`}
      triggerClassName={collapsed ? "grid size-9 place-items-center rounded-[8px] hover:bg-paper aria-expanded:bg-paper" : switcherTrigger}
      trigger={
        collapsed ? (
          <Avatar name={org.name} seed={org.id} size={24} square />
        ) : (
          <>
            <Avatar name={org.name} seed={org.id} size={26} square />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-ink">{org.name}</span>
              <span className="block truncate text-[0.6875rem] capitalize leading-tight text-ink-3">{org.plan} plan</span>
            </span>
            <UpDown />
          </>
        )
      }
    >
      {(close) => (
        <>
          <p className="eyebrow px-2.5 pb-1 pt-1.5">Organizations</p>
          {orgs.map((o) => (
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
              <Avatar name={o.name} seed={o.id} size={20} square />
              <span className="truncate text-ink">{o.name}</span>
              {o.id === org.id ? <IconCheck size={15} className="ml-auto text-brand" /> : null}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link href="/onboarding/new" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconPlus size={15} /> Create organization
          </Link>
        </>
      )}
    </Dropdown>
  );
}

/** Site switcher: the site whose sections the sidebar lists. Switching opens the site's overview. */
function SiteSwitcher({ org, properties, focus, onAll }: { org: ShellProps["org"]; properties: ShellProps["properties"]; focus: ShellProps["properties"][number]; onAll: boolean }) {
  const router = useRouter();
  return (
    <Dropdown
      label={onAll ? "All sites. Switch site" : `Site: ${focus.name}. Switch site`}
      triggerClassName="flex w-full min-w-0 items-center gap-2.5 rounded-[8px] border border-line bg-surface px-2 py-1.5 text-left shadow-[var(--shadow-edge)] transition-colors hover:border-line-strong aria-expanded:border-line-strong"
      trigger={
        <>
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-brand-wash font-mono text-[0.6875rem] font-semibold text-brand-ink">
            {onAll ? <IconSites size={14} /> : focus.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium leading-tight text-ink">{onAll ? "All sites" : focus.name}</span>
            <span className="block truncate font-mono text-[0.6875rem] leading-tight text-ink-3">{onAll ? `${properties.length} in ${org.name}` : focus.domain}</span>
          </span>
          {!onAll && focus.dirty ? <span aria-hidden title="Unpublished changes" className="size-1.5 shrink-0 rounded-full bg-amber-bright" /> : null}
          <UpDown />
        </>
      }
    >
      {(close) => (
        <>
          <Link href="/app" role="menuitemradio" aria-checked={onAll} tabIndex={-1} onClick={close} className={menuItemClass}>
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-paper text-ink-2 ring-1 ring-inset ring-line">
              <IconSites size={14} />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">All sites</span>
              <span className="block text-xs text-ink-3">Every site at a glance</span>
            </span>
            {onAll ? <IconCheck size={15} className="ml-auto shrink-0 text-brand" /> : null}
          </Link>
          <div className="my-1 h-px bg-line" />
          <p className="eyebrow px-2.5 pb-1 pt-1.5">Sites</p>
          {properties.map((p) => {
            const current = !onAll && p.id === focus.id;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                tabIndex={-1}
                onClick={() => {
                  close();
                  router.push(`/app/sites/${p.id}`);
                }}
                className={menuItemClass}
              >
                <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-[6px] font-mono text-[0.6875rem] font-semibold ${current ? "bg-brand-solid text-white" : "bg-brand-wash text-brand-ink"}`}>
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{p.name}</span>
                  <span className="block truncate font-mono text-[0.6875rem] text-ink-3">{p.domain}</span>
                </span>
                {current ? <IconCheck size={15} className="ml-auto shrink-0 text-brand" /> : null}
              </button>
            );
          })}
          <div className="my-1 h-px bg-line" />
          <Link href="/app" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconPlus size={15} /> Add a site
          </Link>
        </>
      )}
    </Dropdown>
  );
}

function UserMenu({ user, org, role, collapsed }: { user: ShellProps["user"]; org: ShellProps["org"]; role: Role; collapsed: boolean }) {
  return (
    <Dropdown
      label="Account menu"
      side="top"
      width="w-72"
      triggerClassName={collapsed ? "grid size-9 place-items-center rounded-full hover:bg-paper aria-expanded:bg-paper" : switcherTrigger}
      trigger={
        collapsed ? (
          <Avatar name={user.name} seed={user.email} size={26} />
        ) : (
          <>
            <Avatar name={user.name} seed={user.email} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium leading-tight text-ink">{user.name}</span>
              <span className="block truncate text-[0.6875rem] capitalize leading-tight text-ink-3">{role}</span>
            </span>
            <UpDown />
          </>
        )
      }
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <Avatar name={user.name} seed={user.email} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
              <p className="mt-1 truncate text-[0.6875rem] text-ink-3">
                <span className="capitalize text-ink-2">{role}</span> at {org.name}
              </p>
            </div>
          </div>
          <div className="px-2.5 pb-2">
            <ThemeToggle className="w-full" />
          </div>
          <div className="my-1 h-px bg-line" />
          <Link href="/app/account" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconLock size={15} className="shrink-0 text-ink-3" /> Account and security
          </Link>
          {can(role, "billing:manage") ? (
            <Link href="/app/billing" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
              <IconBilling size={15} className="shrink-0 text-ink-3" /> Billing and plan
            </Link>
          ) : null}
          <Link href="/docs" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconBook size={15} className="shrink-0 text-ink-3" /> Documentation
          </Link>
          <Link href="/contact?topic=support" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconInfo size={15} className="shrink-0 text-ink-3" /> Get support
          </Link>
          <div className="my-1 h-px bg-line" />
          <form action={signOut}>
            <button type="submit" role="menuitem" tabIndex={-1} className={`${menuItemClass} hover:!bg-rose-wash hover:!text-rose`}>
              <IconSignOut size={15} className="shrink-0" /> Sign out
            </button>
          </form>
        </>
      )}
    </Dropdown>
  );
}

interface NavProps {
  org: ShellProps["org"];
  role: Role;
  properties: ShellProps["properties"];
  /** the site whose sections the sidebar shows: the one open now, else the last one visited */
  focusId?: string;
  pathname: string;
  collapsed: boolean;
}

/** The dashboard's sections: the site you're working on, then the organization's own pages. */
function SidebarNav({ org, role, properties, focusId, pathname, collapsed }: NavProps) {
  const focus = properties.find((p) => p.id === focusId);
  return (
    <>
      {focus ? (
        <>
          {collapsed ? null : (
            <div className="mb-4">
              <SiteSwitcher org={org} properties={properties} focus={focus} onAll={pathname === "/app"} />
            </div>
          )}
          <nav aria-label={`${focus.name} sections`} className="space-y-4">
            {siteGroups(focus.id).map((g, i) => (
              <div key={i}>
                {g.label && !collapsed ? <p className="eyebrow mb-1 px-2">{g.label}</p> : null}
                {g.label && collapsed ? <div aria-hidden className="mx-auto mb-2 h-px w-5 bg-line" /> : null}
                <ul aria-label={g.label} className="space-y-px">
                  {g.tabs.map((t) => (
                    <li key={t.href}>
                      <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </>
      ) : (
        <Link
          href="/app"
          className={`flex h-9 items-center gap-2 rounded-[8px] border border-dashed border-brand/40 text-[0.8125rem] font-medium text-brand hover:bg-brand-wash ${collapsed ? "justify-center" : "px-2.5"}`}
        >
          <IconPlus size={15} />
          {collapsed ? <span className="sr-only">Add your first site</span> : "Add your first site"}
        </Link>
      )}

      <div className="mt-5">
        {collapsed ? <div aria-hidden className="mx-auto mb-2 h-px w-5 bg-line" /> : <p className="eyebrow mb-1 px-2">Organization</p>}
        <nav aria-label="Organization">
          <ul className="space-y-px">
            {orgTabs(role).map((t) => (
              <li key={t.href}>
                <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

/** Label of the section that the current path is in, for the top bar's breadcrumb. */
function sectionLabel(pathname: string, siteId: string | undefined, role: Role): string | null {
  const tabs = [...(siteId ? siteGroups(siteId).flatMap((g) => g.tabs) : []), ...orgTabs(role), { href: "/app/account", label: "Account", icon: IconLock }];
  const hit = tabs.filter((t) => isActive(t, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? null;
}

export function Shell({ user, org, role, orgs, properties, initialCollapsed = false, initialSiteId, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const match = pathname.match(/^\/app\/sites\/([^/]+)(\/.*)?$/);
  const currentId = match?.[1];
  const [lastSiteId, setLastSiteId] = useState(initialSiteId);
  const focusId = [currentId, lastSiteId, properties[0]?.id].find((id) => id && properties.some((p) => p.id === id));

  // A new page: close the mobile menu, and remember the site you were in for organization pages.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    if (currentId && currentId !== lastSiteId) setLastSiteId(currentId);
  }
  useEffect(() => {
    if (currentId) document.cookie = `${SITE_COOKIE}=${currentId}; path=/app; max-age=31536000; samesite=lax`;
  }, [currentId]);

  // The mobile menu is a modal sheet: lock the page behind it; Escape closes it.
  useEffect(() => {
    if (!menuOpen) return;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  const focus = properties.find((p) => p.id === focusId);
  const section = sectionLabel(pathname, focusId, role);

  const publishControls =
    focus && currentId && can(role, "property:write") ? (
      <div className="flex items-center gap-2.5">
        {focus.dirty ? (
          // same words as the page's publish badge, so the two never disagree
          <span className="hidden items-center gap-1.5 text-xs text-ink-3 md:inline-flex">
            <span aria-hidden className="size-1.5 rounded-full bg-amber-bright" />
            {focus.published === false ? "Not published" : "Unpublished changes"}
          </span>
        ) : null}
        {focus.dirty && focus.blocked ? (
          // Publishing would be refused: say why and go straight to the fix, instead of a button that errors.
          <Link
            href={`/app/sites/${focus.id}/banner?tab=review`}
            className="btn btn-ghost btn-sm max-sm:h-11"
            title="A failing fairness check blocks publishing. Open the review step to fix it."
          >
            <span aria-hidden className="size-1.5 rounded-full bg-rose" />
            Fix {focus.blocked} check{focus.blocked > 1 ? "s" : ""} to publish
          </Link>
        ) : (
          <PublishButton propertyId={focus.id} dirty={focus.dirty} size="sm" />
        )}
      </div>
    ) : null;

  const sidebarBody = (isCollapsed: boolean) => (
    <>
      <div className={`flex shrink-0 items-center gap-1 ${isCollapsed ? "flex-col px-2 pt-3" : "px-3 pt-3"}`}>
        <div className={isCollapsed ? "" : "min-w-0 flex-1"}>
          <OrgSwitcher org={org} orgs={orgs} collapsed={isCollapsed} />
        </div>
      </div>
      <div className={`scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-4 ${isCollapsed ? "px-2.5" : "px-3"}`}>
        <SidebarNav org={org} role={role} properties={properties} focusId={focusId} pathname={pathname} collapsed={isCollapsed} />
      </div>
      <div className={`shrink-0 border-t border-line ${isCollapsed ? "flex justify-center px-2 py-2.5" : "px-3 py-2.5"}`}>
        <UserMenu user={user} org={org} role={role} collapsed={isCollapsed} />
      </div>
    </>
  );

  return (
    <ToastProvider>
      <ThemeScope />
      <div className="flex min-h-dvh bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-on-inverse"
        >
          Skip to content
        </a>

        {/* Desktop: full-height, collapsible sidebar */}
        <aside
          id="app-sidebar"
          aria-label="Dashboard navigation"
          className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex print:hidden ${collapsed ? "w-[60px]" : "w-[252px]"}`}
        >
          {sidebarBody(collapsed)}
          {/* Collapse handle on the sidebar's edge */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-[4.25rem] z-10 grid size-6 place-items-center rounded-full border border-line bg-surface text-ink-3 shadow-[var(--shadow-lift)] transition-[color,transform] duration-200 hover:text-brand active:scale-95"
          >
            <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
        </aside>

        {/* Phones and tablets: the same navigation as a sheet */}
        <div id="app-menu" role="dialog" aria-modal="true" aria-label="Menu" hidden={!menuOpen} className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#05070d]/50" />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,88vw)] flex-col bg-surface shadow-[var(--shadow-float)]">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
              <span className="flex items-center gap-2 px-1 text-sm font-semibold">
                <AppIcon size={22} /> Plain Theory
              </span>
              <button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center rounded-[8px] text-ink hover:bg-paper">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{sidebarBody(false)}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md print:hidden">
            <div className="flex h-12 items-center gap-2 px-3 sm:px-5">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="app-menu"
                className="grid size-10 place-items-center rounded-[8px] text-ink hover:bg-paper lg:hidden"
              >
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <span className="sr-only">Open menu</span>
              </button>
              <Link href="/app" aria-label="Dashboard home" className="grid size-8 shrink-0 place-items-center rounded-[7px] hover:bg-paper">
                <AppIcon size={22} />
              </Link>

              {/* Where you are */}
              <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 sm:block">
                <ol className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
                  <li className="truncate text-ink-3">{org.name}</li>
                  {focus && currentId ? (
                    <>
                      <li aria-hidden className="text-line-strong">
                        /
                      </li>
                      <li className="min-w-0 truncate">
                        <Link href={`/app/sites/${focus.id}`} className="text-ink-3 transition-colors hover:text-ink">
                          {focus.name}
                        </Link>
                      </li>
                    </>
                  ) : null}
                  {section ? (
                    <>
                      <li aria-hidden className="text-line-strong">
                        /
                      </li>
                      <li aria-current="page" className="truncate font-medium text-ink">
                        {section}
                      </li>
                    </>
                  ) : pathname === "/app" ? (
                    <>
                      <li aria-hidden className="text-line-strong">
                        /
                      </li>
                      <li aria-current="page" className="truncate font-medium text-ink">
                        All sites
                      </li>
                    </>
                  ) : null}
                </ol>
              </nav>
              <div className="flex-1 sm:hidden" />

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {publishControls}
                <Link href="/docs" className="hidden h-8 items-center rounded-[7px] px-2.5 text-[0.8125rem] text-ink-3 transition-colors hover:bg-paper hover:text-ink md:inline-flex">
                  Docs
                </Link>
              </div>
            </div>
          </header>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
            <div className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-6 lg:px-8 print:p-0">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
