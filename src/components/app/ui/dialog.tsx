"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/icons";
import { reducedMotion } from "@/lib/reduced-motion";

/**
 * Modal built on native <dialog>: the browser traps focus, Esc closes, the page behind is inert under
 * a soot scrim, and focus returns to whatever opened it. 22px radius; rises in over 240ms.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
      // Rises into place; the native backdrop fades in with it.
      // (the browser's own Web Animations API: no animation library in the dashboard bundle)
      if (!reducedMotion()) d.animate([{ transform: "translateY(12px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 240, easing: "cubic-bezier(0.33, 1, 0.68, 1)" });
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
      onClose={() => {
        onClose();
        (opener.current as HTMLElement | null)?.focus?.();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="scroll-thin m-auto max-h-[calc(100dvh-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-[rgb(15_15_15/0.55)]"
      style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      {open ? (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 id={`${id}-t`} className="text-lg font-semibold leading-snug">
                {title}
              </h2>
              {description ? (
                <p id={`${id}-d`} className="mt-0.5 text-sm text-ink-3">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-paper hover:text-ink" aria-label="Close dialog">
              <IconClose size={18} />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
