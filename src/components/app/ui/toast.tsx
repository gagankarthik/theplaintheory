"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconClose } from "@/components/icons";
import { gsap, reducedMotion } from "@/lib/motion";

type Tone = "success" | "error";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

/** Polite live region for transient confirmations. Errors use role="alert" inside it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = "success") => {
    setItems((list) => [...list.slice(-2), { id: Date.now() + Math.random(), tone, message }]);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-[380px]">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDone={() => setItems((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Springs in from below; slides out to the side before it's removed.
  useLayoutEffect(() => {
    if (ref.current && !reducedMotion()) gsap.fromTo(ref.current, { y: 20, scale: 0.96, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(1.6)" });
  }, []);
  const dismiss = useCallback(() => {
    if (!ref.current || reducedMotion()) return onDone();
    gsap.to(ref.current, { x: 48, autoAlpha: 0, duration: 0.3, ease: "power2.in", onComplete: onDone });
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(dismiss, item.tone === "error" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [item.tone, dismiss]);
  const error = item.tone === "error";
  return (
    <div
      ref={ref}
      role={error ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-float"
    >
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${error ? "bg-rose text-white" : "bg-jade text-white"}`}>
        {error ? <IconAlert size={14} /> : <IconCheck size={14} />}
      </span>
      <p className="min-w-0 flex-1 text-ink">{item.message}</p>
      <button type="button" onClick={dismiss} className="-m-1 grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-paper hover:text-ink" aria-label="Dismiss notification">
        <IconClose size={14} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(Ctx);

/** Inline result for forms: role="alert" for errors, role="status" for success. Never color-only: icon + text. */
export function FormMessage({ state }: { state: { ok?: string; error?: string } | null | undefined }) {
  if (!state?.error && !state?.ok) return null;
  const error = Boolean(state.error);
  return (
    <p
      role={error ? "alert" : "status"}
      // focus target for useFocusOnError when no single field is at fault
      tabIndex={error ? -1 : undefined}
      data-form-summary={error ? "" : undefined}
      className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${error ? "bg-rose-wash text-rose" : "bg-jade-wash text-jade"}`}
    >
      {error ? <IconAlert size={18} className="mt-0.5 shrink-0" /> : <IconCheck size={18} className="mt-0.5 shrink-0" />}
      <span>{state.error ?? state.ok}</span>
    </p>
  );
}
