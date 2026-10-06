"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isCurrency } from "@/lib/plans";
import type { Currency, Period } from "./billing";

/**
 * Billing choices live in the URL (?currency=eur&period=annual) so a quote can be shared.
 * Read through useSyncExternalStore: the server and first paint use the defaults, then the
 * client switches to whatever the URL says without a hydration mismatch.
 */
const EVENT = "pt-billing-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

const readSearch = () => window.location.search;
const serverSearch = () => "";

export function useBilling() {
  const search = useSyncExternalStore(subscribe, readSearch, serverSearch);
  const params = new URLSearchParams(search);
  const raw = params.get("currency");
  const currency: Currency = isCurrency(raw) ? raw : "usd";
  const period: Period = params.get("period") === "annual" ? "annual" : "monthly";

  const update = useCallback((patch: Partial<{ currency: Currency; period: Period }>) => {
    const next = new URLSearchParams(window.location.search);
    // Defaults are left out of the URL so the plain /pricing link stays canonical.
    if (patch.currency === "usd") next.delete("currency");
    else if (patch.currency) next.set("currency", patch.currency);
    if (patch.period === "monthly") next.delete("period");
    else if (patch.period) next.set("period", patch.period);
    const qs = next.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { currency, period, setCurrency: (c: Currency) => update({ currency: c }), setPeriod: (p: Period) => update({ period: p }) };
}
