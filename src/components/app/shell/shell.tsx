"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut, switchOrg } from "@/app/app/actions";
import { BrandMark } from "@/components/brand/logo";
import {
  IconAlert,
  IconBalance,
  IconBilling,
  IconBrush,
  IconChain,
  IconCheck,
  IconCode,
  IconInfo,
  IconLock,
  IconInstall,
  IconLogs,
  IconOverview,
  IconPlainText,
  IconPlug,
  IconPlus,
  IconReceipt,
  IconRegion,
  IconScan,
  IconSettings,
  IconShieldCheck,
  IconSignOut,
  IconSites,
  IconTeam,
  type IconProps,
} from "@/components/icons";
import { ToastProvider } from "@/components/app/ui/toast";
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

type Tab = { href: string; label: string; icon: (p: IconProps) => React.ReactNode; exact?: boolean };

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
      { href: `/app/sites/${id}/banner`, label: "Banner", icon: IconBrush },
      { href: `/app/sites/${id}/regions`, label: "Regions", icon: IconRegion },
      { href: `/app/sites/${id}/languages`, label: "Languages", icon: IconPlainText },
      { href: `/app/sites/${id}/trackers`, label: "Trackers", icon: IconScan },
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

/** One sidebar row. Collapsed rows show the icon only, with the label as a tooltip and accessible name. */
function SideLink({ tab, active, collapsed }: { tab: Tab; active: boolean; collapsed: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? tab.label : undefined}
      className={`group/item relative flex h-10 items-center gap-3 rounded-[12px] text-sm transition-[background-color,color,box-shadow] duration-200 ${collapsed ? "justify-center px-0" : "pl-1.5 pr-3"} ${
        active ? "bg-brand-wash font-medium text-brand-ink" : "text-ink-2 hover:bg-paper hover:text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center rounded-[8px] transition-colors duration-200 ${
          active ? "bg-brand text-white shadow-[0_2px_6px_rgb(46_43_214/0.35)]" : "text-ink-3 group-hover/item:bg-surface group-hover/item:text-ink"
        }`}
      >
        <Icon size={16} />
      </span>
      {collapsed ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
        >
          {tab.label}
        </span>
      ) : (
        <span className="truncate">{tab.label}</span>
      )}
    </Link>
  );
}

const isActive = (t: Tab, pathname: string) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));

const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Deterministic two-stop gradient per name, so every org and person has a recognisable avatar. */
function avatarStyle(seed: string): React.CSSProperties {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { background: `linear-gradient(135deg, hsl(${h} 72% 62%), hsl(${(h + 48) % 360} 70% 46%))` };
}

