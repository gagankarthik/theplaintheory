# @plaintheory/consent

Framework-agnostic loader and helpers for the Plain Theory consent script. No dependencies, ESM, tree-shakeable, and safe to import during server-side rendering (it never touches `window` at import time).

```bash
npm i @plaintheory/consent
```

## Load the script

```ts
import { loadPlainConsent } from "@plaintheory/consent";

const api = await loadPlainConsent({ siteKey: "pk_live_YOUR_SITE_KEY" });
console.log(api.get()); // { framework, categories, decided, visitorId }
```

`loadPlainConsent` adds `plain-consent.js` once and resolves when your published config has loaded. Calling it again returns the same promise. If the script tag is already in `<head>`, nothing is added.

| Option | Type | Description |
| --- | --- | --- |
| `siteKey` | `string` | Your public site key. Required. |
| `src` | `string` | Script URL. Defaults to the Plain Theory CDN, or `{origin of apiUrl}/sdk/plain-consent.js` when `apiUrl` is set. |
| `apiUrl` | `string` | API base for receipts (`data-api`). |
| `configUrl` | `string` | Published config URL (`data-config-url`). |
| `debug` | `boolean` | Allow `?plain_country=` location overrides outside localhost. |
| `readyTimeoutMs` | `number` | Resolve anyway after this long if the config doesn't arrive. Default 8000. |
| `nonce` | `string` | CSP nonce for the injected tag. |

## React to consent

```ts
import { getConsent, onConsentChange, whenAllowed, loadScriptWhenAllowed, consentActions } from "@plaintheory/consent";

getConsent();                         // ConsentState | null
const off = onConsentChange((s) => console.log(s.categories));
await whenAllowed("analytics");       // resolves once analytics is allowed
await loadScriptWhenAllowed("marketing", "https://connect.facebook.net/en_US/fbevents.js");
consentActions.open();                // show the preferences panel (queues if the script isn't ready)
```

Categories are `essential` (always allowed), `functional`, `analytics` and `marketing`.

## Works with

Vite, Next.js, Nuxt, SvelteKit, Astro, Remix and plain `<script type="module">`. For React, Vue, Svelte and Angular bindings see the sibling packages.
