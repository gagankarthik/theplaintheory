import type { Cats } from "./types";

/**
 * Google Consent Mode v2. Nothing is touched until `start`: only sites with Consent Mode on get the
 * dataLayer/gtag shim (so signals queue even before gtag.js loads) and a "default" command. Sites
 * without it keep their own gtag untouched and never see denied defaults they didn't ask for.
 */
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
  let on = false;
  return {
    active: () => on,
    /** Install the shim and send the defaults, once. */
    start(c: Cats) {
      if (on) return;
      on = true;
      w.dataLayer = w.dataLayer || [];
      if (!w.gtag) {
        w.gtag = function () {
          // gtag requires the arguments object itself, not an array
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
      }
      w.gtag("consent", "default", { ...consentSignals(c), wait_for_update: 500 });
    },
    /** Send the visitor's choice; does nothing unless started. */
    update(c: Cats) {
      if (on) w.gtag!("consent", "update", consentSignals(c));
    },
  };
}