function Avatar({ name, seed, size = 24, square }: { name: string; seed: string; size?: number; square?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-semibold text-white ${square ? "rounded-[6px]" : "rounded-full"}`}
      style={{ ...avatarStyle(seed), width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials(name)}
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

function Slash() {
  return (
    <svg aria-hidden width="16" height="24" viewBox="0 0 16 24" className="shrink-0 text-line-strong">
      <path d="M11 3 5 21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

const barTrigger = "flex h-9 min-w-0 max-w-full items-center gap-2 rounded-[8px] px-2 text-sm font-medium text-ink transition-colors hover:bg-paper aria-expanded:bg-paper";
const panelTrigger =
  "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-sm ring-1 ring-inset ring-line transition-colors hover:bg-paper aria-expanded:bg-paper";

type Variant = "bar" | "panel";

/** Organization switcher: a breadcrumb in the top bar, a full-width row in the mobile menu. */
function OrgSwitcher({ org, orgs, variant }: { org: ShellProps["org"]; orgs: ShellProps["orgs"]; variant: Variant }) {
  const [, startTransition] = useTransition();
  return (
    <Dropdown
      label={`Organization: ${org.name}. Switch organization`}
      triggerClassName={variant === "bar" ? barTrigger : panelTrigger}
      trigger={
        <>
          <Avatar name={org.name} seed={org.id} size={variant === "bar" ? 22 : 28} square />
          {variant === "bar" ? (
            <>
              <span className="truncate">{org.name}</span>
              <span className="hidden shrink-0 rounded-full bg-paper px-2 py-0.5 text-2xs font-medium capitalize text-ink-2 ring-1 ring-inset ring-line md:inline">{org.plan}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{org.name}</span>
              <span className="block truncate text-xs capitalize text-ink-3">{org.plan} plan</span>
            </span>
          )}
          <UpDown />
        </>
      }
    >
      {(close) => (
        <>
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">Organizations</p>
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
              <Avatar name={o.name} seed={o.id} size={22} square />
              <span className="truncate text-ink">{o.name}</span>
              {o.id === org.id ? <IconCheck size={16} className="ml-auto text-ink" /> : null}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link href="/onboarding/new" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconPlus size={16} /> Create organization
          </Link>
        </>
      )}
    </Dropdown>
  );
}

/** Site switcher for the site you're working on; switching keeps you on the same section. */
function SiteSwitcher({
  org,
  properties,
  focus,
  onAll,
  variant,
}: {
  org: ShellProps["org"];
  properties: ShellProps["properties"];
  focus: ShellProps["properties"][number];
  /** on the "All sites" page the crumb names that page instead of a site */
  onAll: boolean;
  variant: Variant;
}) {
  const router = useRouter();
  return (
    <Dropdown
      label={onAll ? "All sites. Switch site" : `Site: ${focus.name}. Switch site`}
      triggerClassName={variant === "bar" ? barTrigger : panelTrigger}
      trigger={
        <>
          {variant === "panel" ? (
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-brand-wash text-brand">
              <IconSites size={16} />
            </span>
          ) : null}
          {variant === "bar" ? (
            <span className="truncate">{onAll ? "All sites" : focus.name}</span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{onAll ? "All sites" : focus.name}</span>
              <span className="block truncate text-xs text-ink-3">{onAll ? `${properties.length} in ${org.name}` : focus.domain}</span>
            </span>
          )}
          <UpDown />
        </>
      }
    >
      {(close) => (
        <>
          <Link href="/app" role="menuitemradio" aria-checked={onAll} tabIndex={-1} onClick={close} className={menuItemClass}>
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-paper text-ink-2 ring-1 ring-inset ring-line">
              <IconSites size={16} />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">All sites</span>
              <span className="block text-xs text-ink-3">Status and numbers for every site</span>
            </span>
            {onAll ? <IconCheck size={16} className="ml-auto shrink-0 text-brand" /> : null}
          </Link>
          <div className="my-1 h-px bg-line" />
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">Sites in {org.name}</p>
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
                  // a newly chosen site opens on its overview
                  router.push(`/app/sites/${p.id}`);
                }}
                className={menuItemClass}
              >
                <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-[7px] text-2xs font-semibold ${current ? "bg-brand text-white" : "bg-brand-wash text-brand-ink"}`}>
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-ink-3">{p.domain}</span>
                </span>
                {current ? <IconCheck size={16} className="ml-auto shrink-0 text-brand" /> : null}
              </button>
            );
          })}
          <div className="my-1 h-px bg-line" />
          <Link href="/app" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
            <IconPlus size={16} /> Add a site
          </Link>
        </>
      )}
    </Dropdown>
  );
}

interface NavProps {
  org: ShellProps["org"];
  orgs: ShellProps["orgs"];
  role: Role;
  properties: ShellProps["properties"];
  /** the site whose sections the sidebar shows: the one open now, else the last one visited */
  focusId?: string;
  pathname: string;
  collapsed: boolean;
  /** the mobile menu repeats the switchers, which live in the top bar on wider screens */
  switchers?: boolean;
}

/**
 * The dashboard's sections, identical on every page: the site you're working on, then the
 * organization's own pages. The organization and site switchers live in the top bar.
 */
