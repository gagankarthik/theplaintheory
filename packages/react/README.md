# @plaintheory/react

React bindings for Plain Theory consent. Works with React 18 and 19, Next.js (App and Pages Router), Vite and Remix. Hooks use `useSyncExternalStore`, so they're safe with concurrent rendering and return `null` state during server rendering.

```bash
npm i @plaintheory/react
```

## Next.js (App Router)

```tsx
// app/layout.tsx
import Script from "next/script";
import { PlainConsentProvider } from "@plaintheory/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Injected into the server HTML <head> and run before any Next.js code */}
        <Script src="https://cdn.theplaintheory.com/sdk/v1/plain-consent.js" data-site="pk_live_YOUR_SITE_KEY" strategy="beforeInteractive" />
        <PlainConsentProvider siteKey="pk_live_YOUR_SITE_KEY">{children}</PlainConsentProvider>
      </body>
    </html>
  );
}
```

The provider sees the existing tag and doesn't load a second copy. Without the `<Script>`, the provider loads the script itself after hydration.

## Vite

```tsx
// src/main.tsx
import { createRoot } from "react-dom/client";
import { PlainConsentProvider } from "@plaintheory/react";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <PlainConsentProvider siteKey="pk_live_YOUR_SITE_KEY">
    <App />
  </PlainConsentProvider>,
);
```

## Use it

```tsx
import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent, useConsentAllowed } from "@plaintheory/react";

function Footer() {
  return <PrivacyChoicesButton className="link">Privacy choices</PrivacyChoicesButton>;
}

function Video() {
  return (
    <ConsentGate category="marketing" fallback={<p>Allow marketing cookies to watch this video.</p>}>
      <iframe src="https://www.youtube-nocookie.com/embed/..." title="Product tour" />
    </ConsentGate>
  );
}

function Analytics() {
  return <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" />;
}

function Settings() {
  const { state, ready, set, revoke } = useConsent();
  const analytics = useConsentAllowed("analytics");
  if (!ready) return null;
  return (
    <label>
      <input type="checkbox" checked={analytics} onChange={(e) => set({ analytics: e.target.checked })} /> Analytics
      <small>Notice: {state?.framework}</small>
      <button onClick={revoke}>Reset my choice</button>
    </label>
  );
}
```

| Export | Description |
| --- | --- |
| `PlainConsentProvider` | Loads the script once on the client. Takes the same options as `loadPlainConsent`. |
| `useConsent()` | `{ state, ready, acceptAll, rejectAll, set, open, revoke }` |
| `useConsentAllowed(category)` | `boolean`. False on the server and before the script is ready (except `essential`). |
| `ConsentGate` | Renders children only when the category is allowed, otherwise `fallback`. |
| `ConsentScript` | Adds a script once its category is allowed. |
| `PrivacyChoicesButton` | Reopens the preferences panel, so withdrawing is as easy as giving consent. |
