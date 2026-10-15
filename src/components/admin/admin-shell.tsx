"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { staffSignOut, staffSignOutEverywhere } from "@/app/admin/login/actions";
import { BrandMark } from "@/components/brand/logo";
import { Dropdown, menuItemClass } from "@/components/app/shell/dropdown";
import { ToastProvider } from "@/components/app/ui/toast";
import { ThemeScope, ThemeToggle } from "@/components/theme/theme";
import { IconChain, IconMail, IconOverview, IconShieldCheck, IconSignOut, IconSites, IconTeam, type IconProps } from "@/components/icons";

export type AdminNavId = "overview" | "orgs" | "users" | "requests" | "staff" | "audit";

const NAV: { id: AdminNavId; href: string; label: string; icon: (p: IconProps) => React.ReactNode; exact?: boolean }[] = [
  { id: "overview", href: "/admin", label: "Overview", icon: IconOverview, exact: true },
  { id: "orgs", href: "/admin/orgs", label: "Organizations", icon: IconSites },
  { id: "users", href: "/admin/users", label: "Users", icon: IconTeam },
  { id: "requests", href: "/admin/requests", label: "Requests", icon: IconMail },
  { id: "staff", href: "/admin/staff", label: "Our team", icon: IconShieldCheck },
  { id: "audit", href: "/admin/audit", label: "Audit log", icon: IconChain },
];

const active = (href: string, exact: boolean | undefined, path: string) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

/**
 * Staff console frame. Deliberately unlike the customer dashboard: an ink top bar with a "Staff
 * console" label on every page, so staff never mistake it for a customer's view.
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
  const tabsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <ToastProvider>
      <ThemeScope />
      <div className="min-h-dvh bg-paper">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-brand-solid focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0c13] text-white">
          <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
            <Link href="/admin" aria-label="Staff console home" className="grid size-11 shrink-0 place-items-center rounded-[8px] hover:bg-white/10 sm:size-8">
              <BrandMark size={20} variant="lime" />
            </Link>
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] bg-[#eda43a] px-2 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#10131f]">
              <IconShieldCheck size={13} />
              Staff console
            </span>
            <span className="ml-2 hidden truncate font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-white/55 md:inline">All customer data · every change audited</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Dropdown
                label="Staff account menu"
                align="right"
                width="w-64"
                triggerClassName="flex h-11 items-center gap-2 rounded-full pl-1 pr-1 transition-colors hover:bg-white/10 aria-expanded:bg-white/10 sm:h-8 sm:pr-3"
                trigger={
                  <>
                    <span aria-hidden className="grid size-8 place-items-center rounded-full bg-[#4e4bf0] text-[0.6875rem] font-bold text-white sm:size-6">
                      {user.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="hidden text-sm font-medium sm:inline">{roleLabel}</span>
                  </>
                }
              >
                {() => (
                  <>
                    <div className="px-2.5 pb-2 pt-1.5">
                      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-3">{user.email}</p>
                      <p className="mt-1 text-xs text-ink-3">Staff role: {roleLabel}</p>
                      {trustedBrowsers ? (
                        <p className="mt-1 text-xs text-ink-3">
                          {trustedBrowsers.thisBrowserUntil ? `Trusted browser: no code needed here until ${trustedBrowsers.thisBrowserUntil}` : "Trusted browser: no, this browser asks for a code"}
                        </p>
                      ) : null}
                    </div>
                    <div className="px-2.5 pb-2">
                      <ThemeToggle className="w-full" />
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <form action={staffSignOut}>
                      <button type="submit" role="menuitem" tabIndex={-1} className={menuItemClass}>
                        <IconSignOut size={16} /> Sign out
                      </button>
                    </form>
                    {trustedBrowsers ? (
                      <form action={staffSignOutEverywhere}>
                        <button type="submit" role="menuitem" tabIndex={-1} className={menuItemClass}>
                          <IconSignOut size={16} /> Sign out everywhere
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        </header>

        {/* small screens: sections as scrollable tabs */}
        <div className="sticky top-12 z-30 border-b border-line bg-surface lg:hidden">
          <nav ref={tabsRef} aria-label="Staff console sections" className="-mb-px flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
            {items.map((t) => {
              const on = active(t.href, t.exact, pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`group relative flex h-12 shrink-0 items-center px-0.5 text-sm transition-colors ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}
                >
                  <span className="rounded-[6px] px-2.5 py-1.5 transition-colors group-hover:bg-paper">{t.label}</span>
                  <span aria-hidden className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-bright ${on ? "opacity-100" : "opacity-0"}`} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex">
          <aside aria-label="Staff console" className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-[220px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
            <nav aria-label="Staff console sections" className="flex-1 overflow-y-auto px-3 py-4">
              <p className="eyebrow mb-1.5 px-2">Platform</p>
              <ul className="space-y-px">
                {items.map((t) => {
                  const on = active(t.href, t.exact, pathname);
                  const Icon = t.icon;
                  return (
                    <li key={t.href}>
                      <Link
                        href={t.href}
                        aria-current={on ? "page" : undefined}
                        className={`group/item relative flex h-8 items-center gap-2.5 rounded-[7px] px-2 text-[0.8125rem] transition-colors ${on ? "bg-paper font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-paper/70 hover:text-ink"}`}
                      >
                        {on ? <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-amber-bright" /> : null}
                        <Icon size={16} className={`shrink-0 ${on ? "text-amber" : "text-ink-3 group-hover/item:text-ink-2"}`} />
                        <span className="truncate">{t.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <p className="border-t border-line px-5 py-3.5 text-[0.75rem] leading-5 text-ink-3">
              Signed in with your staff account. Sessions end after 1 hour idle or 8 hours.
            </p>
          </aside>
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
