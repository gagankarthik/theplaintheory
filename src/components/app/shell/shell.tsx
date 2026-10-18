"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { signOut, switchOrg } from "@/app/app/actions";
import { BrandMark } from "@/components/brand/logo";
import {
  IconAlert,
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
  IconPlug,
  IconPlus,
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
import { Dropdown, MenuLabel, MenuSeparator, menuItemClass } from "./dropdown";
import { NavDrawer, NavGroups, NavRail, type NavGroup, type NavTab } from "./nav";
import { RefreshWhile } from "@/components/app/sites/refresh-while";

/** How far the site in focus has got with setup (its Overview carries the full checklist). */
export interface SetupSummary {
  siteId: string;
  name: string;
  done: number;
  total: number;
  next: { title: string; href: string } | null;
  /** a scan is running for this site */
  scanning?: boolean;
}

interface ShellProps {
  user: { name: string; email: string };
  org: { id: string; name: string; plan: string };
  role: Role;
  orgs: { id: string; name: string }[];
  properties: { id: string; name: string; domain: string; dirty: boolean; published?: boolean; /** failing fairness checks, which block publishing */ blocked?: number }[];
  /** read from the `pt-sidebar` cookie on the server so the first paint has the right width */
  initialCollapsed?: boolean;
  /** the last site visited (`pt-site` cookie): the site switcher opens on it from organization pages */
  initialSiteId?: string;
  /** setup progress of the site in focus while it isn't live yet (null once it is) */
  setup?: SetupSummary | null;
  children: React.ReactNode;
}

/**
 * A site's sections, four plain groups: Overview (which carries the setup progress while the site
 * isn't live), Manage (what runs and what visitors see), Compliance (the records and the checks) and
 * Developer (wiring it up). A row with several pages (Trackers & catalog, Banner studio, Consent
 * vault) opens its main page and has tabs for the rest; it stays current on all of them.
 */
const siteGroups = (id: string, setup?: SetupSummary | null): NavGroup[] => {
  const base = `/app/sites/${id}`;
  return [
    {
      tabs: [
        {
          href: base,
          label: "Overview",
          icon: IconOverview,
          exact: true,
          ...(setup && setup.siteId === id ? {
                badge: setup.scanning
                  ? { text: "Scanning", label: `, scan in progress, setup ${setup.done} of ${setup.total} done` }
                  : { text: `${setup.done}/${setup.total}`, label: `, setup ${setup.done} of ${setup.total} done` },
              } : {}),
        },
      ],
    },
    {
      label: "Manage",
      tabs: [
        { href: `${base}/trackers`, also: [`${base}/scanner`], label: "Trackers & catalog", icon: IconCookie },
        { href: `${base}/banner`, also: [`${base}/regions`, `${base}/languages`], label: "Banner studio", icon: IconBrush },
      ],
    },
    {
      label: "Compliance",
      tabs: [
        { href: `${base}/logs`, also: [`${base}/evidence`], label: "Consent vault", icon: IconLogs },
        { href: `${base}/leaks`, label: "Leak detection", icon: IconAlert },
        { href: `${base}/dpdp`, label: "DPDP readiness", icon: IconBalance },
      ],
    },
    {
      label: "Developer",
      tabs: [
        { href: `${base}/install`, label: "Installation", icon: IconInstall },
        { href: `${base}/webhooks`, label: "Webhooks", icon: IconPlug },
        { href: `${base}/settings`, label: "Site settings", icon: IconSettings },
      ],
    },
  ];
};

/** Organization pages: every site, the people, the plan, and the organization's own settings and records. */
const orgTabs = (role: Role): NavTab[] => [
  { href: "/app", label: "Sites", icon: IconSites, exact: true },
  { href: "/app/team", label: "Team", icon: IconTeam },
  ...(can(role, "billing:manage") ? [{ href: "/app/billing", label: "Billing", icon: IconBilling }] : []),
  { href: "/app/settings", label: "Settings", icon: IconSettings },
  // the audit trail and control status are for owners, admins and auditors (rbac "audit:read")
  ...(can(role, "audit:read")
    ? [
        { href: "/app/audit", label: "Audit log", icon: IconChain },
        { href: "/app/security", label: "Security controls", icon: IconShieldCheck },
      ]
    : []),
];

/** The organization's items, grouped: where your work lives, how the account is run, its own records. */
const orgGroups = (role: Role): NavGroup[] => {
  const tabs = orgTabs(role);
  const pick = (...hrefs: string[]) => tabs.filter((t) => hrefs.includes(t.href));
  return [
    { tabs: pick("/app", "/app/team") },
    { label: "Manage", tabs: pick("/app/billing", "/app/settings") },
    { label: "Governance", tabs: pick("/app/audit", "/app/security") },
  ].filter((g) => g.tabs.length);
};

export const SIDEBAR_COOKIE = "pt-sidebar";
export const SITE_COOKIE = "pt-site";

const under = (href: string, pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
const isActive = (t: NavTab, pathname: string) => (t.exact ? pathname === t.href : under(t.href, pathname) || (t.also ?? []).some((h) => under(h, pathname)));

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

/** Organization switcher in the top bar, with the organization's own pages one click away from anywhere. */
function OrgSwitcher({
  org,
  orgs,
  role,
  full,
  compact,
}: {
  org: ShellProps["org"];
  orgs: ShellProps["orgs"];
  role: Role;
  /** fill the width and always show the name (the sidebar, the phone drawer) */
  full?: boolean;
  /** the avatar alone (the collapsed sidebar) */
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  return (
    <Dropdown
      label={`Organization: ${org.name}. Switch organization`}
      title="Organizations"
      triggerClassName={compact ? "grid size-10 place-items-center rounded-[10px] transition-colors duration-150 hover:bg-raised aria-expanded:bg-raised" : `${switcherTrigger} ${full ? "w-full rounded-[10px]" : ""}`}
      search={orgs.length >= SEARCH_FROM ? { label: "Find an organization", placeholder: "Find an organization" } : undefined}
      trigger={
        compact ? (
          <OrgAvatar name={org.name} />
        ) : (
          <>
            <OrgAvatar name={org.name} />
            <span className={`min-w-0 ${full ? "block flex-1" : "hidden md:block"}`}>
              <span className={`block truncate text-sm font-semibold leading-tight text-ink ${full ? "" : "max-w-[16ch]"}`}>{org.name}</span>
              <span className="block truncate text-2xs capitalize leading-tight text-ink-3">{org.plan} plan</span>
            </span>
            <UpDown />
          </>
        )
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
            <MenuLabel>{org.name}</MenuLabel>
            {orgTabs(role)
              .filter((t) => t.href !== "/app/audit" && t.href !== "/app/security")
              .map((t) => {
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
                    <Icon size={16} className="shrink-0 text-ink-3" /> {t.label}
                  </Link>
                );
              })}
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

/**
 * Site switcher in the top bar: the site whose sections the nav lists. Switching keeps the section
 * you're on (Banner on one site opens Banner on the next), else opens the site's overview.
 */
function SiteSwitcher({
  org,
  properties,
  focus,
  onAll,
  section,
  full,
  compact,
}: {
  org: ShellProps["org"];
  properties: ShellProps["properties"];
  focus?: ShellProps["properties"][number];
  onAll: boolean;
  /** the current site sub-path, e.g. "/banner" */
  section: string;
  /** fill the width (the sidebar) */
  full?: boolean;
  /** the site chip alone (the collapsed sidebar) */
  compact?: boolean;
}) {
  const router = useRouter();
  if (!focus) {
    return (
      <Link
        href="/app?add=1"
        aria-label={compact ? "Add your first site" : undefined}
        className={`inline-flex h-10 items-center gap-2 rounded-full text-sm font-medium text-ink ring-1 ring-inset ring-boundary transition-colors duration-150 hover:bg-raised ${compact ? "w-10 justify-center" : `px-3 ${full ? "w-full rounded-[10px]" : ""}`}`}
      >
        <IconPlus size={16} />
        {compact ? null : (
          <>
            <span className="hidden sm:inline">Add your first site</span>
            <span className="sm:hidden">Add a site</span>
          </>
        )}
      </Link>
    );
  }
  const current = onAll ? null : focus;
  return (
    <Dropdown
      label={current ? `Site: ${current.name}. Switch site` : "All sites. Switch site"}
      title="Sites"
      width="w-80"
      triggerClassName={
        compact
          ? "relative grid size-10 place-items-center rounded-[10px] transition-colors duration-150 hover:bg-raised aria-expanded:bg-raised"
          : `${switcherTrigger} ${full ? "w-full rounded-[10px] bg-raised ring-1 ring-inset ring-line hover:bg-paper" : ""}`
      }
      search={properties.length >= SEARCH_FROM ? { label: "Find a site", placeholder: "Find a site by name or domain" } : undefined}
      trigger={
        <>
          {current ? <SiteChip name={current.name} current /> : <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-paper text-ink-2 ring-1 ring-inset ring-line-strong"><IconSites size={15} /></span>}
          <span className={compact ? "sr-only" : `min-w-0 ${full ? "flex-1" : ""}`}>
            <span className={`block truncate text-sm font-medium leading-tight text-ink ${full ? "" : "max-w-[18ch]"}`}>{current ? current.name : "All sites"}</span>
            <span className={`truncate font-mono text-2xs leading-tight text-ink-3 ${full ? "block" : "hidden max-w-[22ch] sm:block"}`}>{current ? current.domain : `${properties.length} in ${org.name}`}</span>
          </span>
          {current?.dirty ? (
            <span title="Unpublished changes" className={`size-2 shrink-0 rounded-full border-2 border-amber-bright ${compact ? "absolute right-1 top-1 bg-surface" : ""}`}>
              <span className="sr-only">Unpublished changes</span>
            </span>
          ) : null}
          {compact ? null : <UpDown />}
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
                    // the section, without a record id (a receipt belongs to one site only)
                    const keep = section.split("/").slice(0, 2).join("/");
                    router.push(`/app/sites/${p.id}${keep}`);
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
            <Link href="/app?add=1" role="menuitem" tabIndex={-1} onClick={close} className={menuItemClass}>
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
            <IconLock size={16} className="shrink-0 text-ink-3" /> Sign-in security
          </Link>
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

export function Shell({ user, org, role, orgs, properties, initialCollapsed = false, initialSiteId, setup, children }: ShellProps) {
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

  const toggleSidebar = useCallback(() => setCollapsed((was) => !was), []);
  // remember the choice, so the server paints the sidebar at the right width next time
  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);
  // "[" collapses and expands the sidebar, as in Linear and Vercel, unless you're typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, select, [contenteditable=true], [role=menu], [role=dialog]")) return;
      e.preventDefault();
      toggleSidebar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const focus = properties.find((p) => p.id === focusId);
  const sitePage = /^\/app\/sites\/[^/]+/.test(pathname);
  // One scope at a time: a site's pages list its sections (and the way back to all sites); the
  // organization's pages list the organization's items. Never both, so the list never doubles up.
  const onSite = Boolean(focus && sitePage);
  const groups: NavGroup[] = onSite && focus ? siteGroups(focus.id, setup) : orgGroups(role);
  // Before a site's first publish its checklist leads the way there, so the bar shows the status only.
  const firstPublishPending = Boolean(focus && focus.published === false && setup?.siteId === focus.id);

  const publishControls =
    focus && currentId && firstPublishPending ? (
      <span className="hidden items-center gap-1.5 text-xs text-ink-3 lg:inline-flex">
        <span aria-hidden className="size-2 rounded-full border-2 border-amber-bright" />
        Not published yet
      </span>
    ) : focus && currentId && focus.dirty && can(role, "property:write") ? (
      // Only when there's something to publish: a site that's up to date shows nothing here.
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
      label={onSite && focus ? `${focus.name} sections` : `${org.name} organization`}
      empty={
        focus || onSite ? null : (
          <Link
            href="/app?add=1"
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
      {/* keeps the sidebar's "Scanning" badge and the checklist current until the scan finishes */}
      <RefreshWhile active={Boolean(setup?.scanning)} everyMs={15_000} />
        <div className="pt-app min-h-dvh bg-canvas text-ink">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-on-inverse"
          >
            Skip to content
          </a>

          <div className="flex">
            {/* Desktop and tablet: the sidebar runs the full height. Its head is the mark and the
                organization, then that scope's sections; the site switcher leads the bar beside it. */}
            <NavRail
              collapsed={collapsed}
              onToggle={toggleSidebar}
              fullHeight
              header={
                <>
                  <div className={`flex h-14 shrink-0 items-center border-b border-line ${collapsed ? "justify-center px-3" : "gap-1 px-3"}`}>
                    <Link href="/app" aria-label="Plain Theory dashboard home" className="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-raised">
                      <BrandMark size={24} variant="mono" className="text-ink" />
                    </Link>
                    {collapsed ? null : (
                      <div className="min-w-0 flex-1">
                        <OrgSwitcher org={org} orgs={orgs} role={role} full />
                      </div>
                    )}
                  </div>
                  {/* collapsed: the organization as its avatar, under the mark */}
                  {collapsed ? (
                    <div className="flex shrink-0 justify-center border-b border-line px-3 py-3">
                      <OrgSwitcher org={org} orgs={orgs} role={role} compact />
                    </div>
                  ) : null}
                </>
              }
            >
              {nav(collapsed)}
            </NavRail>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-40 border-b border-line bg-surface print:hidden">
                <div className="flex h-14 items-center gap-1 px-2 sm:gap-1.5 sm:px-4 md:px-6">
                  {/* phones: the menu and the mark are in the bar too; the site switcher leads it everywhere */}
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
                  <div className="flex min-w-0 items-center">
                    <Link href="/app" aria-label="Plain Theory dashboard home" className="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-raised md:hidden">
                      <BrandMark size={24} variant="mono" className="text-ink" />
                    </Link>
                    <span aria-hidden className="mx-0.5 text-lg font-light text-line-input md:hidden">
                      /
                    </span>
                    <SiteSwitcher org={org} properties={properties} focus={focus} onAll={pathname === "/app"} section={match?.[2] ?? ""} />
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <div className="hidden sm:block">{publishControls}</div>
                    <Link href="/docs" className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink lg:inline-flex">
                      <IconBook size={16} aria-hidden className="shrink-0" />
                      Docs
                    </Link>
                    <UserMenu user={user} org={org} role={role} />
                  </div>
                </div>
                {/* phones: the publish controls get their own strip under the bar */}
                {publishControls ? <div className="flex justify-end border-t border-line px-3 py-1.5 sm:hidden">{publishControls}</div> : null}
              </header>

              <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
                <div className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-6 lg:px-8 print:p-0">{children}</div>
              </main>
            </div>
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
                <OrgSwitcher org={org} orgs={orgs} role={role} full />
              </div>
            }
          >
            {nav(false)}
          </NavDrawer>
        </div>
    </ToastProvider>
  );
}
