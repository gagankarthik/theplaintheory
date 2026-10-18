/**
 * Code samples for the docs, built from the same source as the dashboard's Install page
 * (src/lib/install-snippets.ts, src/app/app/sites/[propertyId]/install/page.tsx), with a placeholder
 * site key, so the two never disagree. Every tab is the same script tag; only where you paste it differs.
 */

import { CDN_ORIGIN, installMethods, SDK_URL } from "@/lib/install-snippets";
import { publicUrl } from "@/lib/site";

/** Where the SDK is served from. */
export const CDN = SDK_URL;
/** Placeholder in the shape of a real site key (pk_ + 16 characters). */
export const KEY = "pk_YOUR_SITE_KEY";
/** The consent API every customer tag points at. */
export const API = `${publicUrl}/api/v1`;
/** Published configs sit on the CDN when publishing writes there; the dashboard then adds data-config-url. */
const CONFIG_URL = process.env.PUBLISH_DRIVER === "s3" ? `${CDN_ORIGIN}/c/${KEY}.json` : undefined;

type Snippet = { label: string; title: string; language: string; code: string };

const LANGUAGE: Record<string, string> = { nextjs: "tsx", vue: "ts" };

/** Install: the script tag first in <head>, per stack, with the attributes the dashboard's tag carries. */
export const INSTALL_SNIPPETS: Snippet[] = installMethods({ siteKey: KEY, src: CDN, api: API, configUrl: CONFIG_URL, gcm: true }).map((m) => ({
  label: m.label,
  title: m.file,
  language: LANGUAGE[m.id] ?? "html",
  code: m.code,
}));

/**
 * Whether the @theplaintheory/* packages are on npm. Flip to true once they're published
 * (packages/README.md, `npm run release`); until then the docs show the script tag and the
 * JavaScript API only, so nobody is told to install a package that doesn't exist yet.
 */
export const PACKAGES_ON_NPM = true;

/** One example per framework package: set up, gate content, add a script after consent, reopen preferences. */
export const PACKAGE_SNIPPETS: Snippet[] = [
  {
    label: "React",
    title: "npm install @theplaintheory/react",
    language: "tsx",
    code: `// app/layout.tsx (Next.js): keep the script tag in <head>, add the provider
import { PlainConsentProvider } from "@theplaintheory/react";

<PlainConsentProvider siteKey="${KEY}">{children}</PlainConsentProvider>

// anywhere below it
import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsentAllowed } from "@theplaintheory/react";

<ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />
<ConsentGate category="marketing" fallback={<p>Allow marketing cookies to watch this video.</p>}>
  <iframe src="https://www.youtube.com/embed/…" title="Video" />
</ConsentGate>
<PrivacyChoicesButton>Privacy choices</PrivacyChoicesButton>

const analytics = useConsentAllowed("analytics"); // false on the server and until allowed`,
  },
  {
    label: "Vue",
    title: "npm install @theplaintheory/vue",
    language: "ts",
    code: `// main.ts
import { createPlainConsent } from "@theplaintheory/vue";
createApp(App).use(createPlainConsent({ siteKey: "${KEY}" })).mount("#app");

// in a component
import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent } from "@theplaintheory/vue";
const { allowed, open, setLanguage } = useConsent();
const analytics = allowed("analytics"); // ComputedRef<boolean>

<ConsentGate category="marketing"> … <template #fallback> … </template></ConsentGate>
<ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />
<PrivacyChoicesButton>Privacy choices</PrivacyChoicesButton>`,
  },
  {
    label: "Svelte",
    title: "npm install @theplaintheory/svelte",
    language: "svelte",
    code: `<script lang="ts">
  import { onMount } from "svelte";
  import { allowed, consentScript, init, openPreferences } from "@theplaintheory/svelte";
  onMount(() => init({ siteKey: "${KEY}" }));
  const marketing = allowed("marketing");
</script>

<div use:consentScript={{ category: "analytics", src: "https://www.googletagmanager.com/gtag/js?id=G-XXXX" }}></div>
{#if $marketing}<iframe src="https://www.youtube.com/embed/…" title="Video"></iframe>{/if}
<button on:click={openPreferences}>Privacy choices</button>`,
  },
  {
    label: "Angular",
    title: "npm install @theplaintheory/angular",
    language: "ts",
    code: `// main.ts
import { providePlainConsent } from "@theplaintheory/angular";
bootstrapApplication(App, { providers: [providePlainConsent({ siteKey: "${KEY}" })] });

// a standalone component
import { PlainConsentAllowedDirective, PlainConsentService } from "@theplaintheory/angular";

template: \`<iframe *plainConsentAllowed="'marketing'; else blocked" src="https://www.youtube.com/embed/…"></iframe>
           <ng-template #blocked><p>Allow marketing cookies to watch this video.</p></ng-template>\`
readonly consent = inject(PlainConsentService);
readonly analytics = this.consent.allowed("analytics"); // Signal<boolean>`,
  },
];
