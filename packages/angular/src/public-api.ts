/*
 * @theplaintheory/angular: Plain Theory consent for Angular 17.1+ (signals, standalone, SSR-safe).
 */
export { PlainConsentService } from "./plain-consent.service";
export { PlainConsentAllowedDirective } from "./consent-allowed.directive";
export { providePlainConsent } from "./provide";
export type { Categories, Category, ConsentState, Framework, LoadOptions, PlainConsentApi } from "@theplaintheory/consent";
export { getConsent, isAllowed, loadPlainConsent, loadScriptWhenAllowed, onConsentChange, whenAllowed } from "@theplaintheory/consent";
