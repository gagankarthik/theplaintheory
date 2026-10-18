# @theplaintheory/svelte

Svelte and SvelteKit stores for [Plain Theory](https://www.theplaintheory.in) consent, with types. Svelte 4 and 5. SSR-safe.

```bash
npm install @theplaintheory/svelte
```

## Set up

Put the script tag first in `<head>` in `src/app.html` (copy it from the dashboard's **Install** page), or load it from your root layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { init } from "@theplaintheory/svelte";
  onMount(() => init({ siteKey: "pk_YOUR_SITE_KEY" }));
</script>

<slot />
```

## Use it

```svelte
<script lang="ts">
  import { allowed, consent, consentScript, openPreferences, ready, setLanguage } from "@theplaintheory/svelte";
  const marketing = allowed("marketing");
</script>

<div use:consentScript={{ category: "analytics", src: "https://www.googletagmanager.com/gtag/js?id=G-XXXX" }}></div>

{#if $marketing}
  <iframe src="https://www.youtube.com/embed/…" title="Video"></iframe>
{:else}
  <p>Allow marketing cookies to watch this video.</p>
{/if}

{#if $ready}<p>Language: {$consent?.language}</p>{/if}
<button on:click={openPreferences}>Privacy choices</button>
```

| Export | What it is |
| --- | --- |
| `init(options)` | Loads the script once (browser only). |
| `consent` | Store: the state, `null` on the server and until ready. |
| `ready`, `allowed(category)` | Boolean stores. |
| `consentScript` | Action: add a third-party script once allowed. |
| `acceptAll`, `rejectAll`, `setConsent`, `openPreferences`, `revoke`, `setLanguage` | Actions; queued until the script loads. |

Everything from [`@theplaintheory/consent`](https://www.npmjs.com/package/@theplaintheory/consent) is re-exported.

MIT · [Docs](https://www.theplaintheory.in/docs#frameworks)
