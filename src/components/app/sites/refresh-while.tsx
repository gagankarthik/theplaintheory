"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-render the server page every `everyMs` while `active`, so a page showing work in flight (a scan
 * on the setup checklist) updates itself and ticks the step off when it's done. Pauses in background
 * tabs; renders nothing.
 */
export function RefreshWhile({ active, everyMs = 10_000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
