"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { staffSignOut, staffSignOutEverywhere } from "@/app/admin/login/actions";
import { BrandMark } from "@/components/brand/logo";
import { Dropdown, MenuSeparator, menuItemClass } from "@/components/app/shell/dropdown";
import { NavDrawer, NavGroups, NavRail, type NavTab } from "@/components/app/shell/nav";
import { ToastProvider } from "@/components/app/ui/toast";
import { ThemeScope, ThemeToggle } from "@/components/theme/theme";
import { IconChain, IconMail, IconOverview, IconShieldCheck, IconSignOut, IconSites, IconTeam } from "@/components/icons";

export type AdminNavId = "overview" | "orgs" | "users" | "requests" | "staff" | "audit";

const NAV: (NavTab & { id: AdminNavId })[] = [
  { id: "overview", href: "/admin", label: "Overview", icon: IconOverview, exact: true },
  { id: "orgs", href: "/admin/orgs", label: "Organizations", icon: IconSites },
  { id: "users", href: "/admin/users", label: "Users", icon: IconTeam },
  { id: "requests", href: "/admin/requests", label: "Requests", icon: IconMail },
  { id: "staff", href: "/admin/staff", label: "Our team", icon: IconShieldCheck },
  { id: "audit", href: "/admin/audit", label: "Audit log", icon: IconChain },
];

const isActive = (t: NavTab, path: string) => (t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`));

const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Staff console frame: the dashboard's shell (top bar, nav rail, phone drawer, breadcrumbs) with a
 * "Staff console" label on every page, so staff never mistake it for a customer's view.
 */
export function AdminShell({
  user,
  roleLabel,
  nav,
  trustedBrowsers,
  children,
}: {
  user: { name: string; email: string };
  roleLabel: string;
  nav: AdminNavId[];
  /** Present with STAFF_REMEMBER_DEVICE=1: this browser's trust (a formatted end date, or null) and "Sign out everywhere". */
  trustedBrowsers?: { thisBrowserUntil: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter((n) => nav.includes(n.id));
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // A new page closes the phone menu.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  const groups = [{ label: "Platform", tabs: items }];
  const navBody = (isCollapsed: boolean) => <NavGroups groups={groups} pathname={pathname} collapsed={isCollapsed} isActive={isActive} />;

  return (
    <ToastProvider>
      <ThemeScope />
        <div className="pt-app min-h-dvh bg-canvas text-ink">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-on-inverse"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-40 border-b border-line bg-surface">
            <div className="flex h-14 items-center gap-1.5 px-2 sm:px-4">
              <button
                ref={menuButton}
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="admin-menu"
                className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-raised md:hidden"
              >
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <span className="sr-only">Open menu</span>
              </button>
              <Link href="/admin" aria-label="Staff console home" className="grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-raised">
                <BrandMark size={24} variant="mono" className="text-ink" />
              </Link>
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-warning-wash px-3 text-xs font-semibold text-warning ring-1 ring-inset ring-warning/40">
                <IconShieldCheck size={14} aria-hidden />
                Staff console
              </span>
              <span className="ml-2 hidden truncate text-xs text-ink-3 lg:inline">All customer data · every change audited</span>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Dropdown
                  label="Staff account menu"
                  title="Staff account"
                  align="right"
                  width="w-72"
                  triggerClassName="flex h-10 items-center gap-2 rounded-full pl-0 pr-0 transition-colors duration-150 hover:bg-raised aria-expanded:bg-raised sm:pr-3"
                  trigger={
                    <>
                      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-inverse text-xs font-semibold text-on-inverse sm:size-8">
                        {initials(user.name)}
                      </span>
                      <span className="hidden text-sm font-medium sm:inline">{roleLabel}</span>
                    </>
                  }
                >
                  {() => (
                    <>
                      <div className="px-2.5 pb-2 pt-1.5">
                        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                        <p className="truncate text-xs text-ink-3">{user.email}</p>
                        <p className="mt-1 text-xs text-ink-3">Staff role: {roleLabel}</p>
                        {trustedBrowsers ? (
                          <p className="mt-1 text-xs text-ink-3">
                            {trustedBrowsers.thisBrowserUntil ? `Trusted browser: no code needed here until ${trustedBrowsers.thisBrowserUntil}` : "Trusted browser: no, this browser asks for a code"}
                          </p>
                        ) : null}
                      </div>
                      <div className="px-2.5 pb-2">
                        <p aria-hidden className="mb-1.5 text-xs text-ink-3">
                          Theme
                        </p>
                        <ThemeToggle className="w-full" />
                      </div>
                      <MenuSeparator />
                      <form action={staffSignOut}>
                        <button type="submit" role="menuitem" tabIndex={-1} className={`${menuItemClass} hover:!bg-destructive-wash hover:!text-destructive`}>
                          <IconSignOut size={16} className="shrink-0" /> Sign out
                        </button>
                      </form>
                      {trustedBrowsers ? (
                        <form action={staffSignOutEverywhere}>
                          <button type="submit" role="menuitem" tabIndex={-1} className={`${menuItemClass} hover:!bg-destructive-wash hover:!text-destructive`}>
                            <IconSignOut size={16} className="shrink-0" /> Sign out everywhere
                          </button>
                        </form>
                      ) : null}
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
          </header>

          <div className="flex">
            <NavRail collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)}>
              {navBody(collapsed)}
              {collapsed ? null : <p className="mt-6 px-3 text-xs text-ink-3">Signed in with your staff account. Sessions end after 1 hour idle or 8 hours.</p>}
            </NavRail>
            <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
              <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8">{children}</div>
            </main>
          </div>

          <NavDrawer
            id="admin-menu"
            open={menuOpen}
            onClose={() => {
              setMenuOpen(false);
              menuButton.current?.focus();
            }}
            header={<span className="flex-1 px-2 text-sm font-semibold">Staff console</span>}
          >
            {navBody(false)}
          </NavDrawer>
        </div>
    </ToastProvider>
  );
}
