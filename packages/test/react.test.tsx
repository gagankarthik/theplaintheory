import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConsentGate, ConsentScript, PlainConsentProvider, PrivacyChoicesButton, useConsent, useConsentAllowed, useConsentReady } from "../react/src/index";
import { installFakeSdk, resetDom } from "./fake-sdk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement;
const render = (ui: React.ReactNode) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(ui));
};

beforeEach(resetDom);
afterEach(async () => {
  act(() => root?.unmount());
  root = null;
  await resetDom();
});

function Status() {
  const { state, ready, acceptAll, setLanguage } = useConsent();
  const analytics = useConsentAllowed("analytics");
  const r = useConsentReady();
  return (
    <div>
      <span data-testid="ready">{String(ready && r)}</span>
      <span data-testid="analytics">{String(analytics)}</span>
      <span data-testid="lang">{state?.language ?? "-"}</span>
      <button data-testid="accept" onClick={acceptAll}>accept</button>
      <button data-testid="hindi" onClick={() => setLanguage("hi")}>hi</button>
    </div>
  );
}
const text = (id: string) => host.querySelector(`[data-testid="${id}"]`)!.textContent;

describe("@theplaintheory/react", () => {
  it("hooks render safely on the server (not ready, nothing allowed)", () => {
    const html = renderToString(<Status />);
    expect(html).toContain("false");
  });

  it("hooks follow the script: ready, then the visitor's choice and language", () => {
    const sdk = installFakeSdk({ ready: false });
    render(<Status />);
    expect(text("ready")).toBe("false");
    act(() => sdk.becomeReady());
    expect(text("ready")).toBe("true");
    expect(text("analytics")).toBe("false");
    act(() => (host.querySelector('[data-testid="accept"]') as HTMLButtonElement).click());
    expect(text("analytics")).toBe("true");
    act(() => (host.querySelector('[data-testid="hindi"]') as HTMLButtonElement).click());
    expect(text("lang")).toBe("hi");
    expect(sdk.calls).toEqual(["acceptAll", "lang:hi"]);
  });

  it("ConsentGate swaps the fallback for the content once allowed", () => {
    const sdk = installFakeSdk();
    render(
      <ConsentGate category="marketing" fallback={<p>blocked</p>}>
        <p>video</p>
      </ConsentGate>,
    );
    expect(host.textContent).toBe("blocked");
    act(() => sdk.api.set({ marketing: true }));
    expect(host.textContent).toBe("video");
  });

  it("ConsentScript adds the tag only after consent", async () => {
    const sdk = installFakeSdk();
    const src = "https://example.test/pixel.js";
    render(<ConsentScript category="marketing" src={src} attributes={{ "data-id": "7" }} />);
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    await act(async () => sdk.api.acceptAll());
    const s = document.querySelector(`script[src="${src}"]`);
    expect(s?.getAttribute("data-id")).toBe("7");
  });

  it("PrivacyChoicesButton opens the preferences", () => {
    const sdk = installFakeSdk();
    render(<PrivacyChoicesButton className="link">Cookie settings</PrivacyChoicesButton>);
    const b = host.querySelector("button")!;
    expect(b.textContent).toBe("Cookie settings");
    expect(b.getAttribute("type")).toBe("button");
    act(() => b.click());
    expect(sdk.calls).toEqual(["open"]);
  });

  it("PlainConsentProvider loads the script once with its options", () => {
    render(
      <PlainConsentProvider siteKey="pk_react" gcm>
        <span>app</span>
      </PlainConsentProvider>,
    );
    const tags = document.head.querySelectorAll('script[data-site="pk_react"]');
    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute("data-gcm")).toBe("true");
    expect(host.textContent).toBe("app");
  });
});
