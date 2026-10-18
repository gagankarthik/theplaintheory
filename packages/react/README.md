# @theplaintheory/react

React bindings for [Plain Theory](https://www.theplaintheory.in) consent: a provider, hooks and consent-gated components, with types. React 18 and 19, Next.js (App and Pages Router), Vite and Remix. SSR-safe and concurrent-safe.

```bash
npm install @theplaintheory/react
```

## Next.js (App Router)

Keep the script tag in `<head>` so it can hold trackers in your HTML, and add the provider:

```tsx
// app/layout.tsx
import Script from "next/script";
import { PlainConsentProvider } from "@theplaintheory/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script src="https://www.theplaintheory.in/sdk/plain-consent.js" data-site="pk_YOUR_SITE_KEY" strategy="beforeInteractive" />
        <PlainConsentProvider siteKey="pk_YOUR_SITE_KEY">{children}</PlainConsentProvider>
      </body>
    </html>
  );
}
```

With the tag present the provider just waits for it; without one it loads the script itself (Vite, Remix).

## Hooks and components

```tsx
import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent, useConsentAllowed } from "@theplaintheory/react";

function Analytics() {
  // adds the tag once Analytics is allowed; deduplicated
  return <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />;
}

function Video() {
  return (
    <ConsentGate category="marketing" fallback={<p>Allow marketing cookies to watch this video.</p>}>
      <iframe src="https://www.youtube.com/embed/…" title="Video" />
    </ConsentGate>
  );
}

function Footer() {
  return <PrivacyChoicesButton className="link">Privacy choices</PrivacyChoicesButton>;
}

function Status() {
  const { state, ready, acceptAll, rejectAll, set, open, revoke, setLanguage } = useConsent();
  const analytics = useConsentAllowed("analytics");
  return <p>{ready ? `Analytics ${analytics ? "on" : "off"} · ${state?.language}` : "Loading consent…"}</p>;
}
```

| Export | What it does |
| --- | --- |
| `PlainConsentProvider` | Loads the script once (props: `siteKey`, `src`, `apiUrl`, `configUrl`, `gcm`, `debug`, `nonce`). |
| `useConsent()` | `{ state, ready, acceptAll, rejectAll, set, open, revoke, setLanguage }`. |
| `useConsentAllowed(category)` | `true` while the category is allowed. |
| `useConsentReady()` | `true` once the site's settings have loaded. |
| `ConsentGate` | Children when allowed, `fallback` otherwise. |
| `ConsentScript` | Adds a third-party script once allowed. |
| `PrivacyChoicesButton` | Reopens the preferences panel. |

Hooks return "not allowed" on the server and before the script is ready, so nothing that needs consent renders too early. Everything from [`@theplaintheory/consent`](https://www.npmjs.com/package/@theplaintheory/consent) is re-exported.

MIT · [Docs](https://www.theplaintheory.in/docs#frameworks)
