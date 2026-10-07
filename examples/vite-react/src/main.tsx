import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlainConsentProvider } from "@plaintheory/react";
import { App } from "./App";

// Points at the local Plain Theory app (npm run dev in the repo root) and its seeded demo site.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlainConsentProvider siteKey={import.meta.env.VITE_PLAIN_SITE_KEY} src="http://localhost:3000/sdk/plain-consent.js">
      <App />
    </PlainConsentProvider>
  </StrictMode>,
);
