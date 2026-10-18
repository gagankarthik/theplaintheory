import "@angular/compiler";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
// The published artifact itself (ng-packagr's partial compilation, linked at runtime by the JIT compiler):
// run `npm run build -w @theplaintheory/angular` first; `npm test` does.
import { PlainConsentAllowedDirective, PlainConsentService, providePlainConsent } from "../angular/dist/fesm2022/theplaintheory-angular.mjs";
import { installFakeSdk, resetDom } from "./fake-sdk";

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
beforeEach(async () => {
  await resetDom();
  TestBed.resetTestingModule();
});
afterEach(resetDom);

// A host component, declared with the decorator as a plain call (no decorator syntax in the test).
class Host {}
Component({
  standalone: true,
  imports: [PlainConsentAllowedDirective],
  template: `<p *plainConsentAllowed="'marketing'; else blocked">video</p>
    <ng-template #blocked><p>blocked</p></ng-template>`,
})(Host);

describe("@theplaintheory/angular", () => {
  it("the service exposes consent as signals and forwards actions", () => {
    const sdk = installFakeSdk({ ready: false });
    const consent = TestBed.inject(PlainConsentService);
    const analytics = consent.allowed("analytics");
    expect(consent.ready()).toBe(false);
    sdk.becomeReady();
    expect(consent.ready()).toBe(true);
    expect(analytics()).toBe(false);
    consent.acceptAll();
    expect(analytics()).toBe(true);
    consent.setLanguage("mr");
    expect(consent.state()?.language).toBe("mr");
    consent.open();
    expect(sdk.calls).toEqual(["acceptAll", "lang:mr", "open"]);
  });

  it("*plainConsentAllowed shows the else template until allowed", async () => {
    const sdk = installFakeSdk();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe("blocked");
    sdk.api.set({ marketing: true });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe("video");
  });

  it("providePlainConsent loads the script when the app starts", () => {
    TestBed.configureTestingModule({ providers: [providePlainConsent({ siteKey: "pk_ng" })] });
    TestBed.inject(PlainConsentService);
    expect(document.head.querySelectorAll('script[data-site="pk_ng"]')).toHaveLength(1);
  });
});
