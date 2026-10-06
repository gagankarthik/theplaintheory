# Plain Theory for Angular

A signals-based service (Angular 16+). It's distributed as source: copy `src/plain-consent.service.ts` into your app and install the core package.

```bash
npm i @plaintheory/consent
```

## Install the script

Put it first in `src/index.html` so trackers in your HTML are held:

```html
<head>
  <script src="https://cdn.theplaintheory.com/sdk/v1/plain-consent.js" data-site="pk_live_YOUR_SITE_KEY"></script>
</head>
```

Or let the service load it from your root component:

```ts
export class AppComponent {
  private readonly consent = inject(PlainConsentService);
  constructor() {
    this.consent.init({ siteKey: "pk_live_YOUR_SITE_KEY" });
  }
}
```

## Use it

```ts
@Component({
  selector: "app-video",
  standalone: true,
  template: `
    @if (marketing()) {
      <iframe src="https://www.youtube-nocookie.com/embed/..." title="Product tour"></iframe>
    } @else {
      <p>Allow marketing cookies to watch this video.</p>
      <button (click)="consent.open()">Privacy choices</button>
    }
  `,
})
export class VideoComponent {
  readonly consent = inject(PlainConsentService);
  readonly marketing = this.consent.allowed("marketing");
}
```

`PlainConsentService` exposes `state`, `ready`, `allowed(category)`, `init`, `acceptAll`, `rejectAll`, `set`, `open` and `revoke`. With SSR (`@angular/ssr`) the state stays `null` on the server and nothing is loaded.
