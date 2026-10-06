import { ConsentGate, ConsentScript, PrivacyChoicesButton, useConsent, type Category } from "@plaintheory/react";

const CATEGORIES: Category[] = ["functional", "analytics", "marketing"];

export function App() {
  const { state, ready, acceptAll, rejectAll, set, revoke } = useConsent();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "48px auto", padding: "0 16px", lineHeight: 1.5 }}>
      <h1>Plain Theory with Vite and React</h1>
      <p>
        The banner below comes from the real script. Use it, or the controls here, and watch the state update. Try{" "}
        <code>?plain_country=IN</code> or <code>?plain_country=US&amp;plain_region=CA</code> for other notices.
      </p>

      <section aria-labelledby="state">
        <h2 id="state">Consent state</h2>
        {ready && state ? (
          <>
            <p>
              Notice: <strong>{state.framework}</strong>. Decided: <strong>{state.decided ? "yes" : "no"}</strong>.
            </p>
            <ul>
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <label>
                    <input type="checkbox" checked={state.categories[c]} onChange={(e) => set({ [c]: e.target.checked })} /> {c}
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Loading the consent script…</p>
        )}
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={acceptAll}>Accept all</button>
          <button onClick={rejectAll}>Reject all</button>
          <button onClick={revoke}>Reset my choice</button>
          <PrivacyChoicesButton />
        </p>
      </section>

      <section aria-labelledby="gated">
        <h2 id="gated">Consent-gated content</h2>
        <ConsentGate category="marketing" fallback={<p>Allow marketing to see the embedded video.</p>}>
          <p>Marketing is allowed: an embed would render here.</p>
        </ConsentGate>
      </section>

      {/* Added to <head> only after analytics is allowed */}
      <ConsentScript category="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-EXAMPLE" />
    </main>
  );
}