function SidebarNav({ org, orgs, role, properties, focusId, pathname, collapsed, switchers = false }: NavProps) {
  const focus = properties.find((p) => p.id === focusId);
  const divider = <div aria-hidden className={`my-3 h-px bg-line ${collapsed ? "mx-auto w-6" : "mx-3"}`} />;

  return (
    <>
      {switchers ? (
        <div className="mb-6 space-y-2">
          <OrgSwitcher org={org} orgs={orgs} variant="panel" />
          {focus ? <SiteSwitcher org={org} properties={properties} focus={focus} onAll={pathname === "/app"} variant="panel" /> : null}
        </div>
      ) : null}

      {/* The site you're working on */}
      {focus ? (
        <nav aria-label={`${focus.name} sections`}>
          {/* Groups are separated by space alone (proximity), with no headings to read past. */}
          <div className="space-y-4">
            {siteGroups(focus.id).map((g, i) => (
              <ul key={i} aria-label={g.label} className="space-y-0.5">
                {g.tabs.map((t) => (
                  <li key={t.href}>
                    <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </nav>
      ) : (
        <Link
          href="/app"
          className={`flex h-10 items-center gap-2.5 rounded-[10px] text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 hover:bg-brand-wash ${collapsed ? "justify-center" : "px-2.5"}`}
        >
          <IconPlus size={16} />
          {collapsed ? <span className="sr-only">Add your first site</span> : "Add your first site"}
        </Link>
      )}

      {/* The organization's own pages */}
      {divider}
      <nav aria-label="Organization">
        <ul className="space-y-0.5">
          {orgTabs(role).map((t) => (
            <li key={t.href}>
              <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
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
  const nav = (isCollapsed: boolean, switchers = false) => (
    <SidebarNav org={org} orgs={orgs} role={role} properties={properties} focusId={focusId} pathname={pathname} collapsed={isCollapsed} switchers={switchers} />
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-paper">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md print:hidden">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              className="grid size-11 place-items-center rounded-[10px] text-ink hover:bg-paper lg:hidden"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span className="sr-only">Open menu</span>
            </button>
            <Link href="/app" aria-label="Dashboard home" className="grid size-9 shrink-0 place-items-center rounded-[8px] hover:bg-paper">
              <BrandMark size={24} />
            </Link>

            {/* Where you are: organization / site. On phones these sit at the top of the menu instead. */}
            <nav aria-label="Workspace" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
              <Slash />
              <div className="min-w-0">
                <OrgSwitcher org={org} orgs={orgs} variant="bar" />
              </div>
              {focus ? (
                <>
                  <Slash />
                  <div className="min-w-0">
                    <SiteSwitcher org={org} properties={properties} focus={focus} onAll={pathname === "/app"} variant="bar" />
                  </div>
                </>
              ) : null}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* Publishing is one action for the whole site, so it has one home: here, beside the site it publishes. */}
              {focus && currentId && can(role, "property:write") ? (
                <div className="mr-2 flex items-center gap-2.5 border-r border-line pr-3">
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
              ) : null}
              <Link href="/docs" className="hidden h-9 items-center rounded-[8px] px-3 text-sm text-ink-2 transition-colors hover:bg-paper hover:text-ink sm:inline-flex">
                Docs
              </Link>
              <Link href="/contact/support" className="hidden h-9 items-center rounded-[8px] px-3 text-sm text-ink-2 transition-colors hover:bg-paper hover:text-ink md:inline-flex">
                Help
              </Link>
              <Dropdown
                label="Account menu"
                align="right"
                width="w-72"
                triggerClassName="grid size-9 place-items-center rounded-full transition-shadow hover:shadow-[0_0_0_3px_var(--color-line)] aria-expanded:shadow-[0_0_0_3px_var(--color-line)]"
                trigger={<Avatar name={user.name} seed={user.email} size={30} />}
              >
                {(close) => (
                  <>
                    <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
                      <Avatar name={user.name} seed={user.email} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                        <p className="truncate text-xs text-ink-3">{user.email}</p>
                        <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 text-2xs font-medium text-brand-ink">
                          <span className="capitalize">{role}</span>
                          <span className="truncate text-brand-ink/70">· {org.name}</span>
                        </p>
                      </div>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/app/account" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      <IconLock size={16} className="shrink-0 text-ink-3" /> Account and security
                    </Link>
                    <Link href="/app/team" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      <IconTeam size={16} className="shrink-0 text-ink-3" /> Team
                    </Link>
                    {can(role, "billing:manage") ? (
                      <Link href="/app/billing" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                        <IconBilling size={16} className="shrink-0 text-ink-3" /> Billing and plan
                      </Link>
                    ) : null}
                    <Link href="/app/settings" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      <IconSettings size={16} className="shrink-0 text-ink-3" /> Organization settings
                    </Link>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/docs" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      <IconCode size={16} className="shrink-0 text-ink-3" /> Documentation
                    </Link>
                    <Link href="/contact/support" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      <IconInfo size={16} className="shrink-0 text-ink-3" /> Get support
                    </Link>
                    <div className="my-1 h-px bg-line" />
                    <form action={signOut}>
                      <button type="submit" role="menuitem" tabIndex={-1} className={`${menuItemClass} hover:!bg-rose-wash hover:!text-rose`}>
                        <IconSignOut size={16} className="shrink-0" /> Sign out
                      </button>
                    </form>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        </header>

        {/* Phones and tablets: the same navigation as a sheet */}
        <div id="app-menu" role="dialog" aria-modal="true" aria-label="Menu" hidden={!menuOpen} className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col bg-surface shadow-[var(--shadow-float)]">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3">
              <span className="flex items-center gap-2 px-1.5 text-sm font-semibold">
                <BrandMark size={22} /> Plain Theory
              </span>
              <button ref={closeRef} type="button" onClick={() => setMenuOpen(false)} className="grid size-11 place-items-center rounded-[10px] text-ink hover:bg-paper">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-3 py-4">{nav(false, true)}</div>
          </div>
        </div>

        <div className="flex">
          {/* Desktop: collapsible sidebar */}
          <aside
            id="app-sidebar"
            aria-label="Dashboard navigation"
            className={`sticky top-14 z-30 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex print:hidden ${
              collapsed ? "w-[64px]" : "w-[248px]"
            }`}
          >
            {/* Collapse handle: a small circle on the sidebar's edge, centred vertically */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute -right-3.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink-3 shadow-[0_1px_3px_rgb(11_16_32/0.12)] ring-1 ring-line transition-[color,box-shadow,transform] duration-200 hover:text-brand hover:shadow-[0_2px_8px_rgb(46_43_214/0.25)] hover:ring-brand/30 active:scale-95"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
            </button>
            <div className="scroll-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">{nav(collapsed)}</div>
          </aside>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8 print:p-0">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
