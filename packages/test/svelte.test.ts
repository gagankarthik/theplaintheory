import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAll, allowed, consent, consentScript, init, openPreferences, ready, revoke, setConsent, setLanguage } from "../svelte/src/index";
import { installFakeSdk, resetDom } from "./fake-sdk";

beforeEach(resetDom);
afterEach(resetDom);

describe("@theplaintheory/svelte", () => {
  it("stores follow the script", () => {
    const sdk = installFakeSdk({ ready: false });
    const values: (boolean | null)[] = [];
    const off = consent.subscribe((s) => values.push(s ? s.categories.analytics : null));
    expect(get(ready)).toBe(false);
    sdk.becomeReady();
    expect(get(ready)).toBe(true);
    expect(get(allowed("analytics"))).toBe(false);
    acceptAll();
    expect(get(allowed("analytics"))).toBe(true);
    setConsent({ analytics: false });
    expect(get(allowed("analytics"))).toBe(false);
    expect(get(allowed("essential"))).toBe(true);
    expect(values).toEqual([null, false, true, false]);
    off();
  });

  it("actions reach the script, including language and withdrawal", () => {
    const sdk = installFakeSdk();
    setLanguage("bn");
    openPreferences();
    revoke();
    expect(sdk.calls).toEqual(["lang:bn", "open", "revoke"]);
    expect(get(consent)?.language).toBe("bn");
  });

  it("the consentScript action waits for consent", async () => {
    installFakeSdk();
    const src = "https://example.test/svelte-pixel.js";
    consentScript(document.createElement("div"), { category: "analytics", src });
    await Promise.resolve();
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    acceptAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector(`script[src="${src}"]`)).not.toBeNull();
  });

  it("init loads the script once", () => {
    void init({ siteKey: "pk_svelte" });
    void init({ siteKey: "pk_svelte" });
    expect(document.head.querySelectorAll('script[data-site="pk_svelte"]')).toHaveLength(1);
  });
});
