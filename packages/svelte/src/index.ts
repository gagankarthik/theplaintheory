import { consentActions, consentStore, isAllowed, loadPlainConsent, type Category, type ConsentState, type LoadOptions } from "@plaintheory/consent";
import { derived, readable, type Readable } from "svelte/store";

export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@plaintheory/consent";
export { getConsent, loadPlainConsent, loadScriptWhenAllowed, whenAllowed } from "@plaintheory/consent";

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

/** A store that is true while `category` is allowed (`essential` is always true). */
export const allowed = (category: Category): Readable<boolean> => derived(consent, (s) => isAllowed(category, s));

/** Actions that queue safely before the script loads. */
export const acceptAll = consentActions.acceptAll;
export const rejectAll = consentActions.rejectAll;
export const setConsent = consentActions.set;
/** open the preferences panel */
export const openPreferences = consentActions.open;
/** forget the choice and ask again */
export const revoke = consentActions.revoke;
