/** Code samples for the docs. Kept in sync with packages/* and sdk/src by hand; see packages/README.md. */

import { SDK_URL } from "@/lib/install-snippets";

/** The working CDN (cdn.theplaintheory.in has no DNS record yet). */
export const CDN = SDK_URL;
const KEY = "pk_live_YOUR_SITE_KEY";

type Snippet = { label: string; title: string; language: string; code: string };

/** Install: the script tag first in <head>, per stack. */
export const INSTALL_SNIPPETS: Snippet[] = [
  {
    label: "HTML",
    title: "index.html",
    language: "html",
    code: `<head>
  <script src="${CDN}"
          data-site="${KEY}"></script>
  <!-- everything else after -->
</head>`,
  },
  {
    label: "Next.js",
    title: "app/layout.tsx",
    language: "tsx",
    code: `import Script from "next/script";
import { PlainConsentProvider } from "@plaintheory/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Injected into the server HTML <head> and run before any Next.js code */}
        <Script src="${CDN}" data-site="${KEY}" strategy="beforeInteractive" />
        <PlainConsentProvider siteKey="${KEY}">{children}</PlainConsentProvider>
      </body>
    </html>
  );
}`,
  },
  {
    label: "React + Vite",
    title: "index.html + src/main.tsx",
    language: "tsx",
    code: `<!-- index.html: first in <head> -->
<script src="${CDN}" data-site="${KEY}"></script>

// src/main.tsx
import { createRoot } from "react-dom/client";
import { PlainConsentProvider } from "@plaintheory/react";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <PlainConsentProvider siteKey="${KEY}">
    <App />
  </PlainConsentProvider>,
);`,
  },
  {
    label: "Vue / Nuxt",
    title: "nuxt.config.ts + plugins/plain-consent.client.ts",
    language: "ts",
    code: `// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      script: [{ src: "${CDN}", "data-site": "${KEY}", tagPosition: "head" }],
    },
  },
});

// plugins/plain-consent.client.ts
import { createPlainConsent } from "@plaintheory/vue";
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createPlainConsent({ siteKey: "${KEY}" }));
});

// Plain Vue + Vite: main.ts
// createApp(App).use(createPlainConsent({ siteKey: "${KEY}" })).mount("#app");`,
  },
  {
    label: "Svelte / SvelteKit",
    title: "src/app.html",
    language: "html",
    code: `<head>
  <script src="${CDN}" data-site="${KEY}"></script>
  %sveltekit.head%
</head>

<!-- or, from src/routes/+layout.svelte -->
<script>
  import { onMount } from "svelte";
  import { init } from "@plaintheory/svelte";
  onMount(() => init({ siteKey: "${KEY}" }));
</script>`,
  },
  {
    label: "Angular",
    title: "src/index.html",
    language: "html",
    code: `<head>
  <script src="${CDN}" data-site="${KEY}"></script>
</head>

<!-- or from your root component, with PlainConsentService:
     inject(PlainConsentService).init({ siteKey: "${KEY}" }) -->`,
  },
  {
    label: "WordPress",
    title: "Settings → Plain Theory",
    language: "text",
    code: `1. Install and activate "Plain Theory Consent"
2. Settings → Plain Theory
   Site key                   ${KEY}
   Load before other scripts  on
3. Optional, hold scripts other plugins add:
   google-analytics = analytics
   facebook-pixel   = marketing`,
  },
];

/** Using the framework packages once installed. */
export const PACKAGE_SNIPPETS: Snippet[] = [
  {
    label: "React",
    title: "components.tsx",
    language: "tsx",
    code: `import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent, useConsentAllowed } from "@plaintheory/react";

export function Video() {
  return (
    <ConsentGate category="marketing" fallback={<p>Allow marketing cookies to watch this video.</p>}>
      <iframe src="https://www.youtube-nocookie.com/embed/..." title="Product tour" />
    </ConsentGate>
  );
}

export function Analytics() {
  return <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />;
}

export function Footer() {
  const { ready, state } = useConsent();
  const analytics = useConsentAllowed("analytics");
  return (
    <footer>
      <PrivacyChoicesButton />
      {ready ? <small>{state?.framework} notice, analytics {analytics ? "on" : "off"}</small> : null}
    </footer>
  );
}`,
  },
  {
    label: "Vue",
    title: "Video.vue",
    language: "vue",
    code: `<script setup lang="ts">
import { ConsentGate, useConsent } from "@plaintheory/vue";
const { ready, allowed, open } = useConsent();
const analytics = allowed("analytics");
</script>

<template>
  <ConsentGate category="marketing">
    <YouTubeEmbed />
    <template #fallback><p>Allow marketing cookies to watch this video.</p></template>
  </ConsentGate>
  <p v-if="ready">Analytics is {{ analytics ? "on" : "off" }}</p>
  <button @click="open">Privacy choices</button>
</template>`,
  },
  {
    label: "Svelte",
    title: "Video.svelte",
    language: "svelte",
    code: `<script>
  import { allowed, consent, openPreferences } from "@plaintheory/svelte";
  const marketing = allowed("marketing");
</script>

{#if $marketing}
  <YouTubeEmbed />
{:else}
  <p>Allow marketing cookies to watch this video.</p>
{/if}

{#if $consent}<small>{$consent.framework} notice</small>{/if}
<button on:click={openPreferences}>Privacy choices</button>`,
  },
  {
    label: "Angular",
    title: "video.component.ts",
    language: "ts",
    code: `import { Component, inject } from "@angular/core";
import { PlainConsentService } from "./plain-consent.service";

@Component({
  selector: "app-video",
  standalone: true,
  template: \`
    @if (marketing()) {
      <iframe src="https://www.youtube-nocookie.com/embed/..." title="Product tour"></iframe>
    } @else {
      <p>Allow marketing cookies to watch this video.</p>
      <button (click)="consent.open()">Privacy choices</button>
    }
  \`,
})
export class VideoComponent {
  readonly consent = inject(PlainConsentService);
  readonly marketing = this.consent.allowed("marketing");
}`,
  },
  {
    label: "Any framework",
    title: "consent.ts",
    language: "ts",
    code: `import { loadPlainConsent, onConsentChange, whenAllowed, loadScriptWhenAllowed } from "@plaintheory/consent";

await loadPlainConsent({ siteKey: "${KEY}" });

onConsentChange((state) => console.log(state.framework, state.categories));

await whenAllowed("analytics");
await loadScriptWhenAllowed("marketing", "https://connect.facebook.net/en_US/fbevents.js");`,
  },
];
