"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { signOut } from "@/app/app/actions";
import { BrandMark } from "@/components/brand/logo";
import { IconArrowRight, IconChevronDown, IconClose, IconMenu, IconSignOut } from "@/components/icons";
import { CONTACT, MENUS, flatLinks, type NavMenu } from "./site-nav";

/**
 * One look for every item in the bar, whether it opens a menu (button) or goes somewhere (link): same
 * height, regular weight, padding, and a soft pill on hover, focus, open and the current page.
 */
const ITEM =
  "inline-flex h-10 items-center whitespace-nowrap rounded-full px-3 text-[0.9375rem] leading-none text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime aria-expanded:bg-white/10 aria-expanded:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white";

/** The white overlay panel shared by the mega-menus and the account menu. */
const PANEL = "rounded-[18px] bg-white text-soot shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)]"; /* taste-skill-ignore: a real overlay menu */

/** Popovers mark their root with this, so a pointer press anywhere else closes them. */
const POPOVER = "data-mk-popover";

/** Space kept between an open panel and the edge of the viewport. */
const EDGE = 16;

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const visibleIn = (root: ParentNode | null | undefined) =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0) : [];

/* ---------------- who is signed in ---------------- */

interface Account {
  name: string;
  email: string;
}

/**
 * A hint, kept per browser, that the last check found a session. It only decides what the header shows
 * while the real check is in flight (nothing, rather than a Sign in that then turns into Dashboard).
 */
const HINT_KEY = "pt-signed-in";
const readHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
};
const noSubscribe = () => () => {};

/**
 * The session check. The marketing pages are static or ISR (several revalidate every 5 minutes), and the
 * session cookie is httpOnly, so neither the server render nor client script can read it without
 * turning every page dynamic. The header asks /api/session once it has hydrated (and again when the page
 * comes back from the back/forward cache), which validates the session against its server-side record.
 * `undefined` while the answer is pending, `null` when signed out.
 */
function useAccount() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch("/api/session", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(8000) })
        .then((r) => (r.ok ? (r.json() as Promise<{ user: Account | null }>) : { user: null }))
        .catch(() => ({ user: null }))
        .then(({ user }) => {
          if (!live) return;
          setAccount(user);
          try {
            if (user) localStorage.setItem(HINT_KEY, "1");
            else localStorage.removeItem(HINT_KEY);
          } catch {
            /* storage blocked: the hint is only a nicety */
          }
        });
    void check();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      live = false;
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  const status: "in" | "out" | "pending" = account === undefined ? (hint ? "pending" : "out") : account ? "in" : "out";
  return { account: account ?? null, status };
}

const initials = (s: string) =>
  s
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/* ---------------- desktop menus ---------------- */

