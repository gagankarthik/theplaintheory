# @theplaintheory/consent

Framework-agnostic loader and typed helpers for the [Plain Theory](https://www.theplaintheory.in) consent script. The React, Vue, Svelte and Angular packages are built on it; use it directly with plain JavaScript, Astro, Remix or anything else.

```bash
npm install @theplaintheory/consent
```

## Load the script

For production, put the script tag first in `<head>` so it can hold trackers written into your HTML (copy it from the dashboard's **Install** page). Then use this package for state; it detects the tag and never adds a second copy.

Or load it from code:

```ts
import { loadPlainConsent } from "@theplaintheory/consent";

const api = await loadPlainConsent({ siteKey: "pk_YOUR_SITE_KEY" });
```

| Option | What it does |
| --- | --- |
| `siteKey` | Your public site key (`pk_` + 16 characters). Required. |
| `src` | Script URL. Default `https://www.theplaintheory.in/sdk/plain-consent.js`. |
| `apiUrl` | Consent API (`data-api`). Default: the script's origin + `/api/v1`. |
| `configUrl` | Published config URL (`data-config-url`), e.g. on a CDN. |
| `gcm` | Google Consent Mode v2 defaults before the config arrives (`data-gcm`). |
| `debug` | Allow `?plain_country=` overrides outside localhost. |
| `nonce` | CSP nonce for the injected tag. |
| `readyTimeoutMs` | Resolve after this long even if the config hasn't arrived (default 8000). |

## Read and change consent

```ts
import { consentActions, getConsent, isAllowed, onConsentChange, whenAllowed, loadScriptWhenAllowed } from "@theplaintheory/consent";

isAllowed("analytics");                       // false until the visitor allows it
const off = onConsentChange((s) => console.log(s.categories, s.language));
await whenAllowed("marketing");               // resolves once allowed
await loadScriptWhenAllowed("analytics", "https://www.googletagmanager.com/gtag/js?id=G-XXXX");

consentActions.open();                        // reopen preferences ("Privacy choices")
consentActions.setLanguage("hi");             // show the notice in one of your languages
consentActions.revoke();                      // withdraw consent
```

Categories are `essential` (always allowed), `functional`, `analytics` and `marketing`. Actions called before the script has loaded are queued and run once it arrives. Nothing touches `window` at import time, so it's safe in server-rendered bundles; state is `null` on the server and until the script is ready.

A script that has already run can't be unloaded, so a withdrawal takes effect from the next page view.

MIT · [Docs](https://www.theplaintheory.in/docs#frameworks)
