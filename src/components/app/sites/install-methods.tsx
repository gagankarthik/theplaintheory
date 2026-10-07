"use client";

import { useState } from "react";
import { CopyButton } from "@/components/app/ui/copy-button";
import type { InstallMethod, MethodGroup } from "@/lib/install-snippets";

const GROUPS: { id: MethodGroup; label: string }[] = [
  { id: "code", label: "In your code" },
  { id: "platform", label: "Website builder or tag manager" },
];

/**
 * Pick how your site is built, get the exact code with this site's key in it. Two short groups
 * (code vs. no-code) instead of one long list, so the right choice is quick to find.
 */
export function InstallMethods({ methods, initial = "html" }: { methods: InstallMethod[]; initial?: string }) {
  const [id, setId] = useState(initial);
  const m = methods.find((x) => x.id === id) ?? methods[0];

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="sr-only">How is your site built?</legend>
        {GROUPS.map((g) => (
          <div key={g.id}>
            <p className="mb-1.5 text-xs font-medium text-ink-3">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {methods
                .filter((x) => x.group === g.id)
                .map((x) => (
                  <label
                    key={x.id}
                    className={`inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-sm transition-colors max-sm:h-11 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                      x.id === m.id ? "bg-brand-wash font-medium text-brand-ink ring-1 ring-inset ring-brand/40" : "text-ink-2 ring-1 ring-inset ring-line hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <input type="radio" name="install-method" value={x.id} checked={x.id === m.id} onChange={() => setId(x.id)} className="sr-only" />
                    {x.label}
                  </label>
                ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div aria-live="polite" className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 marker:text-ink-3">
          {m.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <figure className="overflow-hidden rounded-lg border border-line bg-ink text-paper">
          <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[.03] py-1.5 pl-4 pr-1.5 text-xs text-white/70">
            <span id="install-code-label">
              {m.label} · {m.file}
            </span>
            <span className="[&_.btn]:border-white/20 [&_.btn]:text-paper [&_.btn:hover]:border-white/50">
              <CopyButton value={m.code} describedBy="install-code-label" />
            </span>
          </figcaption>
          <pre className="scroll-thin overflow-x-auto p-4 font-mono text-xs leading-relaxed" tabIndex={0} role="region" aria-labelledby="install-code-label">
            <code>{m.code}</code>
          </pre>
        </figure>
      </div>
    </div>
  );
}
