"use client";

import { consentActions, consentStore, isAllowed, loadPlainConsent, loadScriptWhenAllowed, type Category, type ConsentState, type LoadOptions } from "@theplaintheory/consent";
import { useEffect, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";

export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@theplaintheory/consent";
export { getConsent, isAllowed, loadPlainConsent, loadScriptWhenAllowed, onConsentChange, whenAllowed } from "@theplaintheory/consent";

/**
 * Loads plain-consent.js once on the client. Render it near the root (Next.js: app/layout.tsx).
 * If the script tag is already in <head>, nothing is injected; the provider just waits for it.
 * Hooks and components below work anywhere under it, and also without it if you add the tag yourself.
 */
export function PlainConsentProvider({ children, ...options }: LoadOptions & { children?: ReactNode }) {
  const { siteKey, src, apiUrl, configUrl, gcm, debug, nonce, readyTimeoutMs } = options;
  useEffect(() => {
    // A failed load leaves known trackers blocked and no banner shown; log it rather than throw.
    loadPlainConsent({ siteKey, src, apiUrl, configUrl, gcm, debug, nonce, readyTimeoutMs }).catch((e: unknown) => console.warn(e));
  }, [siteKey, src, apiUrl, configUrl, gcm, debug, nonce, readyTimeoutMs]);
  return <>{children}</>;
}

const useConsentState = () => useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getServerSnapshot);

export interface UseConsent {
  /** null on the server and until the script is ready */
  state: ConsentState | null;
  ready: boolean;
  acceptAll(): void;
  rejectAll(): void;
  set(partial: Partial<Record<Category, boolean>>): void;
  /** open the preferences panel */
  open(): void;
  /** forget the choice and ask again */
  revoke(): void;
  /** show the notice in one of the site's languages; "" for the default */
  setLanguage(code: string): void;
}

/** Consent state and actions. Concurrent-safe (useSyncExternalStore) and SSR-safe (null on the server). */
export function useConsent(): UseConsent {
  const state = useConsentState();
  return { state, ready: state !== null, ...consentActions };
}

/** Whether a category is allowed. False on the server and before the script is ready (except `essential`). */
export function useConsentAllowed(category: Category): boolean {
  return isAllowed(category, useConsentState());
}

/** True once the script has loaded the site's settings (false on the server). */
export function useConsentReady(): boolean {
  return useConsentState() !== null;
}

/** Render children only when `category` is allowed; otherwise render `fallback`. */
export function ConsentGate({ category, children, fallback = null }: { category: Category; children: ReactNode; fallback?: ReactNode }) {
  return <>{useConsentAllowed(category) ? children : fallback}</>;
}

/**
 * Add a third-party script once `category` is allowed. Renders nothing. Deduplicated by `src`,
 * and never removed: scripts can't be unloaded, so a later withdrawal applies from the next page view.
 */
export function ConsentScript({
  category,
  src,
  async = true,
  attributes,
  onLoad,
}: {
  category: Category;
  src: string;
  async?: boolean;
  attributes?: Record<string, string>;
  onLoad?: () => void;
}) {
  const allowed = useConsentAllowed(category);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    loadScriptWhenAllowed(category, src, { ...attributes, ...(async ? { async: true } : {}) }).then((s) => {
      if (live && onLoad) s.addEventListener("load", onLoad, { once: true });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attributes/onLoad apply to the first insertion only
  }, [allowed, category, src, async]);
  return null;
}

/**
 * A button that reopens the preferences panel. Required by DPDPA and good practice under GDPR:
 * withdrawing consent must be as easy as giving it. Put it in your footer.
 */
export function PrivacyChoicesButton({ children = "Privacy choices", onClick, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) consentActions.open();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
