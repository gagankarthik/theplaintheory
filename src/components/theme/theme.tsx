"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Dashboard theme: "system" (follow the OS), "light" or "dark". The choice lives in localStorage
 * (`pt-theme`); the resolved theme is written to <html data-theme>, which globals.css uses to swap
 * every colour variable. Marketing pages never set it, so they always render light.
 */
export type ThemePref = "system" | "light" | "dark";
const KEY = "pt-theme";
const EVENT = "pt-theme-change";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(pref: ThemePref) {
  document.documentElement.dataset.theme = resolve(pref);
}

// useLayoutEffect warns during SSR; this resolves to a no-op there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps <html data-theme> in sync while a themed area is mounted (client navigations included) and
 * removes it again when you leave for the marketing site.
 */
export function ThemeScope() {
  useIsoLayoutEffect(() => {
    apply(readPref());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => apply(readPref());
    media.addEventListener("change", sync);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      delete document.documentElement.dataset.theme;
    };
  }, []);
  return null;
}

const noop = () => () => {};

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  const set = (p: ThemePref) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    apply(p);
    window.dispatchEvent(new Event(EVENT));
  };
  return [pref, set];
}

const OPTIONS: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System",
    icon: (
      <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" />
        <path d="M5.5 14h5M8 11.25V14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
      </svg>
    ),
  },
];

/** Three-way switch for the account menu and settings. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useThemePref();
  // The stored choice is only known in the browser; render a neutral state until mounted.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded-md bg-paper p-0.5 ring-1 ring-inset ring-line ${className}`}>
      {OPTIONS.map((o) => {
        const active = mounted && pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.label}
            onClick={() => setPref(o.value)}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs transition-colors ${
              active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(16_19_31/0.12)] ring-1 ring-inset ring-line" : "text-ink-3 hover:text-ink"
            }`}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
