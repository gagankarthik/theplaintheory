"use client";

import { useRouter } from "next/navigation";

type ConsentApi = { open: () => void };

/** Reopens our own consent preferences (the Plain Theory SDK runs on this site too). */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const api = (window as Window & { PlainConsent?: ConsentApi | unknown[] }).PlainConsent;
        if (api && !Array.isArray(api)) api.open();
        else router.push("/legal/cookies"); // script blocked or not loaded yet
      }}
    >
      Cookie settings
    </button>
  );
}
