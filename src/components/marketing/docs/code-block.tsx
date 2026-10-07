"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code stays selectable */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white max-sm:h-11 max-sm:min-w-11"
      >
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}

/** Dark code panel with a filename/language bar and a copy button. */
export function CodeBlock({ code, title, language = "html" }: { code: string; title?: string; language?: string }) {
  return (
    <figure className="overflow-hidden rounded-[var(--radius-md)] bg-ink text-white ring-1 ring-black/5">
      <div className="flex h-11 items-center justify-between border-b border-white/10 pl-4 pr-1.5">
        <figcaption className="font-mono text-xs text-white/60">{title ?? language}</figcaption>
        <CopyButton text={code} label={title ?? `${language} snippet`} />
      </div>
      <pre tabIndex={0} className="overflow-x-auto p-4 text-[13px] leading-relaxed" aria-label={title ?? `${language} code`}>
        <code className="font-mono">{code}</code>
      </pre>
    </figure>
  );
}

/** Tabs for the same snippet in different stacks. Arrow keys move between tabs. */
export function CodeTabs({ tabs }: { tabs: { label: string; title: string; language: string; code: string }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  // keep the selected tab fully visible inside the scrolling tab list
  // (adjusts only the list's own scroll position, never the page's)
  useEffect(() => {
    const tab = refs.current[active];
    const list = tab?.parentElement;
    if (!tab || !list) return;
    const fade = 32;
    if (tab.offsetLeft < list.scrollLeft) list.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth - fade) list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth + fade;
  }, [active]);

  const t = tabs[active];
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-ink text-white ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-white/10 pl-2 pr-1.5">
        {/* scrolls sideways when the tabs don't fit; the fade on the right says there are more */}
        <div
          role="tablist"
          aria-label="Framework"
          className="relative flex min-w-0 flex-1 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className="relative h-11 shrink-0 whitespace-nowrap px-3 text-xs font-medium text-white/60 transition-colors hover:text-white aria-selected:text-white"
            >
              {tab.label}
              {i === active ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-on-ink" /> : null}
            </button>
          ))}
        </div>
        <div className="shrink-0 border-l border-white/10 pl-1.5">
          <CopyButton text={t.code} label={t.title} />
        </div>
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`}>
        <p className="border-b border-white/5 px-4 py-2 font-mono text-xs text-white/50">{t.title}</p>
        <pre tabIndex={0} className="overflow-x-auto p-4 text-[13px] leading-relaxed">
          <code className="font-mono">{t.code}</code>
        </pre>
      </div>
    </div>
  );
}