/** Keep an open panel inside the viewport: centred under its button where it fits, else pushed in from the edge. */
function usePlacement(open: boolean) {
  const host = useRef<HTMLLIElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const p = panel.current;
      const a = anchor.current;
      const h = host.current;
      if (!p || !a || !h) return;
      const vw = document.documentElement.clientWidth;
      const w = p.offsetWidth;
      const ar = a.getBoundingClientRect();
      const x = Math.max(EDGE, Math.min(ar.left + ar.width / 2 - w / 2, vw - EDGE - w));
      p.style.left = `${Math.round(x - h.getBoundingClientRect().left)}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  return { host, anchor, panel };
}

/** Up/Down (and Home/End) move between the links of an open panel. */
function panelKeys(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = visibleIn(e.currentTarget);
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
  items[next].focus();
}

/**
 * One mega-menu (disclosure pattern): click or Enter toggles it, never hover, so the pointer can travel to
 * the panel without it closing on the way. Down arrow opens it and moves into the links; Escape closes it
 * and returns focus to the button; it closes when focus leaves, on a press outside it, and on navigation.
 * The white panel drops below the bar with one evenly spaced column per group, always side by side
 * (a column never wraps under another), sized to its longest link.
 */
function Menu({ menu, open, onOpen, onClose }: { menu: NavMenu; open: boolean; onOpen: () => void; onClose: () => void }) {
  const id = useId();
  const { host: li, anchor: button, panel } = usePlacement(open);
  return (
    <li
      ref={li}
      {...{ [POPOVER]: "" }}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          onClose();
          button.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
    >
      <button
        ref={button}
        type="button"
        data-mk-top=""
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          if (!open) onOpen();
          requestAnimationFrame(() => visibleIn(panel.current)[0]?.focus());
        }}
        className={ITEM}
      >
        {menu.label}
        <IconChevronDown size={14} aria-hidden className={`ml-1 text-white/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      <div ref={panel} id={id} hidden={!open} onKeyDown={panelKeys} className="absolute top-full z-50 w-max pt-3">
        <div className={`${PANEL} grid max-w-[calc(100vw-2rem)] grid-flow-col auto-cols-[minmax(10.5rem,max-content)] gap-x-12 px-8 py-7`}>
          {menu.groups.map((g) => (
            <div key={g.heading + g.links[0]?.href} className="flex min-w-0 flex-col">
              <p className="text-[0.875rem] text-mute-ink" aria-hidden={!g.heading.trim() || undefined}>
                {g.heading}
              </p>
              <ul className="mt-4 space-y-3">
                {g.links.map((l) => (
                  <li key={l.href + l.title}>
                    <Link href={l.href} onClick={onClose} className="text-[0.9375rem] text-soot hover:underline hover:underline-offset-4 focus-visible:underline">
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {g.viewAll ? (
                <Link href={g.viewAll.href} onClick={onClose} className="mt-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-soot hover:underline hover:underline-offset-4">
                  {g.viewAll.title} <IconArrowRight size={16} />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

/** The signed-in account menu: an initials button opening a small panel aligned to the right edge. */
function AccountMenu({ account, open, onOpen, onClose }: { account: Account; open: boolean; onOpen: () => void; onClose: () => void }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const link = "flex min-h-10 items-center rounded-[10px] px-3 text-[0.9375rem] text-soot hover:bg-chalk focus-visible:bg-chalk";
  return (
    <div
      {...{ [POPOVER]: "" }}
      className="relative max-lg:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          onClose();
          button.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Account: ${account.name}`}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          if (!open) onOpen();
          requestAnimationFrame(() => visibleIn(panel.current)[0]?.focus());
        }}
        className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime aria-expanded:bg-white/10"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-white/15 text-[0.8125rem] font-semibold tracking-[0.02em] text-white ring-1 ring-white/25">
          {initials(account.name)}
        </span>
      </button>
      <div ref={panel} id={id} hidden={!open} onKeyDown={panelKeys} className="absolute right-0 top-full z-50 pt-3">
        <div className={`${PANEL} w-[min(16rem,calc(100vw-2rem))] p-2`}>
          <div className="border-b border-black/10 px-3 pb-3 pt-2">
            <p className="truncate text-[0.9375rem] font-medium">{account.name}</p>
            <p className="truncate text-[0.8125rem] text-mute-ink">{account.email}</p>
          </div>
          <ul className="pt-2">
            <li>
              <Link href="/app" prefetch={false} onClick={onClose} className={link}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/app/account" prefetch={false} onClick={onClose} className={link}>
                Account
              </Link>
            </li>
            <li>
              <form action={signOut}>
                <button type="submit" className={`${link} w-full gap-2 text-left`}>
                  <IconSignOut size={16} className="shrink-0 text-mute-ink" /> Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Left/Right move between the items of the bar itself. */
function barKeys(e: React.KeyboardEvent<HTMLUListElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-mk-top]"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length].focus();
}

/* ---------------- the bar ---------------- */

/**
 * The site bar on soot, sticky: the mark; three menus and Contact in the middle (places to go); on the
 * right, Sign in as a quiet link and one primary action, Start free, or for a signed-in visitor Dashboard
 * and the account menu. Both right-hand sets share one grid cell, so the bar keeps its width whichever
 * shows. A one-line announcement above it can be dismissed. Below 1024px the menu toggle opens a
 * full-height panel with each group as an expandable section and the account actions at the foot.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { account, status } = useAccount();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(true);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenMenu(null);
    setMobile(false);
  }
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);

  // A press anywhere outside the open menu closes it.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(`[${POPOVER}]`)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openMenu]);

  // Phone panel: pinned from the bar to the bottom of the viewport, page scroll locked, focus kept
  // between the toggle and the panel, Escape closes it. It closes itself if the window grows to desktop.
  useLayoutEffect(() => {
    if (!mobile) return;
    const place = () => {
      if (sheet.current && header.current) sheet.current.style.top = `${Math.max(0, header.current.getBoundingClientRect().bottom)}px`;
    };
    place();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        toggle.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [toggle.current, ...visibleIn(sheet.current)].filter((el): el is HTMLElement => Boolean(el));
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = i < 0 ? 0 : e.shiftKey ? (i - 1 + items.length) % items.length : (i + 1) % items.length;
      e.preventDefault();
      items[next].focus();
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setMobile(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      wide.removeEventListener("change", onWide);
    };
  }, [mobile]);

  const current = (href: string) => (pathname === href ? "page" : undefined);
  const close = (id: string) => () => setOpenMenu((o) => (o === id ? null : o));
  const signedIn = status === "in" && account;
  /** the set of the right-hand cell not in use: kept for its width, out of sight and out of reach */
  const off = (shown: boolean) => (shown ? {} : { inert: true, "aria-hidden": true, className: "invisible" });
  const sheetLink = "flex min-h-14 items-center text-[1.25rem] font-semibold tracking-[-0.03em]";

  return (
    <>
      {notice ? (
        <div className="on-light relative bg-lime py-2 pl-4 pr-12 text-[0.875rem] text-soot sm:px-12 sm:text-center">
          {/* one line on phones: the short form */}
          <span className="sm:hidden">The DPDP Rules, 2025 are in force.</span>
          <span className="max-sm:hidden">The DPDP Rules, 2025 are in force. See what your website needs, and by when.</span>{" "}
          <Link href="/compliance/dpdpa" className="whitespace-nowrap font-medium underline underline-offset-2">
            Read more →
          </Link>
          <button
            type="button"
            onClick={() => setNotice(false)}
            aria-label="Dismiss announcement"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-black/10"
          >
            <IconClose size={16} />
          </button>
        </div>
      ) : null}
      <header ref={header} className="sticky top-0 z-40 bg-soot text-white">
        <div className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-8">
          <Link href="/" aria-label="Plain Theory home" className="flex shrink-0 items-center gap-2.5 rounded-full">
            <BrandMark size={28} variant="lime" />
            <span className="text-[1.125rem] font-semibold tracking-[-0.035em]">Plain Theory</span>
          </Link>
          <nav aria-label="Main" className="mx-auto max-lg:hidden">
            <ul className="flex items-center gap-1" onKeyDown={barKeys}>
              {MENUS.map((m) => (
                <Menu key={m.id} menu={m} open={openMenu === m.id} onOpen={() => setOpenMenu(m.id)} onClose={close(m.id)} />
              ))}
              <li>
                <Link href={CONTACT.href} data-mk-top="" aria-current={current(CONTACT.href)} className={ITEM}>
                  {CONTACT.title}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="flex shrink-0 items-center gap-1 max-lg:ml-auto">
            {/* Both sets in one cell: the wider one sets the width, so the answer never shifts the bar. */}
            <div className="grid items-center justify-items-end [&>*]:col-start-1 [&>*]:row-start-1">
              <div {...off(status === "out")}>
                <div className="flex items-center gap-1">
                  <Link href="/auth/login" className={`${ITEM} max-sm:hidden`}>
                    Sign in
                  </Link>
                  <Link href="/auth/signup" className="mk-stem mk-stem-lime mk-stem-sm ml-1">
                    Start free
                  </Link>
                </div>
              </div>
              <div {...off(Boolean(signedIn))}>
                <div className="flex items-center gap-2">
                  {/* no prefetch: the link is in the page for signed-out visitors too, where /app only redirects to sign-in */}
                  <Link href="/app" prefetch={false} className="mk-stem mk-stem-lime mk-stem-sm">
                    Dashboard
                  </Link>
                  {signedIn ? (
                    <AccountMenu account={account} open={openMenu === "account"} onOpen={() => setOpenMenu("account")} onClose={close("account")} />
                  ) : (
                    <span aria-hidden className="size-10 max-lg:hidden" />
                  )}
                </div>
              </div>
            </div>
            <button
              ref={toggle}
              type="button"
              onClick={() => setMobile((o) => !o)}
              aria-expanded={mobile}
              aria-controls="mk-mobile"
              aria-label={mobile ? "Close menu" : "Open menu"}
              className="-mr-1.5 grid size-11 place-items-center rounded-full hover:bg-white/10 lg:hidden"
            >
              {mobile ? <IconClose size={24} /> : <IconMenu size={24} />}
            </button>
          </div>

          {/* Phones and tablets: every menu as an expandable section, Contact, then the account actions at the foot */}
          <nav
            ref={sheet}
            id="mk-mobile"
            aria-label="Main"
            hidden={!mobile}
            className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto overscroll-contain bg-soot lg:hidden"
          >
            <div className="flex min-h-full flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-2">
              {MENUS.map((m) => (
                <details key={m.id} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[1.25rem] font-semibold tracking-[-0.03em] [&::-webkit-details-marker]:hidden">
                    {m.label}
                    <IconChevronDown size={20} className="text-mute transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="pb-3">
                    {flatLinks(m).map((l) => (
                      <li key={l.href + l.title}>
                        <Link href={l.href} className="flex min-h-11 items-center text-[1rem] text-white/85 hover:text-white">
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              <Link href={CONTACT.href} aria-current={current(CONTACT.href)} className={sheetLink}>
                {CONTACT.title}
              </Link>

              <div className="mt-auto pt-8">
                {signedIn ? (
                  <div className="border-t border-white/15 pt-5">
                    <p className="truncate text-[0.875rem] text-white/60">Signed in as {account.email}</p>
                    <ul className="mt-2">
                      <li>
                        <Link href="/app" prefetch={false} className={sheetLink}>
                          Dashboard
                        </Link>
                      </li>
                      <li>
                        <Link href="/app/account" prefetch={false} className={sheetLink}>
                          Account
                        </Link>
                      </li>
                      <li>
                        <form action={signOut}>
                          <button type="submit" className={`${sheetLink} w-full gap-2.5 text-left`}>
                            <IconSignOut size={20} className="shrink-0 text-white/60" /> Sign out
                          </button>
                        </form>
                      </li>
                    </ul>
                  </div>
                ) : status === "out" ? (
                  <div className="space-y-3 border-t border-white/15 pt-6">
                    <Link href="/auth/signup" className="mk-stem mk-stem-lime w-full">
                      Start free
                    </Link>
                    <Link href="/contact?topic=sales" className="mk-stem mk-stem-outline w-full">
                      Book a demo
                    </Link>
                    <Link href="/auth/login" className="flex min-h-12 items-center justify-center text-[1rem] text-white/85 hover:text-white">
                      Sign in
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
