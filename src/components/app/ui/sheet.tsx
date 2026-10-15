"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/icons";

/**
 * Side panel on the native <dialog> (focus trap, Esc, inert page behind a scrim): for row details such
 * as a tracker, a scan or a receipt, where the list should stay in view. Slides in from the right on
 * wider screens; on phones it is a full-width sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
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
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onClose={() => {
        onClose();
        (opener.current as HTMLElement | null)?.focus?.();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="pt-sheet-right m-0 ml-auto h-dvh max-h-dvh border-l border-line bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-[rgb(15_15_15/0.55)] sm:rounded-l-xl"
      style={{ width: `min(${width}px, 100vw)` }}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={`${id}-t`} className="truncate text-base font-semibold">
                {title}
              </h2>
              {description ? <div className="mt-0.5 text-sm text-ink-3">{description}</div> : null}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-paper hover:text-ink" aria-label="Close panel">
              <IconClose size={16} />
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
