import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { ConsentGate, ConsentScript, createPlainConsent, PrivacyChoicesButton, useConsent } from "../vue/src/index";
import { installFakeSdk, resetDom } from "./fake-sdk";

let app: App | null = null;
let host: HTMLElement;
const mount = (component: Parameters<typeof createApp>[0], plugin?: ReturnType<typeof createPlainConsent>) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp(component);
  if (plugin) app.use(plugin);
  app.mount(host);
};

beforeEach(resetDom);
afterEach(async () => {
  app?.unmount();
  app = null;
  await resetDom();
});

describe("@theplaintheory/vue", () => {
  it("useConsent is reactive: ready, allowed and language follow the script", async () => {
    const sdk = installFakeSdk({ ready: false });
    mount(
      defineComponent({
        setup() {
          const c = useConsent();
          const analytics = c.allowed("analytics");
          return () => h("p", `${c.ready.value}|${analytics.value}|${c.state.value?.language ?? "-"}`);
        },
      }),
    );
    expect(host.textContent).toBe("false|false|-");
    sdk.becomeReady();
    await nextTick();
    expect(host.textContent).toBe("true|false|en");
    sdk.api.acceptAll();
    sdk.api.setLanguage("ta");
    await nextTick();
    expect(host.textContent).toBe("true|true|ta");
  });

  it("ConsentGate shows the fallback slot until allowed", async () => {
    const sdk = installFakeSdk();
    mount(defineComponent({ render: () => h(ConsentGate, { category: "marketing" }, { default: () => h("p", "video"), fallback: () => h("p", "blocked") }) }));
    expect(host.textContent).toBe("blocked");
    sdk.api.set({ marketing: true });
    await nextTick();
    expect(host.textContent).toBe("video");
  });

  it("ConsentScript adds the tag after consent, PrivacyChoicesButton opens preferences", async () => {
    const sdk = installFakeSdk();
    const src = "https://example.test/vue-pixel.js";
    mount(defineComponent({ render: () => [h(ConsentScript, { category: "analytics", src }), h(PrivacyChoicesButton, { class: "link" })] }));
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    sdk.api.acceptAll();
    await nextTick();
    await Promise.resolve();
    expect(document.querySelector(`script[src="${src}"]`)).not.toBeNull();
    const b = host.querySelector("button")!;
    expect(b.textContent).toBe("Privacy choices");
    b.click();
    expect(sdk.calls).toContain("open");
  });

  it("the plugin loads the script once", () => {
    mount(defineComponent({ render: () => h("p", "app") }), createPlainConsent({ siteKey: "pk_vue" }));
    expect(document.head.querySelectorAll('script[data-site="pk_vue"]')).toHaveLength(1);
  });
});
