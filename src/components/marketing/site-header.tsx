"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { daysUntil, useNow } from "@/hooks/use-now";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { demoEnabled } from "@/lib/demo";
import { cascadeIn } from "@/lib/motion";
import { IconChevronDown, IconChevronRight, IconLifebuoy, Logo } from "@/components/icons";
import { FRAMEWORK_LOGOS } from "./framework-logos";
import { IconBrowserSignal, IconCalifornia, IconChakra, IconEuStars } from "./home/coverage-icons";
import { COMPLIANCE_NAV, DEVELOPER_NAV, PRODUCT_GROUPS, PRODUCT_NAV, RESOURCES_NAV, type NavItem } from "./nav-data";

type MenuId = "product" | "compliance" | "developers" | "resources";

const LAW_ICONS: Record<string, (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  GDPR: IconEuStars,
  "CCPA/CPRA": IconCalifornia,
  DPDPA: IconChakra,
};

/** Two bars that rotate into an X when the menu is open. */
function MenuGlyph({ open }: { open: boolean }) {
  const bar = "absolute left-0 h-[1.5px] w-5 rounded-full bg-current transition-transform duration-500 ease-[var(--ease-spring)]";
  return (
    <span aria-hidden className="relative block h-3 w-5">
      <span className={`${bar} top-0 ${open ? "translate-y-[5px] rotate-45" : ""}`} />
      <span className={`${bar} bottom-0 ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
    </span>
  );
}

/** One menu row: icon tile, title, one line of description, and a chevron that slides in on hover. */
function MenuRow({ item, icon, onSelect }: { item: NavItem; icon?: ReactNode; onSelect: () => void }) {
  const Icon = item.icon;
  return (
    <li data-anim>
      <Link
        href={item.href}
        onClick={onSelect}
        className="group flex items-start gap-3 rounded-[12px] p-2.5 outline-none transition-colors duration-200 hover:bg-paper focus-visible:bg-paper"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-ink-2 ring-1 ring-inset ring-line transition-colors duration-200 group-hover:text-brand group-hover:ring-brand/25">
          {icon ?? (Icon ? <Icon size={18} /> : null)}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center gap-1 text-sm font-medium text-ink">
            {item.title}
            <IconChevronRight
              size={14}
              className="-translate-x-1 text-ink-3 opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-spring)] group-hover:translate-x-0 group-hover:opacity-100"
            />
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{item.description}</span>
        </span>
      </Link>
    </li>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1.5 text-xs font-medium text-ink-3">{children}</p>;
}

/** Days until the DPDP Rules' core duties apply. */
/** When this static page was rendered; the countdown switches to the visitor's clock on load. */
const BUILD_TIME = Date.now();

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState<MenuId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const hoverTimer = useRef<number | undefined>(undefined);
  const ids = { product: useId(), compliance: useId(), developers: useId(), resources: useId() };
  const drawerId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus?: MenuId | null) => {
    setOpen(null);
    if (refocus) triggers.current[refocus]?.focus();
  }, []);

  // Close menus on navigation (state adjusted during render when the route changes).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setDrawer(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawer) setDrawer(false);
      else close(open);
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, drawer, close]);

  // Menu contents cascade in as a panel or the mobile sheet opens.
  const drawerNavRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (open) cascadeIn(document.getElementById(ids[open]), { y: 8, stagger: 0.025 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids are stable for the component's life
  }, [open]);
  useLayoutEffect(() => {
    if (drawer) cascadeIn(drawerNavRef.current, { y: 16, stagger: 0.03 });
  }, [drawer]);

  // Lock page scroll behind the mobile menu and move focus into it.
  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    if (drawer) closeRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawer]);

  // Hover intent for mouse users; touch and keyboard use click.
  const hoverOpen = (id: MenuId) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(id), 90);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(null), 180);
  };
  const dismiss = () => setOpen(null);

  const navItem =
    "inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-ink/[0.04] hover:text-ink aria-expanded:bg-ink/[0.04] aria-expanded:text-ink aria-[current=page]:text-ink";

  const trigger = (id: MenuId, label: string) => (
    <button
      ref={(el) => {
        triggers.current[id] = el;
      }}
      type="button"
      aria-expanded={open === id}
      aria-controls={ids[id]}
      onClick={() => setOpen((o) => (o === id ? null : id))}
      onPointerEnter={hoverOpen(id)}
      onPointerLeave={hoverClose}
      className={navItem}
    >
      {label}
      <IconChevronDown size={14} className={`text-ink-3 transition-transform duration-300 ease-[var(--ease-spring)] ${open === id ? "rotate-180" : ""}`} />
    </button>
  );

  /** Shared panel shell: full-width sheet under the bar, content on the page grid, gentle entrance. */
  const panel = (id: MenuId, children: ReactNode) => (
    <div
      id={ids[id]}
      hidden={open !== id}
      onPointerEnter={hoverOpen(id)}
      onPointerLeave={hoverClose}
      className="absolute inset-x-0 top-full hidden border-b border-line bg-white shadow-[0_32px_64px_-32px_rgba(11,16,32,0.35)] lg:block"
    >
      <div className="pt-menu container-page py-7">{children}</div>
    </div>
  );

  const showBorder = scrolled || open !== null;
  /** On the home page the bar sits on the hero's own gradient until the visitor scrolls or opens a menu. */
  const overlay = pathname === "/" && !showBorder;
  const now = useNow(BUILD_TIME);
  const dpdpDays = daysUntil("2027-05-13T00:00:00+05:30", now);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-150 ${
        showBorder
          ? "border-line bg-white shadow-[0_8px_24px_-18px_rgba(11,16,32,0.25)] backdrop-blur-xl backdrop-saturate-150"
          : overlay
            ? "border-transparent bg-transparent"
            : "border-transparent bg-white"
      }`}
    >
      <div className="container-page flex h-16 items-center">
        {/* Fixed-width brand column keeps the centred nav truly centred */}
        <div className="flex flex-1 items-center">
          <Link href="/" aria-label="Plain Theory home" className="-ml-1 inline-flex h-10 items-center rounded-md px-1">
            <Logo size={17} />
          </Link>
        </div>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            <li onPointerLeave={hoverClose}>{trigger("product", "Product")}</li>
            <li onPointerLeave={hoverClose}>{trigger("compliance", "Compliance")}</li>
            <li onPointerLeave={hoverClose}>{trigger("developers", "Developers")}</li>
            <li onPointerLeave={hoverClose}>{trigger("resources", "Resources")}</li>
            <li>
              <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined} className={navItem}>
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-1.5 lg:flex">
          <Link href="/login" className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-2 transition-colors hover:bg-ink/[0.04] hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-pill btn-primary h-9 px-4">
            Try for free
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="ml-auto grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.05] lg:hidden"
          aria-expanded={drawer}
          aria-controls={drawerId}
          aria-label="Open menu"
          onClick={() => setDrawer(true)}
        >
          <MenuGlyph open={drawer} />
        </button>
      </div>

      {/* Product */}
      {panel(
        "product",
        <div className="grid grid-cols-12 gap-6">
          {PRODUCT_GROUPS.map((g) => (
            <div key={g.label} className="col-span-3">
              <GroupLabel>{g.label}</GroupLabel>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <MenuRow key={item.title} item={item} onSelect={dismiss} />
                ))}
              </ul>
            </div>
          ))}
          {demoEnabled ? (
            <Link
              href="/demo"
              onClick={dismiss}
              data-anim
              className="group col-span-3 flex flex-col gap-5 self-start overflow-hidden rounded-[16px] bg-paper p-5 ring-1 ring-inset ring-line transition-colors hover:ring-ink/20"
            >
              {/* a miniature banner, the product itself */}
              <span aria-hidden className="block rounded-[10px] bg-white p-3 shadow-[var(--shadow-lift)] ring-1 ring-line">
                <span className="block h-2 w-24 rounded-full bg-ink/80" />
                <span className="mt-2 block h-1.5 w-full rounded-full bg-line" />
                <span className="mt-1 block h-1.5 w-3/4 rounded-full bg-line" />
                <span className="mt-3 grid grid-cols-3 gap-1.5">
                  <span className="h-5 rounded-md bg-brand" />
                  <span className="h-5 rounded-md ring-1 ring-line-strong" />
                  <span className="h-5 rounded-md bg-brand" />
                </span>
              </span>
              <span className="block">
                <span className="flex items-center gap-1 text-sm font-medium text-ink">
                  Open the demo store
                  <IconChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-[13px] text-ink-3">The real script on a real page. Choose, then revoke.</span>
              </span>
            </Link>
          ) : null}
        </div>,
      )}

      {/* Compliance */}
      {panel(
        "compliance",
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-9">
            <GroupLabel>Laws we cover</GroupLabel>
            <ul className="grid grid-cols-3 gap-0.5">
              {COMPLIANCE_NAV.map((item) => {
                const LawIcon = LAW_ICONS[item.title];
                return (
                  <MenuRow key={item.title} item={item} onSelect={dismiss} icon={LawIcon ? <LawIcon width={18} height={18} /> : undefined} />
                );
              })}
              <MenuRow
                item={{ href: "/compliance/ccpa#detail", title: "Global Privacy Control", description: "The browser opt-out signal, honoured." }}
                icon={<IconBrowserSignal width={18} height={18} />}
                onSelect={dismiss}
              />
            </ul>
          </div>
          <Link
            href="/compliance/dpdpa"
            onClick={dismiss}
            data-anim
            className="group col-span-3 flex flex-col justify-between rounded-[16px] bg-ink p-5 text-white transition-colors hover:bg-ink-raised"
          >
            <span>
              <span className="block text-xs text-white/65">DPDP Rules, core duties apply in</span>
              <span className="display mt-2 block whitespace-nowrap text-[2rem] tabular-nums">{dpdpDays} days</span>
              <span className="mt-1 block text-[13px] text-white/65">13 May 2027</span>
            </span>
            <span className="mt-6 flex items-center gap-1 text-sm font-medium">
              Read the readiness guide
              <IconChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>,
      )}

      {/* Developers */}
      {panel(
        "developers",
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-6">
            <GroupLabel>Build with Plain Theory</GroupLabel>
            <ul className="grid grid-cols-2 gap-0.5">
              {DEVELOPER_NAV.map((item) => (
                <MenuRow key={item.title} item={item} onSelect={dismiss} />
              ))}
            </ul>
          </div>
          <div data-anim className="col-span-5 col-start-8 rounded-[16px] bg-ink-raised p-5 text-white">
            <p className="text-xs text-white/65">Works with</p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Supported frameworks">
              {FRAMEWORK_LOGOS.map((f) => (
                <li key={f.name} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1.5 pr-2.5 text-xs text-white/80 ring-1 ring-inset ring-white/10">
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden className="fill-white/85">
                    <path d={f.path} />
                  </svg>
                  {f.name}
                </li>
              ))}
            </ul>
            <pre className="mt-4 overflow-x-auto rounded-[10px] bg-black/25 px-3 py-2.5 font-mono text-[12px] text-white/85">
              <code>npm i @plaintheory/react</code>
            </pre>
          </div>
        </div>,
      )}

      {/* Resources */}
      {panel(
        "resources",
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <GroupLabel>Help and contact</GroupLabel>
            <ul className="grid grid-cols-3 gap-0.5">
              {RESOURCES_NAV.map((item) => (
                <MenuRow key={item.title} item={item} onSelect={dismiss} />
              ))}
            </ul>
          </div>
          <Link
            href="/contact/support"
            onClick={dismiss}
            data-anim
            className="group col-span-4 flex items-start gap-3 self-start rounded-[16px] bg-paper p-5 ring-1 ring-inset ring-line transition-colors hover:ring-ink/20"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-brand ring-1 ring-inset ring-line">
              <IconLifebuoy size={18} />
            </span>
            <span className="block">
              <span className="flex items-center gap-1 text-sm font-medium text-ink">
                Raise a support ticket
                <IconChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-[13px] text-ink-3">Something not working? Our engineers reply within one business day.</span>
            </span>
          </Link>
        </div>,
      )}

      {/* Mobile menu: full-screen sheet with its own close control */}
      <div
        id={drawerId}
        hidden={!drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-white lg:hidden"
      >
        <div className="container-page flex h-16 shrink-0 items-center border-b border-line">
          <Link href="/" aria-label="Plain Theory home" onClick={() => setDrawer(false)}>
            <Logo size={17} />
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => {
              setDrawer(false);
              menuButtonRef.current?.focus();
            }}
            aria-label="Close menu"
            className="ml-auto grid size-11 place-items-center rounded-full text-ink"
          >
            <MenuGlyph open />
          </button>
        </div>
        <nav ref={drawerNavRef} aria-label="Mobile" className="container-page flex flex-1 flex-col py-6">
          {[
            { label: "Product", items: PRODUCT_NAV },
            { label: "Compliance", items: COMPLIANCE_NAV },
            { label: "Developers", items: DEVELOPER_NAV },
            { label: "Resources", items: RESOURCES_NAV },
          ].map((group) => (
            <div key={group.label} className="mb-8">
              <p className="text-xs font-medium text-ink-3">{group.label}</p>
              <ul className="mt-2">
                {group.items.map((item) => (
                  <li key={item.title} data-anim>
                    <Link href={item.href} onClick={() => setDrawer(false)} className="flex min-h-12 items-center border-b border-line text-base text-ink">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul>
            {[
              { href: "/pricing", t: "Pricing" },
              { href: "/login", t: "Log in" },
            ].map((l) => (
              <li key={l.href} data-anim>
                <Link href={l.href} onClick={() => setDrawer(false)} className="flex min-h-12 items-center border-b border-line text-base font-medium text-ink">
                  {l.t}
                </Link>
              </li>
            ))}
          </ul>
          <div data-anim className="mt-auto grid gap-3 pt-10">
            <Link href="/signup" onClick={() => setDrawer(false)} className="btn btn-pill btn-primary btn-lg">
              Try for free
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
