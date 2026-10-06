"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { buttonClass } from "./button";

export function CopyButton({ value, label = "Copy", describedBy }: { value: string; label?: string; describedBy?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
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
