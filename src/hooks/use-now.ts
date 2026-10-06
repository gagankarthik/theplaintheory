"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time in the browser, refreshed every minute. Statically built pages render with the
 * build time on the server; after hydration this switches to the visitor's clock, so countdowns and
 * "next milestone" markers never go stale between deploys.
 */
const TICK_MS = 60_000;
let cached = 0;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, TICK_MS);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// Rounded to the minute so the snapshot is stable between ticks (useSyncExternalStore requirement).
function getSnapshot() {
  const now = Math.floor(Date.now() / TICK_MS) * TICK_MS;
  if (now !== cached) cached = now;
  return cached;
}

export function useNow(buildTime: number) {
  return useSyncExternalStore(subscribe, getSnapshot, () => buildTime);
}

export function daysUntil(iso: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
}
