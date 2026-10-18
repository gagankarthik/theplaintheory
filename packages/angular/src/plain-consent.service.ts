import { computed, inject, Injectable, PLATFORM_ID, signal, type OnDestroy, type Signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { consentActions, consentStore, isAllowed, loadPlainConsent, type Category, type ConsentState, type LoadOptions } from "@theplaintheory/consent";

/**
 * Plain Theory consent as Angular signals. SSR-safe: on the server the state stays null and nothing
 * is loaded. Load the script with `providePlainConsent({ siteKey })` in your app config, or call
 * `init()` yourself.
 *
 *   private readonly consent = inject(PlainConsentService);
 *   readonly analytics = this.consent.allowed("analytics");
 */
@Injectable({ providedIn: "root" })
export class PlainConsentService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _state = signal<ConsentState | null>(null);
  private off: () => void = () => undefined;

  /** null on the server and until the script is ready */
  readonly state: Signal<ConsentState | null> = this._state.asReadonly();
  readonly ready = computed(() => this._state() !== null);

  readonly acceptAll = consentActions.acceptAll;
  readonly rejectAll = consentActions.rejectAll;
  readonly set = consentActions.set;
  /** open the preferences panel (wire it to a "Privacy choices" link in your footer) */
  readonly open = consentActions.open;
  /** forget the choice and ask again */
  readonly revoke = consentActions.revoke;
  /** show the notice in one of the site's languages; "" for the default */
  readonly setLanguage = consentActions.setLanguage;

  constructor() {
    if (!this.browser) return;
    this._state.set(consentStore.getSnapshot());
    this.off = consentStore.subscribe(() => this._state.set(consentStore.getSnapshot()));
  }

  /** Load plain-consent.js once. No-op on the server. */
  init(options: LoadOptions): Promise<void> {
    if (!this.browser) return Promise.resolve();
    return loadPlainConsent(options).then(
      () => undefined,
      (e: unknown) => console.warn(e),
    );
  }

  /** A signal that is true while `category` is allowed (`essential` is always true). */
  allowed(category: Category): Signal<boolean> {
    return computed(() => isAllowed(category, this._state()));
  }

  ngOnDestroy() {
    this.off();
  }
}
