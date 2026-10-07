import type { Metadata } from "next";
import { PreviewBridge } from "./bridge";

export const metadata: Metadata = {
  title: "Banner preview",
  robots: { index: false, follow: false },
};

/**
 * Embedded in the dashboard builder as an iframe. A neutral page skeleton so the banner is judged in context.
 * The parent posts {type:"plain:preview", config, framework, view?}; we answer {type:"plain:ready"}.
 */
export default function PreviewFrame() {
  return (
    <div className="min-h-screen bg-white text-ink-2" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* the frame scrolls inside the builder: keep its scrollbar as quiet as the app's */}
      <style>{"html{scrollbar-width:thin;scrollbar-color:#d0d4de transparent}"}</style>
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="h-5 w-28 rounded bg-line-strong" />
        <div className="hidden gap-5 sm:flex">
          <div className="h-3 w-14 rounded bg-line" />
          <div className="h-3 w-14 rounded bg-line" />
          <div className="h-3 w-14 rounded bg-line" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12" aria-hidden>
        <div className="h-8 w-3/4 rounded bg-line-strong" />
        <div className="mt-3 h-8 w-1/2 rounded bg-line-strong" />
        <div className="mt-8 space-y-3">
          {[100, 96, 92, 98, 70].map((w, i) => (
            <div key={i} className="h-3 rounded bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-10 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-lg bg-paper" />
          ))}
        </div>
        <div className="mt-10 space-y-3">
          {[94, 100, 88].map((w, i) => (
            <div key={i} className="h-3 rounded bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>
      </main>
      <PreviewBridge />
    </div>
  );
}
