"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/** True while someone is typing, so a refresh never lands mid-edit. */
const editing = () => {
  const el = document.activeElement;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable));
};

const ago = (s: number) => (s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);

/**
 * Keeps a server-rendered page current: re-fetches its data every `interval` ms with router.refresh(),
 * which re-renders the server components and keeps scroll position and client state. It pauses
 * when the tab is hidden, the browser is offline, or the person is typing, refreshes as soon as
 * they come back, and can be paused by hand.
 */
export function LiveRefresh({ interval = 15_000 }: { interval?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const last = useRef(updatedAt);

  const refresh = useCallback(() => {
    if (document.visibilityState !== "visible" || !navigator.onLine || editing()) return;
    startTransition(() => {
      router.refresh();
      last.current = Date.now();
      setUpdatedAt(last.current);
    });
  }, [router]);

  useEffect(() => {
    if (paused) return;
    const tick = window.setInterval(refresh, interval);
    // Back to the tab after a while: catch up straight away instead of waiting for the next tick.
    const onReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > interval / 2) refresh();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("online", onReturn);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, [paused, interval, refresh]);

  // A slow clock for the "updated 12s ago" label.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);

  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  // One quiet pill: the dot and word say the state, the tooltip says when, a click pauses or resumes.
  return (
    <button
      type="button"
      onClick={() => {
        setPaused((p) => !p);
        if (paused) refresh();
      }}
      aria-pressed={paused}
      title={`${paused ? "Paused" : `Updated ${ago(seconds)}`}. Refreshes every ${interval / 1000} seconds while this tab is open. Click to ${paused ? "resume" : "pause"}.`}
      className="inline-flex h-8 items-center gap-2 rounded-full bg-surface px-3 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-paper hover:text-ink max-sm:h-11"
    >
      <span aria-hidden className="relative flex size-2">
        {!paused ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/50 motion-reduce:hidden" /> : null}
        <span className={`relative inline-flex size-2 rounded-full ${paused ? "bg-ink-3" : "bg-brand"}`} />
      </span>
      {paused ? "Paused" : pending ? "Updating" : "Live"}
      <span className="sr-only">
        , updated {ago(seconds)}. {paused ? "Resume" : "Pause"} live updates
      </span>
    </button>
  );
}
