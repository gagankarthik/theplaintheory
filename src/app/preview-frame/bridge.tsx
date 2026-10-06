"use client";

import { useEffect } from "react";
import type { PublicConfig } from "@/lib/public-config";
import type { Framework } from "@/lib/types";

type PlainPreviewApi = { preview(c: PublicConfig, f: Framework, v?: "banner" | "prefs", lang?: string): void };
/** `lang` previews one of the region's translations (e.g. "hi"); omit it for the default copy. */
type PreviewMessage = { type: "plain:preview"; config: PublicConfig; framework: Framework; view?: "banner" | "prefs"; lang?: string };

export function PreviewBridge() {
  useEffect(() => {
    let latest: PreviewMessage | null = null;
    const api = () => (window as unknown as { PlainConsent?: PlainPreviewApi }).PlainConsent;
    const apply = () => {
      const pc = api();
      if (latest && pc && typeof pc.preview === "function") pc.preview(latest.config, latest.framework, latest.view, latest.lang);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as PreviewMessage | undefined;
      if (d?.type !== "plain:preview") return;
      latest = d;
      apply();
    };
    window.addEventListener("message", onMessage);

    // No data-site: the SDK boots in preview-only mode (no storage, network or blocking).
    const s = document.createElement("script");
    s.src = "/sdk/plain-consent.js";
    s.onload = () => {
      apply();
      window.parent?.postMessage({ type: "plain:ready" }, window.location.origin);
    };
    document.head.appendChild(s);

    return () => {
      window.removeEventListener("message", onMessage);
      s.remove();
    };
  }, []);
  return null;
}
