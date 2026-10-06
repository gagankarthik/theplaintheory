"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { IconClose } from "@/components/icons";

const STORAGE_KEY = "pt-announcement-dpdp-2027";

const CHANGE_EVENT = "pt-announcement-change";

function readDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dismissed";
  } catch {
    return false; // storage blocked: keep showing
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Dismissible regulatory notice. Dismissal is remembered per browser when storage is available. */
export function AnnouncementBar() {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      /* storage blocked: hide for this page view only */
      document.getElementById("pt-announcement")?.setAttribute("hidden", "");
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <aside id="pt-announcement" aria-label="Announcement" className="relative bg-ink text-white">
      <div className="container-page flex min-h-10 items-center justify-center py-2 pr-10 text-center text-[13px]">
        <p className="text-white/80">
          DPDP Rules, 2025: most obligations apply from May 2027.{" "}
          <Link href="/compliance/dpdpa" className="font-medium text-white underline-offset-4 hover:underline">
            Read the readiness guide
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white/60 transition-colors hover:text-white"
      >
        <IconClose size={16} />
      </button>
    </aside>
  );
}
