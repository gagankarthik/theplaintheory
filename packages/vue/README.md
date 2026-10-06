# @plaintheory/vue

Vue 3 and Nuxt 3 bindings for Plain Theory consent.

```bash
npm i @plaintheory/vue
```

## Vue (Vite)

```ts
// main.ts
import { createApp } from "vue";
import { createPlainConsent } from "@plaintheory/vue";
import App from "./App.vue";

createApp(App).use(createPlainConsent({ siteKey: "pk_live_YOUR_SITE_KEY" })).mount("#app");
```

## Nuxt 3

Put the script first in `<head>` so trackers in your HTML are held, then register the plugin on the client:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      script: [{ src: "https://cdn.theplaintheory.com/sdk/v1/plain-consent.js", "data-site": "pk_live_YOUR_SITE_KEY", tagPosition: "head" }],
    },
  },
});

// plugins/plain-consent.client.ts
import { createPlainConsent } from "@plaintheory/vue";
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createPlainConsent({ siteKey: "pk_live_YOUR_SITE_KEY" }));
});
```

## Use it

```vue
<script setup lang="ts">
import { ConsentGate, useConsent } from "@plaintheory/vue";
const { state, ready, allowed, open } = useConsent();
const analytics = allowed("analytics");
</script>

<template>
  <ConsentGate category="marketing">
    <YouTubeEmbed />
    <template #fallback><p>Allow marketing cookies to watch this video.</p></template>
  </ConsentGate>
  <p v-if="ready">Analytics: {{ analytics ? "on" : "off" }} ({{ state?.framework }})</p>
  <button @click="open">Privacy choices</button>
</template>
```

`useConsent()` returns `{ state, ready, allowed(category), acceptAll, rejectAll, set, open, revoke }`. `state` is `null` on the server and until the script is ready.
