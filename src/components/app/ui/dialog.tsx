"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/icons";

/**
 * Modal built on native <dialog>: the browser traps focus, Esc closes, and the page behind is inert.
 * Focus returns to whatever opened it.
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
      className="m-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-ink/45"
      style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      {open ? (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 id={`${id}-t`} className="text-lg font-bold">
                {title}
              </h2>
              {description ? (
                <p id={`${id}-d`} className="mt-0.5 text-sm text-ink-3">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-paper hover:text-ink" aria-label="Close dialog">
              <IconClose size={18} />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
