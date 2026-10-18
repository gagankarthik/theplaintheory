import type { Categories, ConsentState, PlainConsentApi } from "../consent/src/types";

/**
 * A stand-in for plain-consent.js with its real contract: window.PlainConsent (taking over a queue
 * left by callers that ran first), on("ready") firing at once once configured, and a
 * "plainconsent:change" window event plus "change" listeners on every decision.
 */
export function installFakeSdk({ ready = true }: { ready?: boolean } = {}) {
  const w = window as unknown as { PlainConsent?: PlainConsentApi | ((api: PlainConsentApi) => void)[] };
  let cats: Categories = { essential: true, functional: false, analytics: false, marketing: false };
  let decided = false;
  let language = "en";
  let configured = ready;
  const listeners: Record<"change" | "ready", ((s: ConsentState) => void)[]> = { change: [], ready: [] };
  const calls: string[] = [];
  const state = (): ConsentState => ({ framework: "gdpr", categories: { ...cats }, decided, visitorId: "0".repeat(32), language });
  const emit = (ev: "change" | "ready") => {
    const s = state();
    listeners[ev].forEach((fn) => fn(s));
    if (ev === "change") window.dispatchEvent(new CustomEvent("plainconsent:change", { detail: s }));
  };
  const decide = (next: Categories, call: string) => {
    calls.push(call);
    cats = next;
    decided = true;
    emit("change");
  };
  const api: PlainConsentApi = {
    version: "1.0.0",
    get: state,
    acceptAll: () => decide({ essential: true, functional: true, analytics: true, marketing: true }, "acceptAll"),
    rejectAll: () => decide({ essential: true, functional: false, analytics: false, marketing: false }, "rejectAll"),
    set: (p) => decide({ ...cats, ...p }, `set:${JSON.stringify(p)}`),
    open: () => calls.push("open"),
    revoke: () => {
      calls.push("revoke");
      cats = { essential: true, functional: false, analytics: false, marketing: false };
      decided = false;
      emit("change");
    },
    on(ev, fn) {
      listeners[ev].push(fn);
      if (ev === "ready" && configured) fn(state());
      return () => {
        listeners[ev] = listeners[ev].filter((f) => f !== fn);
      };
    },
    push: (fn) => fn(api),
    setLanguage: (code) => {
      calls.push(`lang:${code}`);
      language = code || "en";
      emit("change");
    },
  };
  const queued = Array.isArray(w.PlainConsent) ? w.PlainConsent : [];
  w.PlainConsent = api;
  queued.forEach((fn) => fn(api));
  return {
    api,
    calls,
    /** the config arrives: "ready" fires */
    becomeReady() {
      configured = true;
      emit("ready");
    },
  };
}

/** Clean slate between tests: no global, no script tags, fresh package state. */
export async function resetDom() {
  delete (window as unknown as { PlainConsent?: unknown }).PlainConsent;
  document.head.querySelectorAll("script").forEach((s) => s.remove());
  document.body.innerHTML = "";
  const core = await import("@theplaintheory/consent");
  core.__resetForTests();
}
