"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/app/configure/code-block";
import { LearnMore } from "@/components/app/configure/learn-more";
import { SelectField } from "@/components/app/ui/field";
import type { InstallMethod, MethodGroup } from "@/lib/install-snippets";

const GROUP_LABEL: Record<MethodGroup, string> = { code: "In your code", platform: "Website builder or tag manager" };
const FRAMEWORKS = new Set(["nextjs", "react", "vue", "svelte", "angular"]);

/** The docs section that goes deeper on a method. */
function docsFor(id: string): { anchor: string; topic: string } {
  if (id === "wordpress") return { anchor: "wordpress", topic: "installing on WordPress" };
  if (FRAMEWORKS.has(id)) return { anchor: "frameworks", topic: "installing in your framework" };
  return { anchor: "install", topic: "installing the script" };
}

/**
 * Pick how your site is built, get the exact code with this site's key in it. One select (code
 * first, then builders and tag managers) keeps the step short on every screen size.
 */
export function InstallMethods({ methods, initial = "html" }: { methods: InstallMethod[]; initial?: string }) {
  const [id, setId] = useState(initial);
  const m = methods.find((x) => x.id === id) ?? methods[0];
  const ordered = [...methods.filter((x) => x.group === "code"), ...methods.filter((x) => x.group !== "code")];
  const docs = docsFor(m.id);

  return (
    <div className="space-y-4">
      <SelectField
        id="install-method"
        label="How is your site built?"
        className="max-w-sm"
        value={m.id}
        onValueChange={setId}
        menuWidth={320}
        options={ordered.map((x) => ({ value: x.id, label: x.label, description: GROUP_LABEL[x.group] }))}
      />

      <div aria-live="polite" className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2 marker:text-ink-3">
          {m.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <CodeBlock id="install-code-label" label={`${m.label} · ${m.file}`} code={m.code} />
        <p className="text-xs text-ink-3">
          <LearnMore anchor={docs.anchor} topic={docs.topic} />
        </p>
      </div>
    </div>
  );
}
