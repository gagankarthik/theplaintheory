import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consentActions, consentStore, getConsent, isAllowed, loadPlainConsent, loadScriptWhenAllowed, onConsentChange, whenAllowed, withApi } from "@theplaintheory/consent";
import { installFakeSdk, resetDom } from "./fake-sdk";

beforeEach(resetDom);
afterEach(resetDom);

describe("@theplaintheory/consent", () => {
  it("queues actions called before the script, and runs them once it arrives", () => {
    consentActions.acceptAll();
    expect(Array.isArray((window as unknown as { PlainConsent: unknown }).PlainConsent)).toBe(true);
    const sdk = installFakeSdk();
    expect(sdk.calls).toEqual(["acceptAll"]);
  });

  it("loadPlainConsent adds one script tag first in <head>, with the site's attributes", async () => {
    document.head.appendChild(document.createElement("meta"));
    const p = loadPlainConsent({ siteKey: "pk_test", apiUrl: "https://www.theplaintheory.in/api/v1", configUrl: "https://cdn.example/c/pk_test.json", gcm: true, nonce: "n1" });
    const again = loadPlainConsent({ siteKey: "pk_test" });
    expect(again).toBe(p);
    const tags = document.head.querySelectorAll("script");
    expect(tags).toHaveLength(1);
    const s = tags[0];
    expect(document.head.firstChild).toBe(s);
    expect(s.getAttribute("src")).toBe("https://www.theplaintheory.in/sdk/plain-consent.js");
    expect(s.getAttribute("data-site")).toBe("pk_test");
    expect(s.getAttribute("data-api")).toBe("https://www.theplaintheory.in/api/v1");
    expect(s.getAttribute("data-config-url")).toBe("https://cdn.example/c/pk_test.json");
    expect(s.getAttribute("data-gcm")).toBe("true");
    expect(s.nonce).toBe("n1");
    // the script "loads": the promise resolves with the API once the config is ready
    const sdk = installFakeSdk();
    await expect(p).resolves.toBe(sdk.api);
  });

  it("defaults to the app-served script; a custom src wins", () => {
    void loadPlainConsent({ siteKey: "pk_a", src: "https://cdn.example/sdk/v1/plain-consent.js" }).catch(() => {});
    expect(document.head.querySelector("script")?.getAttribute("src")).toBe("https://cdn.example/sdk/v1/plain-consent.js");
  });

  it("doesn't add a second copy when the tag is already in <head>", async () => {
    const tag = document.createElement("script");
    tag.src = "https://www.theplaintheory.in/sdk/plain-consent.js";
    tag.setAttribute("data-site", "pk_head");
    document.head.appendChild(tag);
    const p = loadPlainConsent({ siteKey: "pk_head" });
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    installFakeSdk();
    await expect(p).resolves.toBeTruthy();
  });

  it("the store is null until ready, then follows every change", () => {
    const sdk = installFakeSdk({ ready: false });
    const seen: (string | null)[] = [];
    const off = consentStore.subscribe(() => seen.push(consentStore.getSnapshot()?.categories.analytics ? "on" : "off"));
    expect(consentStore.getSnapshot()).toBeNull();
    expect(consentStore.getServerSnapshot()).toBeNull();
    sdk.becomeReady();
    expect(consentStore.getSnapshot()?.decided).toBe(false);
    consentActions.acceptAll();
    expect(getConsent()?.categories.analytics).toBe(true);
    consentActions.set({ analytics: false });
    expect(seen).toEqual(["off", "on", "off"]);
    off();
  });

  it("snapshots are stable between changes (what useSyncExternalStore needs)", () => {
    installFakeSdk();
    const a = consentStore.getSnapshot();
    expect(consentStore.getSnapshot()).toBe(a);
    consentActions.rejectAll();
    expect(consentStore.getSnapshot()).not.toBe(a);
  });

  it("isAllowed: essential always; others only when on", () => {
    expect(isAllowed("essential", null)).toBe(true);
    expect(isAllowed("analytics", null)).toBe(false);
    installFakeSdk();
    expect(isAllowed("marketing")).toBe(false);
    consentActions.set({ marketing: true });
    expect(isAllowed("marketing")).toBe(true);
  });

  it("whenAllowed and onConsentChange wait for the visitor", async () => {
    installFakeSdk();
    const changes: boolean[] = [];
    const off = onConsentChange((s) => changes.push(s.categories.analytics));
    let done = false;
    const p = whenAllowed("analytics").then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    consentActions.acceptAll();
    await p;
    expect(done).toBe(true);
    expect(changes).toContain(true);
    off();
  });

  it("loadScriptWhenAllowed adds the script only after consent, and only once", async () => {
    installFakeSdk();
    const src = "https://www.googletagmanager.com/gtag/js?id=G-TEST";
    const p = loadScriptWhenAllowed("analytics", src, { "data-x": "1", defer: true });
    await Promise.resolve();
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    consentActions.set({ analytics: true });
    const s = await p;
    expect(s.getAttribute("data-x")).toBe("1");
    expect(s.hasAttribute("defer")).toBe(true);
    await loadScriptWhenAllowed("analytics", src);
    expect(document.querySelectorAll(`script[src="${src}"]`)).toHaveLength(1);
  });

  it("revoke and setLanguage reach the script", () => {
    const sdk = installFakeSdk();
    consentActions.acceptAll();
    consentActions.revoke();
    consentActions.setLanguage("hi");
    consentActions.open();
    expect(sdk.calls).toEqual(["acceptAll", "revoke", "lang:hi", "open"]);
    expect(getConsent()?.language).toBe("hi");
    expect(getConsent()?.decided).toBe(false);
  });

  it("withApi runs at once when the script is already there", () => {
    const sdk = installFakeSdk();
    let got: unknown = null;
    withApi((a) => (got = a));
    expect(got).toBe(sdk.api);
  });
});
