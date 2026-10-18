# @theplaintheory/vue

Vue 3 and Nuxt bindings for [Plain Theory](https://www.theplaintheory.in) consent: a plugin, a `useConsent` composable and consent-gated components, with types. SSR-safe.

```bash
npm install @theplaintheory/vue
```

## Set up

```ts
// main.ts
import { createApp } from "vue";
import { createPlainConsent } from "@theplaintheory/vue";
import App from "./App.vue";

createApp(App).use(createPlainConsent({ siteKey: "pk_YOUR_SITE_KEY" })).mount("#app");
```

Nuxt: add the plugin in `plugins/plain-consent.client.ts` with `nuxtApp.vueApp.use(createPlainConsent({ … }))`. For trackers written into your HTML, also put the script tag first in `<head>` (from the dashboard's **Install** page); the plugin detects it and doesn't add a second copy.

## Use it

```vue
<script setup lang="ts">
import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent } from "@theplaintheory/vue";

const { state, ready, allowed, acceptAll, open, setLanguage } = useConsent();
const analytics = allowed("analytics");
</script>

<template>
  <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />

  <ConsentGate category="marketing">
    <iframe src="https://www.youtube.com/embed/…" title="Video" />
    <template #fallback><p>Allow marketing cookies to watch this video.</p></template>
  </ConsentGate>

  <p v-if="ready">Analytics {{ analytics ? "on" : "off" }} · {{ state?.language }}</p>
  <PrivacyChoicesButton class="link">Privacy choices</PrivacyChoicesButton>
</template>
```

`useConsent()` returns `{ state, ready, allowed(category), acceptAll, rejectAll, set, open, revoke, setLanguage }` and unsubscribes when the component's scope is disposed. State is `null` on the server and until the script is ready. Everything from [`@theplaintheory/consent`](https://www.npmjs.com/package/@theplaintheory/consent) is re-exported.

MIT · [Docs](https://www.theplaintheory.in/docs#frameworks)
