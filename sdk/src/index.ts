import { createTransport } from "./api";
import { release, setPatterns, startBlocking } from "./blocker";
import { loadConfig, readSettings } from "./config";
import { createGcm } from "./consent-mode";
import { pickLang } from "./lang";
import { watchLeaks } from "./leaks";
import { ALL, NONE, isFresh, randomId, readStored, writeStored } from "./storage";
import type { Action, CategoryId, Cats, ConsentState, Framework, PublicConfig, Stored } from "./types";
import { createUi, type UiHandlers, type View } from "./ui";

/** Path for leak reports with identifier-like segments (emails, long numbers, UUIDs, tokens) replaced, so no personal data leaves the page. */
const safePath = (p: string) =>
  p
    .split("/")
    .map((s) => (/@|\d{4,}|^[\w-]{24,}$/.test(s) ? ":id" : s))
    .join("/")
    .slice(0, 300);

/**
 * plain-consent.js — The Plain Theory consent SDK.
 *   <script src="https://cdn.theplaintheory.com/sdk/v1/plain-consent.js" data-site="pk_..."></script>
 * Must be the first script in <head> so it can hold trackers before they load.
 */
type Listener = (s: ConsentState) => void;
type EventName = "change" | "ready";
type Queued = (api: PlainConsentApi) => void;

export interface PlainConsentApi {
  version: string;
  get(): ConsentState;
  acceptAll(): void;
  rejectAll(): void;
  set(partial: Partial<Cats>): void;
  open(): void;
  revoke(): void;
  on(ev: EventName, fn: Listener): () => void;
  push(fn: Queued): void;
  /** show the notice in a translation the site configured (e.g. "hi", "ta"); "" for the default */
  setLanguage(code: string): void;
  preview(c: PublicConfig, f?: Framework, v?: "banner" | "prefs", lang?: string): void;
}

// Held from the first instant, before the site's own tracker list arrives with the config.
const BUILTIN = [
  ["googletagmanager.com/gtag", "analytics"],
  ["google-analytics.com", "analytics"],
  ["static.hotjar.com", "analytics"],
  ["clarity.ms", "analytics"],
  ["connect.facebook.net", "marketing"],
  ["snap.licdn.com", "marketing"],
  ["analytics.tiktok.com", "marketing"],
  ["googleadservices.com", "marketing"],
].map(([p, c]) => ({ p, c }));

const w = window as Window & { PlainConsent?: PlainConsentApi | Queued[] };
const settings = readSettings(document.currentScript as HTMLScriptElement | null);
const transport = createTransport(settings.api, settings.siteKey);
const gcm = createGcm();
const ui = createUi();

let cfg: PublicConfig | null = null;
let framework: Framework = "generic";
let cats: Cats = { ...NONE };
let decided = false;
let visitorId = "";
let bannerShown = false;
/** notice translation in use; undefined = the region's default copy */
let lang: string | undefined;
/** a "reject all" timestamp, kept so re-ask suppression survives later partial changes */
let rejectedAt: number | undefined;
/** performance.now() when each category became allowed (leak detection) */
const grantedAt: Partial<Record<CategoryId, number>> = {};
const nav = navigator as Navigator & { globalPrivacyControl?: boolean; webdriver?: boolean };
const gpcOn = nav.globalPrivacyControl === true;
const listeners: Record<EventName, Listener[]> = { change: [], ready: [] };

const ruleLang = () => (cfg && (cfg.regions[framework] || cfg.regions.generic)?.language) || "en";
const state = (): ConsentState => ({ framework, categories: { ...cats }, decided, visitorId, language: lang || ruleLang() });
const whenBody = (fn: () => void) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn, { once: true }));

function emit(ev: EventName) {
  const s = state();
  listeners[ev].forEach((fn) => {
    try {
      fn(s);
    } catch {
      /* a listener error must never break consent */
    }
  });
  if (ev === "change") w.dispatchEvent(new CustomEvent("plainconsent:change", { detail: s }));
}

/** Opt-out regions (CCPA) start granted; Global Privacy Control always opts out of marketing. */
function initialCategories(c: PublicConfig, f: Framework): Cats {
  const optOut = c.regions[f]?.model === "opt-out";
  return { essential: true, functional: optOut, analytics: optOut, marketing: optOut && !gpcOn };
}

/** Record when categories become allowed, so leak detection can tell consented requests apart. */
function markGranted(at = performance.now()) {
  (Object.keys(cats) as CategoryId[]).forEach((c) => {
    if (!cats[c]) delete grantedAt[c];
    else if (grantedAt[c] === undefined) grantedAt[c] = at;
  });
}

const persist = () =>
  writeStored(
    { v: cfg?.version ?? 0, f: framework, c: cats, t: Date.now(), id: visitorId, ...(rejectedAt ? { r: rejectedAt } : {}), ...(lang ? { l: lang } : {}) } as Stored,
    Math.max(cfg?.expiryDays ?? 180, rejectedAt ? (cfg?.reask ?? 180) : 0),
  );

