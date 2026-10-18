"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { IconProps } from "@/components/icons";

export type NavTab = {
  href: string;
  label: string;
  icon: (p: IconProps) => ReactNode;
  exact?: boolean;
  /** a short count or progress shown at the row's end, e.g. "3/6" while a site is being set up */
  badge?: { text: string; label: string };
};
export type NavGroup = { label?: string; tabs: NavTab[] };

/**
 * One nav row, 40px tall. The current page is marked three ways: aria-current, the lime "selected"
 * wash with a semibold label, and the marker bar on the left edge (soot in light, lime in dark).
 * Collapsed rows show the icon only, with the label as a tooltip and the accessible name.
 */
export function NavLink({ tab, active, collapsed }: { tab: NavTab; active: boolean; collapsed: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? tab.label : undefined}
      className={`group/item relative flex h-10 items-center gap-3 rounded-[10px] text-sm transition-colors duration-150 focus-visible:-outline-offset-2 ${collapsed ? "justify-center px-0" : "px-3"} ${
        active ? "bg-selected font-semibold text-on-selected" : "text-ink-2 hover:bg-raised hover:text-ink"
      }`}
    >
      {active ? <span aria-hidden className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-full bg-marker" /> : null}
      <Icon size={18} aria-hidden className={`shrink-0 ${active ? "text-on-selected" : "text-ink-3 group-hover/item:text-ink-2"}`} />
      {collapsed ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-inverse px-2.5 py-1.5 text-xs font-medium text-on-inverse opacity-0 shadow-[var(--shadow-lift)] transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
        >
          {tab.label}
        </span>
      ) : (
        <>
          <span className="truncate">{tab.label}</span>
          {tab.badge ? (
            <span className="ml-auto shrink-0 rounded-full bg-paper px-2 py-0.5 font-mono text-2xs font-medium tabular-nums text-ink-2 ring-1 ring-inset ring-line-strong">
              <span aria-hidden>{tab.badge.text}</span>
              <span className="sr-only">{tab.badge.label}</span>
            </span>
          ) : null}
        </>
      )}
      {collapsed && tab.badge ? <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-marker" /> : null}
    </Link>
  );
}

/**
 * The sidebar for one scope at a time: a site's sections on its pages, the organization's items on
 * its pages, never both (the top bar's switchers say which). On top, an optional way back up
 * (`back`, e.g. "All sites"); then the groups, the first unlabelled. Collapsed, labels become
 * short hairlines. `empty` stands in for the groups when there is nothing to list yet.
 */
export function NavGroups({
  groups,
  pathname,
  collapsed,
  isActive,
  label = "Sections",
  empty,
  back,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  isActive: (t: NavTab, pathname: string) => boolean;
  /** accessible name of the navigation landmark */
  label?: string;
  empty?: ReactNode;
  /** the way up a level, as a nav row (e.g. "All sites" on a site's pages) */
  back?: NavTab;
}) {
  // the most specific match wins, so a site's Overview isn't current on its sub-pages
  const all = groups.flatMap((g) => g.tabs);
  const current = all.filter((t) => isActive(t, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <div className="space-y-5">
      {back ? <NavLink tab={back} active={false} collapsed={collapsed} /> : null}
      {groups.length ? (
        <nav aria-label={label} className="space-y-5">
          {groups.map((g, i) => (
            <div key={g.label ?? i}>
              {g.label && !collapsed ? <p className="eyebrow mb-1.5 px-3">{g.label}</p> : null}
              {g.label && collapsed ? <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line-strong" /> : null}
              <ul aria-label={g.label} className="space-y-0.5">
                {g.tabs.map((t) => (
                  <li key={t.href}>
                    <NavLink tab={t} active={t === current} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}
      {empty}
    </div>
  );
}

/**
 * Desktop and tablet (md and up): a sticky rail under the top bar that collapses to icons. The toggle
 * is a round handle on the rail's right edge, centred, shown while the rail is hovered or the handle
 * has keyboard focus (always on touch screens), with a tooltip and the "[" shortcut.
 */
export function NavRail({
  collapsed,
  onToggle,
  header,
  fullHeight = false,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** pinned above the sections: the mark, the organization and the site */
  header?: ReactNode;
  /** run the full window height (the dashboard); otherwise it sits under a full-width top bar (the staff console) */
  fullHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      id="app-sidebar"
      aria-label="Dashboard navigation"
      className={`group/rail sticky z-30 hidden shrink-0 flex-col border-r border-line bg-surface ${fullHeight ? "top-0 h-dvh" : "top-14 h-[calc(100dvh-3.5rem)]"} transition-[width] duration-200 ease-out md:flex print:hidden ${collapsed ? "w-[72px]" : "w-[256px]"}`}
    >
      {header}
      <div className={`scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-5 ${collapsed ? "px-3" : "px-4"}`}>{children}</div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar"
        aria-keyshortcuts="["
        className="group/toggle absolute -right-3.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink-3 opacity-0 shadow-[var(--shadow-lift)] ring-1 ring-line-strong transition-[opacity,background-color,color] duration-150 hover:bg-raised hover:text-ink focus-visible:text-ink focus-visible:opacity-100 group-hover/rail:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
        <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        {/* tooltip with the shortcut */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-inverse px-2.5 py-1.5 text-xs font-medium text-on-inverse opacity-0 shadow-[var(--shadow-lift)] transition-opacity duration-150 group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100"
        >
          {collapsed ? "Expand" : "Collapse"} <kbd className="ml-1 rounded-[4px] bg-white/15 px-1 font-mono">[</kbd>
        </span>
      </button>
    </aside>
  );
}

/**
 * Phones: the same navigation as a modal drawer from the left. Focus moves in and is trapped, Escape
 * and the scrim close it, the page behind can't scroll, and focus returns to the menu button.
 */
export function NavDrawer({ id, open, onClose, header, children }: { id: string; open: boolean; onClose: () => void; header?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // the latest onClose, without re-running the open effect (and re-focusing) on every render
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const el = panel.current;
      // a menu opened from inside the drawer handles its own keys first
      if (e.defaultPrevented || !el || !el.contains(document.activeElement)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === "Tab") {
        const focusable = Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div id={id} className="fixed inset-0 z-[60] md:hidden">
      <div aria-hidden onClick={onClose} className="pt-fade absolute inset-0 bg-[rgb(15_15_15/0.5)]" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className="pt-sheet-left absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col bg-surface shadow-[var(--shadow-float)]">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2">
          {header ?? <span className="flex-1" />}
          <button ref={closeButton} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-raised">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-5">{children}</div>
      </div>
    </div>
  );
}
