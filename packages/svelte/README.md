# @plaintheory/svelte

Svelte stores for Plain Theory consent. Works with Svelte 4 and 5, and SvelteKit.

```bash
npm i @plaintheory/svelte
```

## SvelteKit

Put the script first in `src/app.html` so trackers in your HTML are held:

```html
<head>
  <script src="https://cdn.theplaintheory.in/sdk/v1/plain-consent.js" data-site="pk_live_YOUR_SITE_KEY"></script>
  %sveltekit.head%
</head>
```

Or load it from your root layout instead:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from "svelte";
  import { init } from "@plaintheory/svelte";
  onMount(() => init({ siteKey: "pk_live_YOUR_SITE_KEY" }));
</script>

<slot />
```

## Use it

```svelte
<script>
  import { consent, allowed, openPreferences } from "@plaintheory/svelte";
  const marketing = allowed("marketing");
</script>

{#if $marketing}
  <YouTubeEmbed />
{:else}
  <p>Allow marketing cookies to watch this video.</p>
{/if}

{#if $consent}<p>Notice: {$consent.framework}</p>{/if}
<button on:click={openPreferences}>Privacy choices</button>
```

Exports: `init`, `consent`, `allowed(category)`, `acceptAll`, `rejectAll`, `setConsent`, `openPreferences`, `revoke`. In Svelte 5 use `onclick` instead of `on:click`.
