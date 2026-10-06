import type { Category, ConsentState, LoadOptions, PlainConsentApi } from "./types";

export type { Categories, Category, ConsentEvent, ConsentState, Framework, LoadOptions, PlainConsentApi } from "./types";

/**
 * @plaintheory/consent: framework-agnostic loader and helpers for plain-consent.js.
 * Nothing here touches `window` or `document` at import time, so it is safe in SSR bundles.
 */

export const DEFAULT_SRC = "https://cdn.theplaintheory.com/sdk/v1/plain-consent.js";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

type Queue = ((api: PlainConsentApi) => void)[];
/** Typed view of the global the script defines; avoids augmenting Window for every consumer. */
const win = () => window as unknown as { PlainConsent?: PlainConsentApi | Queue };

/** The live API, or null before the script has run (or on the server). */
export function getApi(): PlainConsentApi | null {
  if (!isBrowser()) return null;
  const pc = win().PlainConsent;
  return pc && !Array.isArray(pc) && typeof pc.get === "function" ? pc : null;
}

/**
 * Run `fn` with the API as soon as it exists. Uses the script's own queue, so it works whether the
 * script loads before or after this call. No-op on the server.
 */
export function withApi(fn: (api: PlainConsentApi) => void): void {
  if (!isBrowser()) return;
  const live = getApi();
  if (live) return fn(live);
  const w = win();
  const queue: Queue = Array.isArray(w.PlainConsent) ? w.PlainConsent : [];
  queue.push(fn);
  w.PlainConsent = queue;
}

let loading: Promise<PlainConsentApi> | null = null;

function scriptSrc(o: LoadOptions) {
  if (o.src) return o.src;
  if (o.apiUrl) return `${new URL(o.apiUrl).origin}/sdk/plain-consent.js`;
  return DEFAULT_SRC;
}

/** A plain-consent.js tag already on the page (for example added in <head> by the server). */
function existingTag(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>('script[data-site][src*="plain-consent"]');
}

/**
 * Add plain-consent.js to the page once and resolve with the API when the site's config has
 * loaded (the "ready" event). Calling it again returns the same promise. If a tag is already in
 * <head>, nothing is injected and the existing script is used.
 *
 * Injected at runtime, the script holds trackers added after it runs. For trackers in your HTML,
 * also put the <script> tag first in <head>; see the docs.
 */
export function loadPlainConsent(options: LoadOptions): Promise<PlainConsentApi> {
  if (!isBrowser()) return Promise.reject(new Error("loadPlainConsent() runs in the browser only. Call it from an effect or client entry."));
  if (loading) return loading;

  loading = new Promise<PlainConsentApi>((resolve, reject) => {
    let settled = false;
    const done = (api: PlainConsentApi) => {
      if (settled) return;
      settled = true;
      resolve(api);
    };
    withApi((api) => {
      api.on("ready", () => done(api));
      window.setTimeout(() => done(api), options.readyTimeoutMs ?? 8000);
    });

    if (getApi() || existingTag()) return;

    const s = document.createElement("script");
    s.src = scriptSrc(options);
    s.setAttribute("data-site", options.siteKey);
    if (options.apiUrl) s.setAttribute("data-api", options.apiUrl);
    if (options.configUrl) s.setAttribute("data-config-url", options.configUrl);
    if (options.debug) s.setAttribute("data-debug", "");
    if (options.nonce) s.nonce = options.nonce;
    s.onerror = () => {
      loading = null;
      if (!settled) reject(new Error(`plain-consent: could not load ${s.src}`));
    };
    // First in <head>, so it runs before anything added after it.
    document.head.insertBefore(s, document.head.firstChild);
  });
  return loading;
}

/* ---------------------------------------------------------------------------------------------
 * Consent store: one shared, framework-agnostic subscription used by the React, Vue, Svelte and
 * Angular bindings. Snapshots are stable objects (only replaced when consent changes), which is
 * what useSyncExternalStore and signal-based frameworks need.
 * ------------------------------------------------------------------------------------------- */

let snapshot: ConsentState | null = null;
const subscribers = new Set<() => void>();
let attached = false;

function publish(next: ConsentState) {
  snapshot = next;
  subscribers.forEach((fn) => fn());
}

function attach() {
  if (attached || !isBrowser()) return;
  attached = true;
  window.addEventListener("plainconsent:change", (e) => publish((e as CustomEvent<ConsentState>).detail));
  withApi((api) => {
    api.on("ready", publish);
  });
}

export const consentStore = {
  /** Current state, or null until the script is ready (always null on the server). */
  getSnapshot(): ConsentState | null {
    attach();
    return snapshot;
  },
  getServerSnapshot(): ConsentState | null {
    return null;
  },
  subscribe(fn: () => void): () => void {
    attach();
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },
};

/** Current consent state, or null before the script is ready. */
export function getConsent(): ConsentState | null {
  return consentStore.getSnapshot() ?? getApi()?.get() ?? null;
}

/** Whether a category is allowed right now. `essential` is always true. */
export function isAllowed(category: Category, state: ConsentState | null = getConsent()): boolean {
  return category === "essential" || state?.categories[category] === true;
}

/** Call `fn` with the state when the script becomes ready and on every change. Returns an unsubscribe function. */
export function onConsentChange(fn: (state: ConsentState) => void): () => void {
  return consentStore.subscribe(() => {
    const s = consentStore.getSnapshot();
    if (s) fn(s);
  });
}

/** Resolve once `category` is allowed (immediately if it already is). Never rejects. */
export function whenAllowed(category: Category): Promise<void> {
  if (isAllowed(category)) return Promise.resolve();
  return new Promise((resolve) => {
    const off = onConsentChange((s) => {
      if (isAllowed(category, s)) {
        off();
        resolve();
      }
    });
  });
}

/**
 * Inject a third-party script only after its category is allowed. Deduplicated by `src`.
 * Resolves with the script element once it has been added to the page.
 */
export async function loadScriptWhenAllowed(
  category: Category,
  src: string,
  attrs: Record<string, string | boolean> = {},
): Promise<HTMLScriptElement> {
  await whenAllowed(category);
  const found = document.querySelector<HTMLScriptElement>(`script[src="${CSS.escape(src)}"]`);
  if (found) return found;
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    s.setAttribute(k, v === true ? "" : v);
  }
  document.head.appendChild(s);
  return s;
}

/** Actions that queue safely before the script loads. */
export const consentActions = {
  acceptAll: () => withApi((a) => a.acceptAll()),
  rejectAll: () => withApi((a) => a.rejectAll()),
  set: (partial: Partial<Record<Category, boolean>>) => withApi((a) => a.set(partial)),
  open: () => withApi((a) => a.open()),
  revoke: () => withApi((a) => a.revoke()),
};
