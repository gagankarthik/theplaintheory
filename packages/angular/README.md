# @theplaintheory/angular

Angular bindings for [Plain Theory](https://www.theplaintheory.in) consent: a signals service, `providePlainConsent()` and the `*plainConsentAllowed` directive, with types. Angular 17.1 and later, standalone, SSR-safe.

```bash
npm install @theplaintheory/angular
```

## Set up

```ts
// main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { providePlainConsent } from "@theplaintheory/angular";
import { App } from "./app/app";

bootstrapApplication(App, { providers: [providePlainConsent({ siteKey: "pk_YOUR_SITE_KEY" })] });
```

For trackers written into your HTML, also put the script tag first in `<head>` in `index.html` (from the dashboard's **Install** page); the provider detects it and doesn't add a second copy. During server rendering nothing is loaded and the state stays `null`.

## Use it

```ts
import { Component, inject } from "@angular/core";
import { PlainConsentAllowedDirective, PlainConsentService } from "@theplaintheory/angular";

@Component({
  selector: "app-video",
  imports: [PlainConsentAllowedDirective],
  template: `
    <iframe *plainConsentAllowed="'marketing'; else blocked" src="https://www.youtube.com/embed/…" title="Video"></iframe>
    <ng-template #blocked><p>Allow marketing cookies to watch this video.</p></ng-template>
    <button type="button" (click)="consent.open()">Privacy choices</button>
  `,
})
export class VideoComponent {
  readonly consent = inject(PlainConsentService);
  readonly analytics = this.consent.allowed("analytics"); // Signal<boolean>
}
```

`PlainConsentService`: `state` and `ready` signals, `allowed(category)` returning a signal, and `acceptAll`, `rejectAll`, `set`, `open`, `revoke`, `setLanguage`, `init`. Everything from [`@theplaintheory/consent`](https://www.npmjs.com/package/@theplaintheory/consent) is re-exported.

MIT · [Docs](https://www.theplaintheory.in/docs#frameworks)
