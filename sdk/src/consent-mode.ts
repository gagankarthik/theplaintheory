import type { Cats } from "./types";

/** Google Consent Mode v2. Defines a dataLayer/gtag shim so signals queue even before gtag.js loads. */
type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };

const g = (v: boolean) => (v ? "granted" : "denied");

export function consentSignals(c: Cats) {
  return {
    ad_storage: g(c.marketing),
    ad_user_data: g(c.marketing),
    ad_personalization: g(c.marketing),
    analytics_storage: g(c.analytics),
    functionality_storage: g(c.functional),
    personalization_storage: g(c.functional),
    security_storage: "granted",
  };
}

export function createGcm(w: W = window as W) {
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) {
    w.gtag = function () {
      // gtag requires the arguments object itself, not an array
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  return {
    default: (c: Cats) => w.gtag!("consent", "default", { ...consentSignals(c), wait_for_update: 500 }),
    update: (c: Cats) => w.gtag!("consent", "update", consentSignals(c)),
  };
}
