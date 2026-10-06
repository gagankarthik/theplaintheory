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
import type { Role } from "@/lib/types";
import { Dropdown, menuItemClass } from "./dropdown";

interface ShellProps {
  user: { name: string; email: string };
  org: { id: string; name: string; plan: string };
  role: Role;
  orgs: { id: string; name: string }[];
  properties: { id: string; name: string; domain: string; dirty: boolean }[];
  /** read from the `pt-sidebar` cookie on the server so the first paint has the right width */
  initialCollapsed?: boolean;
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

const siteTabs = (id: string): Tab[] => siteGroups(id).flatMap((g) => g.tabs);

const orgTabs = (role: Role): Tab[] => [
  { href: "/app", label: "Sites", icon: IconSites, exact: true },
  { href: "/app/team", label: "Team", icon: IconTeam },
  { href: "/app/billing", label: "Billing", icon: IconBilling },
  { href: "/app/settings", label: "Settings", icon: IconSettings },
  // the audit trail and control status are for owners and admins (rbac "audit:read")
  ...(role === "viewer"
    ? []
    : [
        { href: "/app/audit", label: "Audit log", icon: IconChain },
        { href: "/app/security", label: "Security", icon: IconShieldCheck },
      ]),
];

export const SIDEBAR_COOKIE = "pt-sidebar";

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <path d={collapsed ? "M13 10l2 2-2 2" : "M15 10l-2 2 2 2"} />
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
      className={`group/item relative flex h-9 items-center gap-3 rounded-[8px] text-sm transition-colors ${collapsed ? "justify-center px-0" : "px-2.5"} ${
        active ? "bg-paper font-medium text-ink" : "text-ink-2 hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon size={18} className={`shrink-0 ${active ? "text-ink" : "text-ink-3 group-hover/item:text-ink-2"}`} />
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

function Slash() {
  return (
    <svg aria-hidden width="16" height="24" viewBox="0 0 16 24" className="shrink-0 text-line-strong">
      <path d="M11 3 5 21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function UpDown() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="shrink-0 text-ink-3">
      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const crumbTrigger =
  "flex h-9 min-w-0 max-w-full items-center gap-2 rounded-[8px] px-2 text-sm font-medium text-ink transition-colors hover:bg-paper aria-expanded:bg-paper";

export function Shell({ user, org, role, orgs, properties, initialCollapsed = false, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const tabsRef = useRef<HTMLDivElement>(null);

  const match = pathname.match(/^\/app\/sites\/([^/]+)(\/.*)?$/);
  const currentId = match?.[1];
  const subpath = match?.[2] ?? "";
  const current = properties.find((p) => p.id === currentId);
  const tabs = currentId ? siteTabs(currentId) : orgTabs(role);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  // Keep the active tab visible when tabs overflow on small screens.
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-paper">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        {/* Top row: logo / organization / site, account on the right */}
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md print:hidden">
          <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
            <Link href="/app" aria-label="Dashboard home" className="grid size-9 shrink-0 place-items-center rounded-[8px] hover:bg-paper">
              <BrandMark size={24} />
            </Link>
            <Slash />

            <nav aria-label="Workspace" className="flex min-w-0 flex-1 items-center gap-1">
              <div className={`min-w-0 ${currentId ? "hidden sm:block" : ""}`}>
                <Dropdown
                  label={`Organization: ${org.name}. Switch organization`}
                  triggerClassName={crumbTrigger}
                  trigger={
                    <>
                      <Avatar name={org.name} seed={org.id} size={22} square />
                      <span className="truncate">{org.name}</span>
                      <span className="hidden shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium capitalize text-ink-2 ring-1 ring-inset ring-line md:inline">
                        {org.plan}
                      </span>
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
              </div>

              {currentId ? (
                <>
                  <span className="hidden sm:block">
                    <Slash />
                  </span>
                  <div className="min-w-0">
                    <Dropdown
                      label={`Site: ${current?.name ?? "unknown"}. Switch site`}
                      triggerClassName={crumbTrigger}
                      trigger={
                        <>
                          <span className="truncate">{current?.name ?? "Site"}</span>
                          {current?.dirty ? (
                            <span className="hidden shrink-0 rounded-full bg-amber-wash px-2 py-0.5 text-[11px] font-medium text-amber md:inline">Draft</span>
                          ) : null}
                          <UpDown />
                        </>
                      }
                    >
                      {(close) => (
                        <>
                          <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">Sites in {org.name}</p>
                          {properties.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={p.id === currentId}
                              tabIndex={-1}
                              onClick={() => {
                                close();
                                router.push(`/app/sites/${p.id}${subpath}`);
                              }}
                              className={menuItemClass}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-ink">{p.name}</span>
                                <span className="block truncate text-xs text-ink-3">{p.domain}</span>
                              </span>
                              {p.id === currentId ? <IconCheck size={16} className="ml-auto shrink-0 text-ink" /> : null}
                            </button>
                          ))}
                          <div className="my-1 h-px bg-line" />
                          <Link href="/app" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                            All sites
                          </Link>
                        </>
                      )}
                    </Dropdown>
                  </div>
                </>
              ) : null}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Link href="/docs" className="hidden h-9 items-center rounded-[8px] px-3 text-sm text-ink-2 transition-colors hover:bg-paper hover:text-ink sm:inline-flex">
                Docs
              </Link>
              <a
                href="mailto:support@theplaintheory.com"
                className="hidden h-9 items-center rounded-[8px] px-3 text-sm text-ink-2 transition-colors hover:bg-paper hover:text-ink md:inline-flex"
              >
                Help
              </a>
              <Dropdown
                label="Account menu"
                align="right"
                width="w-64"
                triggerClassName="grid size-9 place-items-center rounded-full transition-shadow hover:shadow-[0_0_0_3px_var(--color-line)] aria-expanded:shadow-[0_0_0_3px_var(--color-line)]"
                trigger={<Avatar name={user.name} seed={user.email} size={30} />}
              >
                {(close) => (
                  <>
                    <div className="px-2.5 pb-2 pt-1.5">
                      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-3">{user.email}</p>
                      <p className="mt-1 text-xs capitalize text-ink-3">
                        {role} in {org.name}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/app" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      Dashboard
                    </Link>
                    <Link href="/app/account" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      Account and sign-in security
                    </Link>
                    <Link href="/app/settings" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      Organization settings
                    </Link>
                    <Link href="/docs" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      Documentation
                    </Link>
                    <Link href="/" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                      Home page
                    </Link>
                    <div className="my-1 h-px bg-line" />
                    <form action={signOut}>
                      <button type="submit" role="menuitem" tabIndex={-1} className={menuItemClass}>
                        <IconSignOut size={16} /> Sign out
                      </button>
                    </form>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        </header>

        {/* Mobile and tablet: sections as scrollable tabs */}
        <div className="sticky top-14 z-30 border-b border-line bg-surface/90 backdrop-blur-md lg:hidden print:hidden">
          <nav
            ref={tabsRef}
            aria-label={currentId ? "Site sections" : "Organization sections"}
            className="-mb-px flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((t) => {
              const active = isActive(t, pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-12 shrink-0 items-center px-0.5 text-sm transition-colors ${active ? "text-ink" : "text-ink-3 hover:text-ink"}`}
                >
                  <span className="rounded-[6px] px-2.5 py-1.5 transition-colors group-hover:bg-paper">{t.label}</span>
                  <span aria-hidden className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink ${active ? "opacity-100" : "opacity-0"}`} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex">
          {/* Desktop: collapsible sidebar */}
          <aside
            id="app-sidebar"
            aria-label="Sections"
            className={`sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex print:hidden ${
              collapsed ? "w-[60px]" : "w-[232px]"
            }`}
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
              {currentId ? (
                <nav aria-label="Site sections">
                  <p className={`mb-1.5 truncate px-2.5 text-xs text-ink-3 ${collapsed ? "sr-only" : ""}`}>{current?.name ?? "Site"}</p>
                  {siteGroups(currentId).map((g, gi) => (
                    <div key={g.label ?? gi} className={gi ? "mt-4" : ""}>
                      {g.label ? (
                        collapsed ? (
                          <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line" />
                        ) : (
                          <p className="mb-1 px-2.5 text-[11px] font-medium text-ink-3">{g.label}</p>
                        )
                      ) : null}
                      <ul className="space-y-0.5" aria-label={g.label}>
                        {g.tabs.map((t) => (
                          <li key={t.href}>
                            <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              ) : null}
              <nav aria-label="Organization sections" className={currentId ? "mt-6" : ""}>
                {collapsed && currentId ? <div aria-hidden className="mx-auto mb-3 h-px w-6 bg-line" /> : null}
                <p className={`mb-1.5 truncate px-2.5 text-xs text-ink-3 ${collapsed ? "sr-only" : ""}`}>{org.name}</p>
                <ul className="space-y-0.5">
                  {orgTabs(role).map((t) => (
                    <li key={t.href}>
                      <SideLink tab={t} active={isActive(t, pathname)} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="border-t border-line p-2.5">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-expanded={!collapsed}
                aria-controls="app-sidebar"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`flex h-9 w-full items-center gap-3 rounded-[8px] text-sm text-ink-3 transition-colors hover:bg-paper hover:text-ink ${collapsed ? "justify-center" : "px-2.5"}`}
              >
                <SidebarToggleIcon collapsed={collapsed} />
                {collapsed ? null : <span>Collapse</span>}
              </button>
            </div>
          </aside>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8 print:p-0">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
