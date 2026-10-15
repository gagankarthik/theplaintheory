"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import { IconArrowRight, IconChevronDown, IconClose } from "@/components/icons";
import { CONTACT, MENUS, flatLinks, type NavMenu } from "./site-nav";

/**
 * One look for every item in the bar, whether it opens a menu (button) or goes somewhere (link): same
 * height, regular weight, padding, and a soft pill on hover, focus, open and the current page.
 */
const ITEM =
  "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-[0.9375rem] leading-none text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime aria-expanded:bg-white/10 aria-expanded:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white";

/**
 * One mega-menu (disclosure pattern): click or Enter toggles it; with a mouse it also opens on hover after
 * a short intent delay and closes when the pointer leaves; Escape closes it and returns focus to the button.
 * The white panel drops below the nav, aligned to its left edge, one column per group.
 */
function Menu({ menu, open, onOpen, onClose }: { menu: NavMenu; open: boolean; onOpen: () => void; onClose: () => void }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function schedule(e: React.PointerEvent, fn: () => void, ms: number) {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }
  return (
    <li
      onPointerEnter={(e) => schedule(e, onOpen, 120)}
      onPointerLeave={(e) => schedule(e, onClose, 180)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          onClose();
          button.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
    >
      <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={() => (open ? onClose() : onOpen())} className={ITEM}>
        {menu.label}
      </button>
      <div id={id} hidden={!open} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
        <div className="flex gap-10 rounded-[18px] bg-white px-8 py-7 text-soot shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)]" /* taste-skill-ignore: a real overlay menu */>
          {menu.groups.map((g) => (
            <div key={g.heading} className="w-[200px]">
              <p className="text-[0.875rem] text-mute-ink">{g.heading}</p>
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

/**
 * The site bar on soot, sticky: the mark, four menus and Pricing in the middle, then Sign in, Talk to sales
 * (outline) and Book a demo (lime) on the right. A one-line announcement above it can be dismissed. Below
 * 1024px a menu drops from the bar with each group as an expandable section.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(true);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenMenu(null);
    setMobile(false);
  }

  useEffect(() => {
    if (!mobile) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobile(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [mobile]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <>
      {notice ? (
        <div className="on-light relative bg-lime px-12 py-2 text-center text-[0.875rem] text-soot">
          <span>The DPDP Rules, 2025 are in force. See what your website needs, and by when.</span>{" "}
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
      <header className="sticky top-0 z-40 bg-soot text-white">
        <div className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-8">
          <Link href="/" aria-label="Plain Theory home" className="flex shrink-0 items-center gap-2.5 rounded-full">
            <BrandMark size={28} variant="lime" />
            <span className="text-[1.125rem] font-semibold tracking-[-0.035em]">Plain Theory</span>
          </Link>
          <nav aria-label="Main" className="relative mx-auto max-lg:hidden">
            <ul className="flex items-center gap-1">
              {MENUS.map((m) => (
                <Menu key={m.id} menu={m} open={openMenu === m.id} onOpen={() => setOpenMenu(m.id)} onClose={() => setOpenMenu((o) => (o === m.id ? null : o))} />
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2 max-lg:ml-auto">
            <span className="max-lg:hidden">
              <Link href={CONTACT.href} aria-current={current(CONTACT.href)} className="mk-stem mk-stem-outline mk-stem-sm">
                {CONTACT.title}
              </Link>
            </span>
            <Link href="/login" className={`${ITEM} max-sm:hidden`}>
              Sign in
            </Link>
            <span className="max-sm:hidden">
              <Link href="/contact?topic=sales" className="mk-stem mk-stem-lime mk-stem-sm">
                Book a demo
              </Link>
            </span>
            <button
              type="button"
              onClick={() => setMobile((o) => !o)}
              aria-expanded={mobile}
              aria-controls="mk-mobile"
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[0.9375rem] font-medium hover:bg-white/10 lg:hidden"
            >
              {mobile ? "Close" : "Menu"}
            </button>
          </div>

          {/* Phones and tablets: every menu as an expandable section, then the plain links */}
          <nav
            id="mk-mobile"
            aria-label="Main"
            hidden={!mobile}
            className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-4rem)] overflow-y-auto bg-soot px-5 pb-10 pt-2 lg:hidden"
          >
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
            <ul>
              {[CONTACT, { href: "/login", title: "Sign in" }].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-14 items-center text-[1.25rem] font-semibold tracking-[-0.03em]">
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3">
              <Link href="/contact?topic=sales" className="mk-stem mk-stem-lime w-full">
                Book a demo
              </Link>
              <Link href="/signup" className="mk-stem mk-stem-outline w-full">
                Start free
              </Link>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
