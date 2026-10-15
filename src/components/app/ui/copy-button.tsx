"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { buttonClass, type ButtonSize } from "./button";

/** `size` is optional (default "sm"); "md" gives the 40px target for a standalone copyable field. */
export function CopyButton({ value, label = "Copy", describedBy, size = "sm" }: { value: string; label?: string; describedBy?: string; size?: ButtonSize }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className={buttonClass("secondary", size)}
      aria-describedby={describedBy}
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => setState("copied"))
          .catch(() => setState("failed"))
      }
    >
      {state === "copied" ? <IconCheck size={16} /> : <IconCopy size={16} />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Select and copy manually" : label}</span>
    </button>
  );
}
