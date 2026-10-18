"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PublicConfig } from "@/lib/public-config";
import type { Framework } from "@/lib/types";

/**
 * A small, live picture of the site's banner: the builder's preview page in a scaled frame, sent the
 * config to show. Decorative (the card beside it says the same in words), so it's hidden from
 * assistive tech and can't take focus or clicks.
 */
export function SitePreview({ config, framework, domain }: { config: PublicConfig; framework: Framework; domain: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "plain:preview", config, framework }, window.location.origin);
  }, [config, framework]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.origin === window.location.origin && e.data?.type === "plain:ready") send();
    };
    window.addEventListener("message", onMsg);
    send();
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  return (
    <div aria-hidden className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-2">
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </span>
        <span className="min-w-0 truncate rounded-full bg-surface px-2.5 py-0.5 font-mono text-2xs text-ink-3 ring-1 ring-inset ring-line">{domain}</span>
      </div>
      {/* a 1000×640 page drawn at 40% */}
      <div className="relative h-[256px] overflow-hidden">
        <iframe ref={frame} src="/preview-frame" tabIndex={-1} title="" onLoad={send} className="pointer-events-none absolute left-0 top-0 h-[640px] w-[250%] origin-top-left scale-[0.4] border-0" />
      </div>
    </div>
  );
}
