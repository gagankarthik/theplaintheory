import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders, type EnvironmentProviders } from "@angular/core";
import type { LoadOptions } from "@theplaintheory/consent";
import { PlainConsentService } from "./plain-consent.service";

/**
 * Load plain-consent.js when the app starts (browser only; nothing happens during server rendering).
 *
 *   bootstrapApplication(App, { providers: [providePlainConsent({ siteKey: "pk_YOUR_SITE_KEY" })] });
 */
export function providePlainConsent(options: LoadOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        void inject(PlainConsentService).init(options);
      },
    },
  ]);
}
