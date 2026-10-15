// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://shop.example/","settings":{"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"navigation":{"disableChildFrameNavigation":true}}}
import { afterEach, describe, expect, it, vi } from "vitest";
import { consentSignals, createGcm } from "../../sdk/src/consent-mode";
import type { PlainConsentApi } from "../../sdk/src/index";
import type { PublicConfig } from "../../sdk/src/types";
import { publicConfig } from "./fixture";

type GWin = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; PlainConsent?: PlainConsentApi };
const w = window as GWin;
const NONE = { essential: true, functional: false, analytics: false, marketing: false };
const ALL = { essential: true, functional: true, analytics: true, marketing: true };
/** dataLayer entries are Arguments objects; compare them as arrays */
const layer = () => (w.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));

describe("createGcm", () => {
  it("touches nothing until started", () => {
    const fake = {} as GWin;
    const gcm = createGcm(fake);
    gcm.update(ALL);
    expect(fake.gtag).toBeUndefined();
    expect(fake.dataLayer).toBeUndefined();
    expect(gcm.active()).toBe(false);
  });

  it("start sends defaults once through a gtag shim, then updates", () => {
    const fake = {} as GWin;
    const gcm = createGcm(fake);
    gcm.start(NONE);
    gcm.start(ALL); // idempotent
    gcm.update(ALL);
    const entries = fake.dataLayer!.map((a) => Array.from(a as ArrayLike<unknown>));
    expect(entries).toEqual([
      ["consent", "default", { ...consentSignals(NONE), wait_for_update: 500 }],
      ["consent", "update", consentSignals(ALL)],
    ]);
    expect(consentSignals(NONE)).toMatchObject({ ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", security_storage: "granted" });
    expect(consentSignals(ALL)).toMatchObject({ ad_storage: "granted", analytics_storage: "granted", ad_personalization: "granted" });
  });

  it("keeps a site's own gtag function", () => {
    const own = vi.fn();
    const fake = { gtag: own } as unknown as GWin;
    createGcm(fake).start(NONE);
    expect(own).toHaveBeenCalledWith("consent", "default", expect.objectContaining({ ad_storage: "denied" }));
  });
});

/** Boot the real SDK entry with a script tag and a mocked config response. */
async function boot(cfg: PublicConfig, attrs: Record<string, string> = {}, pending = false) {
  vi.resetModules();
  const script = document.createElement("script");
  script.setAttribute("data-site", "pk_test");
  script.setAttribute("data-config-url", "https://cdn.example/c/pk_test.json");
  for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
  Object.defineProperty(document, "currentScript", { configurable: true, get: () => script });
  const res = new Response(JSON.stringify(cfg), { status: 200, headers: { "content-type": "application/json", "x-plain-country": "DE" } });
  vi.stubGlobal("fetch", vi.fn(() => (pending ? new Promise(() => {}) : Promise.resolve(res))));
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { sendBeacon: () => true }));
  await import("../../sdk/src/index");
  const api = w.PlainConsent as PlainConsentApi;
  if (!pending) await new Promise<void>((r) => api.on("ready", () => r()));
  return api;
}

afterEach(() => {
  delete w.gtag;
  delete w.dataLayer;
  delete w.PlainConsent;
  localStorage.clear();
  document.cookie = "plain_consent=;Max-Age=0;Path=/";
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("SDK boot and Consent Mode", () => {
  it("with Consent Mode off: no gtag shim and nothing pushed, before or after a choice", async () => {
    const api = await boot(publicConfig((c) => (c.googleConsentMode = false)));
    expect(w.gtag).toBeUndefined();
    expect(w.dataLayer).toBeUndefined();
    api.acceptAll();
    expect(w.gtag).toBeUndefined();
    expect(w.dataLayer).toBeUndefined();
  });

  it("with Consent Mode on: denied defaults, then the visitor's update", async () => {
    const api = await boot(publicConfig((c) => (c.googleConsentMode = true)));
    expect(layer()[0]).toEqual(["consent", "default", { ...consentSignals(NONE), wait_for_update: 500 }]);
    api.acceptAll();
    expect(layer().at(-1)).toEqual(["consent", "update", consentSignals(ALL)]);
    expect(api.get().categories.marketing).toBe(true);
  });

  it("data-gcm sets the defaults before the config arrives", async () => {
    await boot(publicConfig(), { "data-gcm": "true" }, true);
    expect(layer()).toEqual([["consent", "default", { ...consentSignals(NONE), wait_for_update: 500 }]]);
  });

  it("without data-gcm, nothing is sent before the config on a first visit", async () => {
    await boot(publicConfig(), {}, true);
    expect(w.dataLayer).toBeUndefined();
    expect(w.gtag).toBeUndefined();
  });

  it("remembers the last config's setting so a return visit sets defaults early", async () => {
    await boot(publicConfig((c) => (c.googleConsentMode = true)));
    delete w.gtag;
    delete w.dataLayer;
    await boot(publicConfig(), {}, true);
    expect(layer()[0]?.slice(0, 2)).toEqual(["consent", "default"]);
  });

  it("data-gcm=false keeps a site that turned Consent Mode off untouched", async () => {
    await boot(publicConfig((c) => (c.googleConsentMode = true)));
    delete w.gtag;
    delete w.dataLayer;
    await boot(publicConfig(), { "data-gcm": "false" }, true);
    expect(w.dataLayer).toBeUndefined();
  });
});
