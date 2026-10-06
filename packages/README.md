# Plain Theory framework packages

`plain-consent.js` works on any site with one script tag. These packages wrap it for modern frameworks: typed state, hooks or stores, consent-gated components, and safe loading during server-side rendering.

| Package | For | What you get |
| --- | --- | --- |
| [`@plaintheory/consent`](./consent) | Any framework, plain ESM, Astro, Remix | `loadPlainConsent`, `getConsent`, `onConsentChange`, `whenAllowed`, `loadScriptWhenAllowed`, types |
| [`@plaintheory/react`](./react) | React 18+, Next.js, Vite, Remix | `PlainConsentProvider`, `useConsent`, `useConsentAllowed`, `ConsentGate`, `ConsentScript`, `PrivacyChoicesButton` |
| [`@plaintheory/vue`](./vue) | Vue 3.3+, Nuxt 3 | `createPlainConsent` plugin, `useConsent` composable, `ConsentGate` |
| [`@plaintheory/svelte`](./svelte) | Svelte 4 and 5, SvelteKit | `consent` store, `allowed(category)` store, `init` |
| [`angular`](./angular) | Angular 16+ | `PlainConsentService` with signals (source to copy into your app) |

All of them share one subscription to the script (`consentStore` in `@plaintheory/consent`), so state stays consistent across islands and micro-frontends.

## Script tag or package?

- **Script tag in `<head>` (recommended for production).** It runs before any other script, so it can hold trackers that are written directly into your HTML. Add it, then use a package for state and components. The packages detect the existing tag and don't load a second copy.
- **Package only.** `loadPlainConsent()` adds the script at runtime. It holds every tracker added after it runs, including all known trackers (Google Analytics, Meta Pixel, Hotjar and others), but can't stop `<script>` tags that the browser already ran.

## Building

Each package builds with its own `tsc`:

```bash
cd packages/consent && npm i && npm run build
cd packages/react && npm i && npm run build
```

Publish `@plaintheory/consent` first; the framework packages depend on it.