function show(view: View) {
  if (!cfg || cfg.headless) return;
  if (view === "banner" && !bannerShown) {
    bannerShown = true;
    transport.beacon("/event", { kind: "view" });
  }
  ui.render({ cfg, framework, cats, view, fab: true, lang }, handlers);
}

/** Receipts carry the signals that make them evidence: GPC honoured, automated browser, language shown. */
function logReceipt(action: Action) {
  if (!cfg) return;
  transport.post("/consent", {
    visitorId,
    action,
    framework,
    categories: cats,
    configVersion: cfg.version,
    gpc: gpcOn && !cats.marketing,
    automated: nav.webdriver === true,
    language: lang || ruleLang(),
  });
}

function decide(action: Action, next: Cats) {
  cats = { ...next, essential: true };
  decided = true;
  rejectedAt = action === "reject_all" ? Date.now() : undefined;
  persist();
  markGranted();
  if (cfg?.gcm) gcm.update(cats);
  release();
  logReceipt(action);
  show("fab");
  emit("change");
}

const handlers: UiHandlers = {
  accept: () => decide("accept_all", ALL),
  reject: () => decide("reject_all", NONE),
  save: (c) => decide("custom", c),
  close: () => show(decided ? "fab" : "banner"),
  lang: (code) => setLang(code, false),
};

function setLang(code: string, rerender = true) {
  const rule = cfg && (cfg.regions[framework] || cfg.regions.generic);
  lang = rule ? pickLang(rule, code || rule.language) : undefined;
  if (decided) persist();
  if (rerender && cfg) show(ui.current() === "none" ? (decided ? "fab" : "banner") : (ui.current() as View));
}

async function boot() {
  const stored = readStored();
  visitorId = stored?.id || randomId();
  if (stored) cats = { ...stored.c, essential: true }; // honour a returning visitor's choice before config arrives
  gcm.default(cats);
  startBlocking(BUILTIN, (c) => cats[c] === true);

  try {
    ({ cfg, framework } = await loadConfig(settings));
  } catch {
    return; // no config: known trackers stay held, no banner
  }
  const patterns = BUILTIN.concat(cfg.trackers);
  setPatterns(patterns);
  decided = isFresh(stored, cfg);
  cats = decided ? { ...stored!.c, essential: true } : initialCategories(cfg, framework);
  rejectedAt = decided ? stored!.r : undefined;
  const rule = cfg.regions[framework] || cfg.regions.generic;
  lang = rule ? pickLang(rule, stored?.l) : undefined;
  // A returning visitor's and an opt-out region's categories count as allowed from page start.
  markGranted(0);
  if (cfg.gcm) gcm.update(cats);
  release();
  if (cfg.leaks)
    watchLeaks(
      () => patterns,
      (c) => grantedAt[c] ?? Infinity,
      (url, category) => transport.beacon("/leak", { url, category, page: safePath(location.pathname), framework }),
    );
  whenBody(() => show(decided ? "fab" : "banner"));
  emit("ready");

  addEventListener("pagehide", () => {
    if (bannerShown && !decided) transport.beacon("/event", { kind: "bounce" });
  });
}

const api: PlainConsentApi = {
  version: "1.0.0",
  get: state,
  acceptAll: handlers.accept,
  rejectAll: handlers.reject,
  set: (partial) => decide("custom", { ...cats, ...partial }),
  open: () => show("prefs"),
  revoke() {
    writeStored(null);
    cats = { ...NONE };
    logReceipt("revoke");
    decided = false;
    rejectedAt = undefined;
    markGranted();
    if (cfg?.gcm) gcm.update(cats);
    show("banner");
    emit("change");
  },
  on(ev, fn) {
    listeners[ev].push(fn);
    if (ev === "ready" && cfg) fn(state());
    return () => {
      listeners[ev] = listeners[ev].filter((f) => f !== fn);
    };
  },
  push: (fn) => fn(api),
  setLanguage: (code) => setLang(code),
  /** Builder preview: render a given config with no storage, network or blocking. */
  preview(c, f = "gdpr", v = "banner", l) {
    const local: Cats = { ...NONE };
    let pl = l || undefined;
    const draw = (view: View) => ui.render({ cfg: c, framework: f, cats: local, view, fab: true, lang: pl }, h);
    const h: UiHandlers = {
      accept: () => draw("fab"),
      reject: () => draw("fab"),
      save: () => draw("fab"),
      close: () => draw("banner"),
      lang: (code) => (pl = code === (c.regions[f] || c.regions.generic)?.language ? undefined : code),
    };
    whenBody(() => draw(v));
  },
};

const queued = Array.isArray(w.PlainConsent) ? w.PlainConsent : [];
w.PlainConsent = api;
if (settings.siteKey) boot();
queued.forEach((fn) => {
  try {
    fn(api);
  } catch {
    /* ignore errors from queued callbacks */
  }
});
