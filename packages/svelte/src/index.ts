import { consentActions, consentStore, isAllowed, loadPlainConsent, loadScriptWhenAllowed, type Category, type ConsentState, type LoadOptions } from "@theplaintheory/consent";
import { derived, readable, type Readable } from "svelte/store";

export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@theplaintheory/consent";
export { getConsent, isAllowed, loadPlainConsent, loadScriptWhenAllowed, onConsentChange, whenAllowed } from "@theplaintheory/consent";

/**
 * Load plain-consent.js once. Call from a browser-only place, e.g. `onMount` in your root
 * +layout.svelte. Safe to call on the server: it resolves to undefined there.
 */
export function init(options: LoadOptions) {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  return loadPlainConsent(options).catch((e: unknown) => {
    console.warn(e);
    return undefined;
  });
}

/** Consent state: null on the server and until the script is ready. Works with `$consent` in Svelte 4 and 5. */
export const consent: Readable<ConsentState | null> = readable<ConsentState | null>(null, (set) => {
  if (typeof window === "undefined") return;
  set(consentStore.getSnapshot());
  return consentStore.subscribe(() => set(consentStore.getSnapshot()));
});

/** True once the script has loaded the site's settings (false on the server). */
export const ready: Readable<boolean> = derived(consent, (s) => s !== null);

/** A store that is true while `category` is allowed (`essential` is always true). */
export const allowed = (category: Category): Readable<boolean> => derived(consent, (s) => isAllowed(category, s));

/**
 * Svelte action: add a third-party script once `category` is allowed (deduplicated, never removed).
 *
 *   <div use:consentScript={{ category: "analytics", src: "https://www.googletagmanager.com/gtag/js?id=G-XXXX" }} />
 */
export function consentScript(_node: Element, params: { category: Category; src: string; attributes?: Record<string, string> }) {
  void loadScriptWhenAllowed(params.category, params.src, params.attributes ?? {});
  return {};
}

/** Actions that queue safely before the script loads. */
export const acceptAll = consentActions.acceptAll;
export const rejectAll = consentActions.rejectAll;
export const setConsent = consentActions.set;
/** open the preferences panel (wire it to a "Privacy choices" link in your footer) */
export const openPreferences = consentActions.open;
/** forget the choice and ask again */
export const revoke = consentActions.revoke;
/** show the notice in one of the site's languages; "" for the default */
export const setLanguage = consentActions.setLanguage;
