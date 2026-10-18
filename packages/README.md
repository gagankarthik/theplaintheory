# Plain Theory framework packages

`plain-consent.js` works on any site with one script tag. These packages wrap it for modern frameworks: typed state, hooks or stores, consent-gated components, and safe loading during server-side rendering.

| Package | For | What you get |
| --- | --- | --- |
| [`@theplaintheory/consent`](./consent) | Any framework, plain ESM, Astro, Remix | `loadPlainConsent`, `getConsent`, `isAllowed`, `onConsentChange`, `whenAllowed`, `loadScriptWhenAllowed`, `consentActions`, types |
| [`@theplaintheory/react`](./react) | React 18+, Next.js, Vite, Remix | `PlainConsentProvider`, `useConsent`, `useConsentAllowed`, `useConsentReady`, `ConsentGate`, `ConsentScript`, `PrivacyChoicesButton` |
| [`@theplaintheory/vue`](./vue) | Vue 3.3+, Nuxt 3 | `createPlainConsent` plugin, `useConsent`, `ConsentGate`, `ConsentScript`, `PrivacyChoicesButton` |
| [`@theplaintheory/svelte`](./svelte) | Svelte 4 and 5, SvelteKit | `init`, `consent`, `ready` and `allowed(category)` stores, `consentScript` action, actions |
| [`@theplaintheory/angular`](./angular) | Angular 17.1+ | `PlainConsentService` (signals), `providePlainConsent`, `*plainConsentAllowed` |

All of them share one subscription to the script (`consentStore` in `@theplaintheory/consent`), so state stays consistent across islands and micro-frontends.

## Script tag or package?

- **Script tag first in `<head>` (recommended for production).** It runs before any other script, so it can hold trackers written directly into your HTML. Add it, then use a package for state and components; the packages detect the tag and don't load a second copy.
- **Package only.** `loadPlainConsent()` adds the script at runtime. It holds every tracker added after it runs, including all known trackers, but can't stop `<script>` tags the browser already ran.

## Develop

This folder is its own npm workspace, separate from the app (the app's typecheck, lint and build ignore it).

```bash
cd packages
npm install
npm run build     # consent first, then react, vue, svelte, angular (ng-packagr)
npm test          # builds, then 28 tests against a stand-in for plain-consent.js
```

Tests run the sources in a browser-like DOM, except Angular, which is tested through its built package (what npm users get).

## Publish

One-time: create the `theplaintheory` organization on npmjs.com (it owns the `@theplaintheory` scope) and `npm login` as a member.

```bash
cd packages
npm run release   # build, test, then publish consent, react, vue, svelte and angular (from angular/dist)
```

Bump `version` in each package (and the `^x.y.z` range on `@theplaintheory/consent` in the others) before publishing again.
